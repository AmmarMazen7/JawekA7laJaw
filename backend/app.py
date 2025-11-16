from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from ultralytics import YOLO
from pathlib import Path
import tempfile
import cv2
import numpy as np
import base64
import time
import os
import supervision as sv
from datetime import datetime
import logging

# Configure comprehensive logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('queue_analysis.log')
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Allow React dev server requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # in prod, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------
# Global model + video store
# --------------------------
MODEL_PATH = "yolo11n.pt"  # adjust if you have a custom model
DEVICE = "0"  # GPU 0, or "cpu"

model = YOLO(MODEL_PATH)

# Simple in-memory mapping: video_id -> path
VIDEO_STORE = {}

# Store output videos: video_id -> output_video_path
OUTPUT_VIDEO_STORE = {}


# --------------------------
# Helper classes
# --------------------------
class FPSBasedTimer:
    """Timer that calculates duration based on FPS"""
    def __init__(self, fps: int = 30) -> None:
        self.fps = fps
        self.frame_id = 0
        self.tracker_id2frame_id: dict[int, int] = {}

    def tick(self, detections: sv.Detections) -> np.ndarray:
        """Update timer for current frame detections"""
        self.frame_id += 1
        times = []
        
        if detections.tracker_id is None or len(detections.tracker_id) == 0:
            return np.array([])

        for tracker_id in detections.tracker_id:
            self.tracker_id2frame_id.setdefault(tracker_id, self.frame_id)
            start_frame_id = self.tracker_id2frame_id[tracker_id]
            time_duration = (self.frame_id - start_frame_id) / self.fps
            times.append(time_duration)

        return np.array(times)


# --------------------------
# Helper functions
# --------------------------
def get_first_frame(video_path: str):
    """Extract the first frame from a video file"""
    cap = cv2.VideoCapture(video_path)
    success, frame = cap.read()
    cap.release()
    if not success or frame is None:
        raise RuntimeError("Could not read first frame from video.")
    return frame  # BGR


def get_video_metadata(video_path: str):
    """Extract FPS, frame count, and duration from video"""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError("Could not open video file.")
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 25.0  # fallback
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_sec = frame_count / fps if frame_count > 0 else 0
    cap.release()
    return fps, frame_count, duration_sec


def encode_image_bgr_to_base64(frame_bgr):
    """Convert BGR image to base64 JPEG string"""
    _, buf = cv2.imencode(".jpg", frame_bgr)
    jpg_bytes = buf.tobytes()
    b64 = base64.b64encode(jpg_bytes).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


