from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO
from pathlib import Path
import tempfile
import cv2
import numpy as np
import base64
import time
import math
import os

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


# --------------------------
# Helper functions
# --------------------------
def get_first_frame(video_path: str):
    cap = cv2.VideoCapture(video_path)
    success, frame = cap.read()
    cap.release()
    if not success or frame is None:
        raise RuntimeError("Could not read first frame from video.")
    return frame  # BGR


def get_video_metadata(video_path: str):
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
    _, buf = cv2.imencode(".jpg", frame_bgr)
    jpg_bytes = buf.tobytes()
    b64 = base64.b64encode(jpg_bytes).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


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
    Same logic you had in Streamlit, but without Streamlit calls.
    roi_rect: (x1, y1, x2, y2)
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
        device=device,
        verbose=False,
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

                if (x1_roi <= cx <= x2_roi) and (y1_roi <= cy <= y2_roi):
                    in_queue_now.add(tid)
                    if tid not in enter_frame:
                        enter_frame[tid] = frame_idx

            # those who left the ROI
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

        # sample annotated frames
        if frame_idx % sample_stride == 0:
            annotated_bgr = result.plot()  # ndarray BGR
            sample_frames_b64.append(encode_image_bgr_to_base64(annotated_bgr))

    # compute statistics
    if len(wait_times) > 0:
        avg_wait = float(np.mean(wait_times))
        min_wait = float(np.min(wait_times))
        max_wait = float(np.max(wait_times))
    else:
        avg_wait = min_wait = max_wait = None

    if len(queue_lengths) > 0:
        avg_queue_len = float(np.mean(queue_lengths))
    else:
        avg_queue_len = None

    metrics = {
        "avg_wait": avg_wait,
        "min_wait": min_wait,
        "max_wait": max_wait,
        "avg_queue_len": avg_queue_len,
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


# --------------------------
# API endpoints
# --------------------------
@app.post("/upload-video")
async def upload_video(file: UploadFile = File(...)):
    # save to temp dir
    temp_dir = tempfile.mkdtemp()
    video_path = str(Path(temp_dir) / file.filename)

    with open(video_path, "wb") as f:
        content = await file.read()
        f.write(content)

    try:
        first_frame_bgr = get_first_frame(video_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    first_frame_rgb = cv2.cvtColor(first_frame_bgr, cv2.COLOR_BGR2RGB)
    h, w, _ = first_frame_rgb.shape

    # encode first frame as base64 image (we can encode RGB or BGR)
    first_frame_b64 = encode_image_bgr_to_base64(first_frame_bgr)

    # store video path and return an ID
    video_id = f"vid_{int(time.time()*1000)}"
    VIDEO_STORE[video_id] = video_path

    fps, frame_count, duration_sec = get_video_metadata(video_path)

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
