import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO
import asyncio
import base64
import time
import logging
from typing import AsyncGenerator, Dict, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class StreamFrame:
    frame_id: int
    timestamp: float
    annotated_frame: bytes  # JPEG bytes
    zones_data: Dict[str, any]
    fps: float

class RealtimeStreamProcessor:
    """
    Process video as a real-time stream, simulating a live CCTV camera feed.
    Yields frames with analytics as they're processed.
    """
    
    def __init__(
        self,
        video_path: str,
        zones: List[dict],
        conf: float = 0.4,
        target_fps: int = 15,
        min_wait_sec_filter: float = 1.0
    ):
        self.video_path = video_path
        self.zones = zones
        self.conf = conf
        self.target_fps = target_fps
        self.min_wait_sec_filter = min_wait_sec_filter
        
        # Load model once
        self.model = YOLO("yolov8s.pt")
        
        # Get video info
        self.cap = cv2.VideoCapture(video_path)
        self.original_fps = self.cap.get(cv2.CAP_PROP_FPS)
        self.width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self.height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Prepare zones
        self.polygons_cv2 = [
            np.array(z["polygon"], dtype=np.int32).reshape((-1, 1, 2))
            for z in zones
        ]
        self.zone_names = [z.get("name", f"Zone {i+1}") for i, z in enumerate(zones)]
        
        # Tracking state
        self.global_time_in_zone: Dict[int, float] = {}
        self.per_zone_time_in_zone: List[Dict[int, float]] = [{} for _ in zones]
        self.per_zone_queue_lengths: List[List[int]] = [[] for _ in zones]
        self.time_stamps: List[float] = []
        
        # Frame timing
        self.frame_delay = 1.0 / target_fps  # Target delay between frames
        self.dt = 1.0 / self.original_fps  # Time delta per frame in video
        
        logger.info(f"Initialized stream processor: {self.width}x{self.height} @ {self.original_fps} FPS")
        logger.info(f"Streaming at {target_fps} FPS (frame delay: {self.frame_delay:.3f}s)")
        logger.info(f"Processing {len(zones)} zones")
    
    async def process_stream(self) -> AsyncGenerator[StreamFrame, None]:
        """
        Process video frame by frame, yielding results in real-time.
        Simulates a live camera feed by introducing delays between frames.
        """
        frame_idx = 0
        start_time = time.time()
        
        # Initialize ByteTrack tracker
        tracker = sv.ByteTrack(
            frame_rate=self.original_fps,
            track_activation_threshold=self.conf
        )
        
        logger.info("Starting real-time stream processing...")
        
        while True:
            ret, frame = self.cap.read()
            if not ret:
                logger.info("End of video stream, looping...")
                # Loop the video for continuous streaming
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                frame_idx = 0
                continue
            
            frame_idx += 1
            current_time = time.time() - start_time
            
            # Run YOLO detection
            results = self.model.track(
                frame,
                conf=self.conf,
                classes=[0],  # person class
                persist=True,
                verbose=False
            )[0]
            
            # Convert to supervision Detections
            detections = sv.Detections.from_ultralytics(results)
            
            # Update tracker
            if results.boxes.id is not None:
                detections.tracker_id = results.boxes.id.cpu().numpy().astype(int)
            
            # Analyze zones
            zones_data = self._analyze_zones(detections, frame_idx)
            
            # Annotate frame
            annotated_frame = self._annotate_frame(frame, detections, zones_data)
            
            # Encode frame to JPEG
            _, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frame_bytes = buffer.tobytes()
            
            # Calculate actual FPS
            elapsed = time.time() - start_time
            actual_fps = frame_idx / elapsed if elapsed > 0 else 0
            
            # Yield frame data
            stream_frame = StreamFrame(
                frame_id=frame_idx,
                timestamp=current_time,
                annotated_frame=frame_bytes,
                zones_data=zones_data,
                fps=actual_fps
            )
            
            yield stream_frame
            
            # Throttle to target FPS
            await asyncio.sleep(self.frame_delay)
            
            # Log progress every 5 seconds
            if frame_idx % (self.target_fps * 5) == 0:
                logger.info(f"Streamed {frame_idx} frames ({current_time:.1f}s) @ {actual_fps:.1f} FPS")
    
    def _analyze_zones(self, detections: sv.Detections, frame_idx: int) -> Dict:
        """Analyze which people are in which zones and update metrics"""
        zones_data = {}
        
        if detections.tracker_id is None or len(detections.tracker_id) == 0:
            # No detections
            for idx, zone_name in enumerate(self.zone_names):
                self.per_zone_queue_lengths[idx].append(0)
                zones_data[zone_name] = {
                    "current_count": 0,
                    "avg_wait": 0.0,
                    "max_queue": int(max(self.per_zone_queue_lengths[idx])) if self.per_zone_queue_lengths[idx] else 0
                }
            return zones_data
        
        # Get centroids
        xyxy = detections.xyxy
        centroids = []
        for box in xyxy:
            x1, y1, x2, y2 = box
            cx = (x1 + x2) / 2.0
            cy = (y1 + y2) / 2.0
            centroids.append((cx, cy))
        
        # Check which zones each person is in
        inside_per_zone: List[set] = [set() for _ in self.zones]
        
        for tid, (cx, cy) in zip(detections.tracker_id, centroids):
            for idx, poly in enumerate(self.polygons_cv2):
                if cv2.pointPolygonTest(poly, (float(cx), float(cy)), False) >= 0:
                    inside_per_zone[idx].add(tid)
                    # Update time in zone
                    self.per_zone_time_in_zone[idx][tid] = \
                        self.per_zone_time_in_zone[idx].get(tid, 0.0) + self.dt
        
        # Calculate metrics for each zone
        for idx, zone_name in enumerate(self.zone_names):
            current_count = len(inside_per_zone[idx])
            self.per_zone_queue_lengths[idx].append(current_count)
            
            # Calculate average wait time for people currently in zone
            zone_times = [
                self.per_zone_time_in_zone[idx].get(tid, 0.0)
                for tid in inside_per_zone[idx]
            ]
            avg_wait = np.mean(zone_times) if zone_times else 0.0
            
            zones_data[zone_name] = {
                "current_count": int(current_count),  # Convert to Python int
                "avg_wait": float(avg_wait),
                "max_queue": int(max(self.per_zone_queue_lengths[idx])) if self.per_zone_queue_lengths[idx] else 0,
                "people_ids": [int(tid) for tid in inside_per_zone[idx]]  # Convert numpy int64 to Python int
            }
        
        return zones_data
    
    def _annotate_frame(self, frame: np.ndarray, detections: sv.Detections, zones_data: Dict) -> np.ndarray:
        """Draw zones, detections, and metrics on frame"""
        annotated = frame.copy()
        
        # Zone colors
        zone_colors = [
            (0, 0, 255),    # Red
            (0, 255, 0),    # Green
            (255, 0, 0),    # Blue
            (0, 255, 255),  # Yellow
            (255, 0, 255),  # Magenta
        ]
        
        # Draw zones
        for idx, (poly, zone_name) in enumerate(zip(self.polygons_cv2, self.zone_names)):
            color = zone_colors[idx % len(zone_colors)]
            
            # Draw polygon
            cv2.polylines(annotated, [poly], isClosed=True, color=color, thickness=3)
            
            # Get zone metrics
            zone_metrics = zones_data.get(zone_name, {})
            current_count = zone_metrics.get("current_count", 0)
            avg_wait = zone_metrics.get("avg_wait", 0.0)
            
            # Draw zone label with metrics
            center = tuple(np.mean(poly, axis=0).astype(int).reshape(2))
            label = f"{zone_name}: {current_count} people"
            if avg_wait > 0:
                label += f" | {avg_wait:.1f}s"
            
            # Background for text
            (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            cv2.rectangle(
                annotated,
                (center[0] - 5, center[1] - text_h - 5),
                (center[0] + text_w + 5, center[1] + 5),
                (0, 0, 0),
                -1
            )
            
            cv2.putText(
                annotated,
                label,
                (center[0], center[1]),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2
            )
        
        # Draw detections
        if detections.tracker_id is not None and len(detections.tracker_id) > 0:
            for idx, (box, tid) in enumerate(zip(detections.xyxy, detections.tracker_id)):
                x1, y1, x2, y2 = box.astype(int)
                
                # Draw bounding box
                cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)
                
                # Draw tracker ID
                label = f"ID: {tid}"
                cv2.putText(
                    annotated,
                    label,
                    (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 255, 0),
                    2
                )
        
        return annotated
    
    def get_summary_stats(self) -> Dict:
        """Get accumulated statistics"""
        stats = {
            "zones": []
        }
        
        for idx, zone_name in enumerate(self.zone_names):
            # Get all wait times for this zone
            wait_times = [
                t for t in self.per_zone_time_in_zone[idx].values()
                if t >= self.min_wait_sec_filter
            ]
            
            zone_stats = {
                "zone_name": zone_name,
                "total_people_tracked": int(len(self.per_zone_time_in_zone[idx])),
                "people_measured": int(len(wait_times)),
                "avg_wait": float(np.mean(wait_times)) if wait_times else 0.0,
                "min_wait": float(np.min(wait_times)) if wait_times else 0.0,
                "max_wait": float(np.max(wait_times)) if wait_times else 0.0,
                "max_queue_length": int(max(self.per_zone_queue_lengths[idx])) if self.per_zone_queue_lengths[idx] else 0,
                "avg_queue_length": float(np.mean(self.per_zone_queue_lengths[idx])) if self.per_zone_queue_lengths[idx] else 0.0
            }
            stats["zones"].append(zone_stats)
        
        return stats
    
    def cleanup(self):
        """Release resources"""
        if self.cap:
            self.cap.release()
        logger.info("Stream processor cleaned up")