def run_multi_zone_analysis(
    model: YOLO,
    video_path: str,
    zones_polygons: list[list[list[int]]],  # List of polygons, each polygon is list of [x,y] points
    zone_names: list[str],
    fps: float,
    frame_count: int,
    output_video_path: str,  # Path to save annotated video
    conf: float = 0.4,
    device: str = "0",
    sample_stride: int = 1,  # Process every frame by default for video output
    min_wait_sec_filter: float = 1.0,
):
    """
    Multi-zone queue analysis using FPS-based timer.
    Tracks people across zones and calculates per-zone and global metrics.
    Saves an annotated video showing zones and tracking.
    
    Args:
        model: YOLO model instance
        video_path: Path to video file
        zones_polygons: List of zones, each zone is a list of [x,y] coordinate pairs
        zone_names: Names for each zone (e.g., ["Queue 1", "Queue 2", "Checkout 1"])
        fps: Video frames per second
        frame_count: Total number of frames in video
        output_video_path: Path where annotated video will be saved
        conf: Confidence threshold for detections
        device: Device to run model on ("0" for GPU, "cpu" for CPU)
        sample_stride: Process every Nth frame (1 = all frames)
        min_wait_sec_filter: Minimum wait time to count a person
    
    Returns:
        results_per_zone: Per-zone metrics and time series data
        output_video_path: Path to saved annotated video
    """
    
    logger.info(f"Starting multi-zone analysis on {video_path}")
    logger.info(f"Video metadata: fps={fps:.2f}, frames={frame_count}, duration={frame_count/fps:.1f}s")
    logger.info(f"Analyzing {len(zones_polygons)} zones: {zone_names}")
    logger.info(f"Output video will be saved to: {output_video_path}")
    logger.info(f"Config: conf={conf}, sample_stride={sample_stride}, min_wait_filter={min_wait_sec_filter}s")
    
    # -------------------------------------------------
    # 0) Prepare polygon shapes for cv2.pointPolygonTest
    # -------------------------------------------------
    polygons_cv2 = [
        np.array(poly, dtype=np.int32).reshape((-1, 1, 2))
        for poly in zones_polygons
    ]
    logger.info(f"Prepared {len(polygons_cv2)} polygon zones for analysis")
    
    # -------------------------------------------------
    # 1) Accumulators for tracking
    # -------------------------------------------------
    # Global: total time (in seconds) that each track ID has spent in ANY polygon
    global_time_in_zone: dict[int, float] = {}
    
    # Per-polygon: list of dicts track_id -> total seconds in that polygon
    per_poly_time_in_zone: list[dict[int, float]] = [
        {} for _ in zones_polygons
    ]
    
    # Per-frame global queue length & timestamps
    queue_lengths_global: list[int] = []
    time_stamps: list[float] = []
    
    # Per-polygon queue lengths per frame
    per_poly_queue_lengths: list[list[int]] = [
        [] for _ in zones_polygons
    ]
    
    # -------------------------------------------------
    # Get video dimensions for output video writer
    # -------------------------------------------------
    cap = cv2.VideoCapture(video_path)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    
    # Initialize video writer for annotated output
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')  # MP4 codec
    video_writer = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
    logger.info(f"Initialized video writer: {width}x{height} @ {fps:.2f} FPS")
    
    # -------------------------------------------------
    # 2) Run YOLO tracker
    # -------------------------------------------------
    logger.info("Starting YOLO tracking...")
    results_generator = model.track(
        source=video_path,
        stream=True,
        conf=conf,
        classes=[0],  # person class in COCO
        device=device,
        verbose=False,
        persist=True,  # Important for tracking across frames
    )
    
    frame_idx = 0
    last_log_time = time.time()
    dt = 1.0 / fps if fps > 0 else 0.04  # Time delta per frame
    
    for result in results_generator:
        frame_idx += 1
        
        # Log progress every 2 seconds
        if time.time() - last_log_time > 2.0:
            progress = (frame_idx / frame_count * 100) if frame_count > 0 else 0
            logger.info(f"Processing frame {frame_idx}/{frame_count} ({progress:.1f}%)")
            last_log_time = time.time()
        
        boxes = result.boxes
        
        if boxes is None or boxes.id is None:
            # No detections with tracking IDs on this frame
            queue_lengths_global.append(0)
            for idx in range(len(zones_polygons)):
                per_poly_queue_lengths[idx].append(0)
            time_stamps.append(frame_idx / fps if fps > 0 else frame_idx * dt)
            continue
        
        ids = boxes.id.cpu().numpy().astype(int)
        xyxy = boxes.xyxy.cpu().numpy()
        
        in_queue_now_global: set[int] = set()
        inside_per_poly: list[set[int]] = [set() for _ in zones_polygons]
        
        # -------------------------------------------------
        # 3) Determine which tracks are inside which polygons
        # -------------------------------------------------
        for tid, box in zip(ids, xyxy):
            x1, y1, x2, y2 = box
            cx = (x1 + x2) / 2.0
            cy = (y1 + y2) / 2.0
            
            inside_any = False
            for idx, poly in enumerate(polygons_cv2):
                if cv2.pointPolygonTest(poly, (float(cx), float(cy)), False) >= 0:
                    inside_any = True
                    inside_per_poly[idx].add(tid)
            
            if inside_any:
                in_queue_now_global.add(tid)
        
        # -------------------------------------------------
        # 4) "Timer tick": add dt for everyone currently inside
        # -------------------------------------------------
        for tid in in_queue_now_global:
            global_time_in_zone[tid] = global_time_in_zone.get(tid, 0.0) + dt
        
        for idx in range(len(zones_polygons)):
            for tid in inside_per_poly[idx]:
                per_poly_time_in_zone[idx][tid] = per_poly_time_in_zone[idx].get(tid, 0.0) + dt
            per_poly_queue_lengths[idx].append(len(inside_per_poly[idx]))
        
        queue_lengths_global.append(len(in_queue_now_global))
        time_stamps.append(frame_idx / fps if fps > 0 else frame_idx * dt)
        
        # -------------------------------------------------
        # 5) Annotate and write frame to output video
        # -------------------------------------------------
        if frame_idx % sample_stride == 0:
            annotated = result.plot()  # BGR ndarray
            
            # Draw all polygons on top
            zone_colors = [
                sv.Color.RED,
                sv.Color.GREEN,
                sv.Color.BLUE,
                sv.Color.YELLOW,
                sv.Color.WHITE,
            ]
            
            for idx, poly in enumerate(polygons_cv2):
                color_rgb = zone_colors[idx % len(zone_colors)]
                # Convert sv.Color to BGR tuple
                color_bgr = (color_rgb.b, color_rgb.g, color_rgb.r)
                
                cv2.polylines(
                    annotated,
                    [poly],
                    isClosed=True,
                    color=color_bgr,
                    thickness=3,
                )
                
                # Draw zone name and current count
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
            
            # Write frame to video
            video_writer.write(annotated)
    
    # Release video writer
    video_writer.release()
    logger.info(f"Finished processing {frame_idx} frames")
    logger.info(f"Annotated video saved to: {output_video_path}")
    logger.info(f"Tracked {len(global_time_in_zone)} unique people globally")
    
    # -----------------------------------------------------
    # 6) Convert timers -> wait_times lists (apply min_wait_sec_filter)
    # -----------------------------------------------------
    wait_times_global = [
        t for t in global_time_in_zone.values()
        if t >= min_wait_sec_filter
    ]
    
    logger.info(f"Global: {len(wait_times_global)} people with wait time >= {min_wait_sec_filter}s")
    
    if len(wait_times_global) > 0:
        avg_wait = float(np.mean(wait_times_global))
        min_wait = float(np.min(wait_times_global))
        max_wait = float(np.max(wait_times_global))
        logger.info(f"Global wait times - avg: {avg_wait:.2f}s, min: {min_wait:.2f}s, max: {max_wait:.2f}s")
    else:
        avg_wait = min_wait = max_wait = None
        logger.warning("No global wait times recorded (all below threshold)")
    
    if len(queue_lengths_global) > 0:
        avg_queue_len = float(np.mean(queue_lengths_global))
        max_queue_len = int(np.max(queue_lengths_global))
        logger.info(f"Global queue - avg length: {avg_queue_len:.2f}, max: {max_queue_len}")
    else:
        avg_queue_len = None
        max_queue_len = 0
    
    # -----------------------------------------------------
    # 7) Per-polygon metrics
    # -----------------------------------------------------
    results_per_zone = []
    for idx in range(len(zones_polygons)):
        poly_times = [
            t for t in per_poly_time_in_zone[idx].values()
            if t >= min_wait_sec_filter
        ]
        qs = per_poly_queue_lengths[idx]
        
        logger.info(f"Zone '{zone_names[idx]}': {len(per_poly_time_in_zone[idx])} tracked, {len(poly_times)} above threshold")
        
        if poly_times:
            avg_w = float(np.mean(poly_times))
            min_w = float(np.min(poly_times))
            max_w = float(np.max(poly_times))
            logger.info(f"  Wait times - avg: {avg_w:.2f}s, min: {min_w:.2f}s, max: {max_w:.2f}s")
        else:
            avg_w = min_w = max_w = None
            logger.warning(f"  No wait times above threshold for zone '{zone_names[idx]}'")
        
        if qs:
            avg_q = float(np.mean(qs))
            max_q = int(np.max(qs))
            logger.info(f"  Queue length - avg: {avg_q:.2f}, max: {max_q}")
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
    
    logger.info("Multi-zone analysis complete!")
    
    return results_per_zone, output_video_path


