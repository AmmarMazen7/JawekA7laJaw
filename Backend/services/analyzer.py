import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO
import logging
import time

logger = logging.getLogger(__name__)

def analyze_video_with_zones(
    video_path: str, 
    zones: list,
    output_video_path: str,
    conf: float = 0.4,
    min_wait_sec_filter: float = 1.0,
    sample_stride: int = 1
):
    """
    Analyze video with multiple zones and generate annotated output video.
    
    Args:
        video_path: Path to input video
        zones: List of zone dictionaries with 'name' and 'polygon' keys
        output_video_path: Path to save annotated video
        conf: Confidence threshold for detections
        min_wait_sec_filter: Minimum wait time to count a person
        sample_stride: Process every Nth frame (1 = all frames)
    """
    # Load YOLO model
    model = YOLO("yolov8s.pt")
    
    # Get video info
    video_info = sv.VideoInfo.from_video_path(video_path=video_path)
    fps = video_info.fps
    frame_count = video_info.total_frames
    
    logger.info(f"Processing video: {video_path}")
    logger.info(f"FPS: {fps}, Frames: {frame_count}, Duration: {frame_count/fps:.1f}s")
    logger.info(f"Analyzing {len(zones)} zones")
    
    # Prepare polygon zones
    polygons_cv2 = [
        np.array(z["polygon"], dtype=np.int32).reshape((-1, 1, 2))
        for z in zones
    ]
    zone_names = [z.get("name", f"Zone {i+1}") for i, z in enumerate(zones)]
    
    # Initialize video writer
    cap = cv2.VideoCapture(video_path)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    video_writer = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
    
    # Tracking data structures
    per_poly_time_in_zone = [{}  for _ in zones]
    per_poly_queue_lengths = [[] for _ in zones]
    time_stamps = []
    
    dt = 1.0 / fps if fps > 0 else 0.04
    
    # Run YOLO tracking
    results_generator = model.track(
        source=video_path,
        stream=True,
        conf=conf,
        classes=[0],  # person class
        device="0",
        verbose=False,
        persist=True,
    )
    
    frame_idx = 0
    last_log_time = time.time()
    
    zone_colors = [
        (0, 0, 255),    # Red (BGR)
        (0, 255, 0),    # Green
        (255, 0, 0),    # Blue
        (0, 255, 255),  # Yellow
        (255, 255, 255) # White
    ]
    
    for result in results_generator:
        frame_idx += 1
        
        # Log progress
        if time.time() - last_log_time > 2.0:
            progress = (frame_idx / frame_count * 100) if frame_count > 0 else 0
            logger.info(f"Processing frame {frame_idx}/{frame_count} ({progress:.1f}%)")
            last_log_time = time.time()
        
        boxes = result.boxes
        inside_per_poly = [set() for _ in zones]
        
        if boxes is not None and boxes.id is not None:
            ids = boxes.id.cpu().numpy().astype(int)
            xyxy = boxes.xyxy.cpu().numpy()
            
            # Determine which tracks are inside which polygons
            for tid, box in zip(ids, xyxy):
                x1, y1, x2, y2 = box
                cx = (x1 + x2) / 2.0
                cy = (y1 + y2) / 2.0
                
                for idx, poly in enumerate(polygons_cv2):
                    if cv2.pointPolygonTest(poly, (float(cx), float(cy)), False) >= 0:
                        inside_per_poly[idx].add(tid)
            
            # Update time in zone for each person
            for idx in range(len(zones)):
                for tid in inside_per_poly[idx]:
                    per_poly_time_in_zone[idx][tid] = per_poly_time_in_zone[idx].get(tid, 0.0) + dt
                per_poly_queue_lengths[idx].append(len(inside_per_poly[idx]))
        else:
            for idx in range(len(zones)):
                per_poly_queue_lengths[idx].append(0)
        
        time_stamps.append(frame_idx / fps if fps > 0 else frame_idx * dt)
        
        # Annotate and write frame
        if frame_idx % sample_stride == 0:
            annotated = result.plot()
            
            # Draw all polygons
            for idx, poly in enumerate(polygons_cv2):
                color_bgr = zone_colors[idx % len(zone_colors)]
                
                cv2.polylines(
                    annotated,
                    [poly],
                    isClosed=True,
                    color=color_bgr,
                    thickness=3,
                )
                
                # Draw zone name and count
                center = tuple(np.mean(poly, axis=0).astype(int).reshape(2))
                text = f"{zone_names[idx]}: {len(inside_per_poly[idx])}"
                cv2.putText(
                    annotated,
                    text,
                    center,
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 255),
                    2
                )
            
            video_writer.write(annotated)
    
    video_writer.release()
    logger.info(f"Finished processing {frame_idx} frames")
    logger.info(f"Annotated video saved to: {output_video_path}")
    
    # Calculate metrics per zone
    results_per_zone = []
    for idx in range(len(zones)):
        poly_times = [
            t for t in per_poly_time_in_zone[idx].values()
            if t >= min_wait_sec_filter
        ]
        qs = per_poly_queue_lengths[idx]
        
        if poly_times:
            avg_w = float(np.mean(poly_times))
            min_w = float(np.min(poly_times))
            max_w = float(np.max(poly_times))
        else:
            avg_w = min_w = max_w = None
        
        if qs:
            avg_q = float(np.mean(qs))
            max_q = int(np.max(qs))
        else:
            avg_q = None
            max_q = 0
        
        results_per_zone.append({
            "zone_name": zone_names[idx],
            "polygon_id": idx,
            "metrics": {
                "avg_wait": avg_w,
                "min_wait": min_w,
                "max_wait": max_w,
                "avg_queue_len": avg_q,
                "max_queue_len": max_q,
                "num_people_measured": len(poly_times),
                "total_people_tracked": len(per_poly_time_in_zone[idx]),
            },
            "queue_timestamps": [float(t) for t in time_stamps],
            "queue_lengths": qs,
            "wait_times": poly_times,
        })
    
    return {
        "zones": results_per_zone,
        "fps": fps,
        "frame_count": frame_idx,
        "duration_sec": frame_idx / fps,
    }