def run_queue_analysis(
    model: YOLO,
    video_path: str,
    roi_rect: tuple,
    fps: float,
    frame_count: int,
    conf: float = 0.4,
    device: str = "0",
    sample_stride: int = 40,
    min_wait_sec_filter: float = 1.0,
):
    """
    Single-zone queue analysis using rectangular ROI.
    
    Args:
        model: YOLO model instance
        video_path: Path to video file
        roi_rect: (x1, y1, x2, y2) rectangle defining the queue area
        fps: Video frames per second
        frame_count: Total number of frames
        conf: Confidence threshold for detections
        device: Device to run model on
        sample_stride: Save annotated frame every N frames
        min_wait_sec_filter: Minimum wait time to count
    
    Returns:
        Tuple of (metrics, timestamps, queue_lengths, sample_frames, wait_times)
    """
    x1_roi, y1_roi, x2_roi, y2_roi = roi_rect

    enter_frame = {}               # track_id -> frame index when it entered ROI
    wait_times = []                # list of waiting times in seconds
    queue_lengths = []             # queue length per frame
    queue_timestamps = []          # in seconds
    sample_frames_b64 = []         # annotated frames as base64

    results_generator = model.track(
        source=video_path,
        stream=True,
        conf=conf,
        classes=[0],  # person class
        device=device,
        verbose=False,
        persist=True,
    )

    frame_idx = 0

    for result in results_generator:
        frame_idx += 1
        boxes = result.boxes

        if boxes is None or boxes.id is None:
            queue_lengths.append(0)
            queue_timestamps.append(frame_idx / fps)
        else:
            ids = boxes.id.cpu().numpy().astype(int)
            xyxy = boxes.xyxy.cpu().numpy()

            in_queue_now = set()
            for tid, box in zip(ids, xyxy):
                x1, y1, x2, y2 = box
                cx = (x1 + x2) / 2.0
                cy = (y1 + y2) / 2.0

                # Check if center point is inside ROI
                if (x1_roi <= cx <= x2_roi) and (y1_roi <= cy <= y2_roi):
                    in_queue_now.add(tid)
                    if tid not in enter_frame:
                        enter_frame[tid] = frame_idx

            # Calculate wait times for people who left the ROI
            prev_ids = list(enter_frame.keys())
            for tid in prev_ids:
                if tid not in in_queue_now:
                    frames_waited = frame_idx - enter_frame[tid]
                    time_waited = frames_waited / fps
                    if time_waited >= min_wait_sec_filter:
                        wait_times.append(time_waited)
                    del enter_frame[tid]

            queue_lengths.append(len(in_queue_now))
            queue_timestamps.append(frame_idx / fps)

        # Sample annotated frames
        if frame_idx % sample_stride == 0:
            annotated_bgr = result.plot()  # ndarray BGR
            # Draw ROI rectangle on the frame
            cv2.rectangle(
                annotated_bgr,
                (int(x1_roi), int(y1_roi)),
                (int(x2_roi), int(y2_roi)),
                (0, 255, 0),  # Green
                3
            )
            sample_frames_b64.append(encode_image_bgr_to_base64(annotated_bgr))

    # Compute statistics
    if len(wait_times) > 0:
        avg_wait = float(np.mean(wait_times))
        min_wait = float(np.min(wait_times))
        max_wait = float(np.max(wait_times))
    else:
        avg_wait = min_wait = max_wait = None

    if len(queue_lengths) > 0:
        avg_queue_len = float(np.mean(queue_lengths))
        max_queue_len = int(np.max(queue_lengths))
    else:
        avg_queue_len = None
        max_queue_len = 0

    metrics = {
        "avg_wait": avg_wait,
        "min_wait": min_wait,
        "max_wait": max_wait,
        "avg_queue_len": avg_queue_len,
        "max_queue_len": max_queue_len,
        "num_people_measured": len(wait_times),
    }

    return metrics, queue_timestamps, queue_lengths, sample_frames_b64, wait_times


# --------------------------
# Request models
# --------------------------
class AnalyzeRequest(BaseModel):
    video_id: str
    roi: tuple  # [x1, y1, x2, y2]
    conf: float = 0.4
    min_wait_sec_filter: float = 1.0
    sample_stride: int = 40


class Zone(BaseModel):
    name: str
    polygon: list[list[int]]  # List of [x, y] coordinate pairs


class MultiZoneAnalyzeRequest(BaseModel):
    video_id: str
    zones: list[Zone]  # Multiple zones, each with name and polygon
    conf: float = 0.4
    min_wait_sec_filter: float = 1.0
    sample_stride: int = 40


# --------------------------
# API endpoints
# --------------------------
@app.post("/upload-video")
async def upload_video(file: UploadFile = File(...)):
    """Upload a video file and extract metadata"""
    logger.info("=" * 80)
    logger.info("VIDEO UPLOAD REQUEST")
    logger.info("=" * 80)
    logger.info(f"Filename: {file.filename}")
    logger.info(f"Content type: {file.content_type}")
    
    # Save to temp dir
    temp_dir = tempfile.mkdtemp()
    video_path = str(Path(temp_dir) / file.filename)
    
    logger.info(f"Saving to: {video_path}")

    with open(video_path, "wb") as f:
        content = await file.read()
        file_size_mb = len(content) / (1024 * 1024)
        f.write(content)
    
    logger.info(f"File size: {file_size_mb:.2f} MB")

    try:
        first_frame_bgr = get_first_frame(video_path)
        logger.info(f"Extracted first frame: {first_frame_bgr.shape}")
    except Exception as e:
        logger.error(f"Failed to extract first frame: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

    first_frame_rgb = cv2.cvtColor(first_frame_bgr, cv2.COLOR_BGR2RGB)
    h, w, _ = first_frame_rgb.shape

    # Encode first frame as base64 image
    first_frame_b64 = encode_image_bgr_to_base64(first_frame_bgr)

    # Store video path and return an ID
    video_id = f"vid_{int(time.time()*1000)}"
    VIDEO_STORE[video_id] = video_path
    
    logger.info(f"Generated video ID: {video_id}")

    fps, frame_count, duration_sec = get_video_metadata(video_path)
    
    logger.info(f"Video metadata:")
    logger.info(f"  - Resolution: {w}x{h}")
    logger.info(f"  - FPS: {fps:.2f}")
    logger.info(f"  - Frames: {frame_count}")
    logger.info(f"  - Duration: {duration_sec:.1f}s")
    logger.info(f"✅ Upload successful!")
    logger.info("=" * 80)

    return {
        "video_id": video_id,
        "width": w,
        "height": h,
        "first_frame": first_frame_b64,
        "fps": fps,
        "frame_count": frame_count,
        "duration_sec": duration_sec,
    }


@app.post("/analyze")
async def analyze_queue(req: AnalyzeRequest):
    """Analyze a single queue zone using rectangular ROI"""
    if req.video_id not in VIDEO_STORE:
        raise HTTPException(status_code=404, detail="Unknown video_id")

    video_path = VIDEO_STORE[req.video_id]

    try:
        fps, frame_count, duration_sec = get_video_metadata(video_path)
        metrics, times, queue_lengths, sample_frames_b64, wait_times = run_queue_analysis(
            model=model,
            video_path=video_path,
            roi_rect=tuple(req.roi),
            fps=fps,
            frame_count=frame_count,
            conf=req.conf,
            device=DEVICE,
            sample_stride=req.sample_stride,
            min_wait_sec_filter=req.min_wait_sec_filter,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "metrics": metrics,
        "times": times,
        "queue_lengths": queue_lengths,
        "sample_frames": sample_frames_b64,
        "wait_times": wait_times,
        "fps": fps,
        "frame_count": frame_count,
        "duration_sec": duration_sec,
    }


@app.post("/analyze-multi-zone")
async def analyze_multi_zone(req: MultiZoneAnalyzeRequest):
    """
    Analyze multiple zones (queues) in a video.
    Each zone can be a polygon, allowing for flexible queue shapes.
    Perfect for supermarkets with multiple checkout lanes.
    """
    logger.info("=" * 80)
    logger.info("MULTI-ZONE ANALYSIS REQUEST")
    logger.info("=" * 80)
    
    if req.video_id not in VIDEO_STORE:
        logger.error(f"Video ID not found: {req.video_id}")
        raise HTTPException(status_code=404, detail="Unknown video_id")

    video_path = VIDEO_STORE[req.video_id]
    logger.info(f"Video ID: {req.video_id}")
    logger.info(f"Video path: {video_path}")

    try:
        logger.info(f"Request parameters:")
        logger.info(f"  - Number of zones: {len(req.zones)}")
        logger.info(f"  - Confidence threshold: {req.conf}")
        logger.info(f"  - Min wait filter: {req.min_wait_sec_filter}s")
        logger.info(f"  - Sample stride: {req.sample_stride}")
        
        for i, zone in enumerate(req.zones):
            logger.info(f"  - Zone {i+1}: '{zone.name}' with {len(zone.polygon)} polygon points")
        
        fps, frame_count, duration_sec = get_video_metadata(video_path)
        logger.info(f"Video metadata: fps={fps:.2f}, frames={frame_count}, duration={duration_sec:.1f}s")
        
        # Create output video path
        output_dir = tempfile.mkdtemp()
        output_video_path = str(Path(output_dir) / f"annotated_{req.video_id}.mp4")
        
        # Extract polygons and names from zones
        zones_polygons = [zone.polygon for zone in req.zones]
        zone_names = [zone.name for zone in req.zones]
        
        # Run comprehensive analysis
        results_per_zone, saved_video_path = run_multi_zone_analysis(
            model=model,
            video_path=video_path,
            zones_polygons=zones_polygons,
            zone_names=zone_names,
            fps=fps,
            frame_count=frame_count,
            output_video_path=output_video_path,
            conf=req.conf,
            device=DEVICE,
            sample_stride=req.sample_stride,
            min_wait_sec_filter=req.min_wait_sec_filter,
        )
        
        # Store output video path for later retrieval
        OUTPUT_VIDEO_STORE[req.video_id] = saved_video_path
        
        logger.info(f"✅ Analysis complete!")
        logger.info(f"Output video saved: {saved_video_path}")
        logger.info(f"Analyzed {len(results_per_zone)} zones")
        
        # Log summary for each zone
        for zone_result in results_per_zone:
            logger.info(f"Zone '{zone_result['zone_name']}' summary:")
            metrics = zone_result['metrics']
            if metrics['avg_wait']:
                logger.info(f"  Avg wait: {metrics['avg_wait']:.2f}s")
            else:
                logger.info(f"  Avg wait: N/A")
            logger.info(f"  People measured: {metrics['num_people_measured']}")
        
        logger.info("=" * 80)
        
    except Exception as e:
        import traceback
        logger.error("❌ ANALYSIS FAILED")
        logger.error(f"Exception: {str(e)}")
        logger.error(f"Traceback:\n{traceback.format_exc()}")
        logger.error("=" * 80)
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "zones": results_per_zone,
        "output_video_url": f"/download-video/{req.video_id}",
        "fps": fps,
        "frame_count": frame_count,
        "duration_sec": duration_sec,
    }


@app.get("/download-video/{video_id}")
async def download_video(video_id: str):
    """
    Download or stream the annotated output video.
    """
    if video_id not in OUTPUT_VIDEO_STORE:
        raise HTTPException(status_code=404, detail="Output video not found. Please run analysis first.")
    
    output_path = OUTPUT_VIDEO_STORE[video_id]
    
    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Output video file not found on disk.")
    
    logger.info(f"Serving output video: {output_path}")
    
    return FileResponse(
        output_path,
        media_type="video/mp4",
        filename=f"annotated_{video_id}.mp4"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)