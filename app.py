import time
import json
import tempfile
from pathlib import Path

import cv2
import numpy as np
import streamlit as st
from PIL import Image
from streamlit_drawable_canvas import st_canvas
from ultralytics import YOLO


# =====================================================
# 1. Helper functions (model + video + polygons)
# =====================================================

@st.cache_resource
def load_model(model_path: str):
    """
    Load YOLO model once and reuse it.
    Device is chosen automatically (GPU if available).
    """
    model = YOLO(model_path)
    return model


def get_first_frame(video_path: str):
    """
    Read first frame of the video (BGR).
    """
    cap = cv2.VideoCapture(video_path)
    success, frame = cap.read()
    cap.release()
    if not success or frame is None:
        raise RuntimeError("Could not read first frame from video.")
    return frame


def get_video_metadata(video_path: str):
    """
    Return (fps, frame_count, duration_sec).
    """
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


def polygons_from_canvas_json(json_data):
    """
    Extract polygon points from streamlit-drawable-canvas json_data.

    We return a list of polygons, each polygon is a list of (x, y) integer points:
      [
        [(x1, y1), (x2, y2), ...],   # polygon 0
        [(x1, y1), (x2, y2), ...],   # polygon 1
        ...
      ]
    """
    if not json_data:
        return []

    polygons = []
    for obj in json_data.get("objects", []):
        obj_type = obj.get("type")

        # Native polygon from fabric.js
        if obj_type == "polygon" and "points" in obj:
            pts = obj["points"]
            poly = [
                (int(round(p["x"])), int(round(p["y"])))
                for p in pts
            ]
            if len(poly) >= 3:
                polygons.append(poly)

        # Sometimes polygons can be encoded as "path"
        elif obj_type == "path":
            path = obj.get("path", [])
            pts = []
            for seg in path:
                # Usually ["M", x, y] or ["L", x, y]
                if isinstance(seg, list) and len(seg) >= 3:
                    _, x, y = seg[:3]
                    pts.append((int(round(x)), int(round(y))))
            if len(pts) >= 3:
                polygons.append(pts)

    return polygons



def run_queue_analysis(
    model: YOLO,
    video_path: str,
    polygons,              # list[list[(x, y)]]
    fps: float,
    frame_count: int,
    conf: float = 0.4,
    min_wait_sec_filter: float = 1.0,
    sample_stride: int = 50,
):
    """
    Run YOLO tracking + queue logic on the whole video.

    polygons: list of polygons, each polygon is list of (x, y) points (in pixels).

    Returns:
      metrics: dict with global avg/min/max wait, avg queue length, etc.
      time_stamps: list of timestamps (seconds) per frame
      queue_lengths: list of global queue length per frame (people inside ANY polygon)
      sample_frames: list of BGR frames (annotated) for display (limited number)
      wait_times: list of per-person waiting times (seconds) globally
      per_polygon_metrics: list of dicts, one per polygon, with same metrics
    """

    # -------------------------------------------------
    # 0) Prepare polygon shapes for cv2.pointPolygonTest
    # -------------------------------------------------
    polygons_cv2 = [
        np.array(poly, dtype=np.int32).reshape((-1, 1, 2))
        for poly in polygons
    ]

    # -------------------------------------------------
    # 1) Accumulators à la FPSBasedTimer
    # -------------------------------------------------
    # total time (in seconds) that each track ID has spent in ANY polygon
    global_time_in_zone: dict[int, float] = {}

    # per-polygon: list of dicts track_id -> total seconds in that polygon
    per_poly_time_in_zone: list[dict[int, float]] = [
        {} for _ in polygons
    ]

    # per-frame global queue length & timestamps
    queue_lengths_global: list[int] = []
    time_stamps: list[float] = []

    # optional: per-polygon queue lengths per frame
    per_poly_queue_lengths: list[list[int]] = [
        [] for _ in polygons
    ]

    # annotated sample frames
    sample_frames: list[np.ndarray] = []

    # -------------------------------------------------
    # 2) Run YOLO tracker (like before)
    # -------------------------------------------------
    results_generator = model.track(
        source=video_path,
        stream=True,
        conf=conf,
        classes=[0],  # person class in COCO
        verbose=False,
    )

    progress_bar = st.progress(0.0)
    status_text = st.empty()

    frame_idx = 0
    last_update_time = time.time()
    dt = 1.0 / fps if fps > 0 else 0.04  # fallback ~25 fps

    for result in results_generator:
        frame_idx += 1

        # Progress UI
        if frame_count > 0 and time.time() - last_update_time > 0.1:
            progress_bar.progress(min(frame_idx / frame_count, 1.0))
            status_text.text(f"Processing frame {frame_idx}/{frame_count} ...")
            last_update_time = time.time()

        boxes = result.boxes
        if boxes is None or boxes.id is None:
            # No detections with tracking IDs on this frame
            queue_lengths_global.append(0)
            for idx in range(len(polygons)):
                per_poly_queue_lengths[idx].append(0)
            time_stamps.append(frame_idx / fps if fps > 0 else frame_idx * dt)
            continue

        ids = boxes.id.cpu().numpy().astype(int)
        xyxy = boxes.xyxy.cpu().numpy()

        in_queue_now_global: set[int] = set()
        inside_per_poly: list[set[int]] = [set() for _ in polygons]

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

        for idx in range(len(polygons)):
            for tid in inside_per_poly[idx]:
                per_poly_time_in_zone[idx][tid] = per_poly_time_in_zone[idx].get(tid, 0.0) + dt
            per_poly_queue_lengths[idx].append(len(inside_per_poly[idx]))

        queue_lengths_global.append(len(in_queue_now_global))
        time_stamps.append(frame_idx / fps if fps > 0 else frame_idx * dt)

        # -------------------------------------------------
        # 5) Save annotated frames occasionally
        # -------------------------------------------------
        if frame_idx % sample_stride == 0:
            annotated = result.plot()  # BGR ndarray

            # Draw all polygons on top for clarity
            for poly in polygons_cv2:
                cv2.polylines(
                    annotated,
                    [poly],
                    isClosed=True,
                    color=(0, 0, 255),  # red in BGR
                    thickness=2,
                )

            sample_frames.append(annotated)

    progress_bar.progress(1.0)
    status_text.text("Finished processing video.")

    # -----------------------------------------------------
    # 6) Convert timers -> wait_times lists (apply min_wait_sec_filter)
    # -----------------------------------------------------
    wait_times_global = [
        t for t in global_time_in_zone.values()
        if t >= min_wait_sec_filter
    ]

    if len(wait_times_global) > 0:
        avg_wait = float(np.mean(wait_times_global))
        min_wait = float(np.min(wait_times_global))
        max_wait = float(np.max(wait_times_global))
    else:
        avg_wait = min_wait = max_wait = None

    if len(queue_lengths_global) > 0:
        avg_queue_len = float(np.mean(queue_lengths_global))
    else:
        avg_queue_len = None

    metrics = {
        "avg_wait": avg_wait,
        "min_wait": min_wait,
        "max_wait": max_wait,
        "avg_queue_len": avg_queue_len,
        "num_people_measured": len(wait_times_global),
    }

    # -----------------------------------------------------
    # 7) Per-polygon metrics (same idea, per zone)
    # -----------------------------------------------------
    per_polygon_metrics = []
    for idx in range(len(polygons)):
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

        avg_q = float(np.mean(qs)) if qs else None

        per_polygon_metrics.append({
            "polygon_id": idx,
            "avg_wait": avg_w,
            "min_wait": min_w,
            "max_wait": max_w,
            "avg_queue_len": avg_q,
            "num_people_measured": len(poly_times),
        })

    # -----------------------------------------------------
    # 8) Limit number of sample frames (keep only a few)
    # -----------------------------------------------------
    max_samples = 6
    if len(sample_frames) > max_samples:
        step = max(1, len(sample_frames) // max_samples)
        sample_frames = sample_frames[::step][:max_samples]

    return (
        metrics,
        time_stamps,
        queue_lengths_global,
        sample_frames,
        wait_times_global,
        per_polygon_metrics,
    )




# =====================================================
# 2. Streamlit UI
# =====================================================

st.set_page_config(page_title="Smart Queue Analyzer (Polygon Zones)", layout="wide")

st.title("📊 Smart Queue Analyzer (YOLO11 + Polygon Zones + Streamlit)")
st.write(
    "Upload a queue video, **draw one or more polygon zones** on the first frame, "
    "and compute **average waiting time** for people inside those zones using YOLO11 tracking."
)

# Sidebar settings
st.sidebar.header("Settings")
model_path = st.sidebar.text_input(
    "YOLO11 model path",
    value="yolo11n.pt",
    help="Path to YOLO11 weights (e.g., yolo11n.pt or your fine-tuned .pt).",
)
conf_threshold = st.sidebar.slider(
    "Detection confidence threshold", 0.1, 0.9, 0.4, 0.05
)
min_wait_filter = st.sidebar.slider(
    "Ignore waits shorter than (seconds)",
    min_value=0.0,
    max_value=5.0,
    value=1.0,
    step=0.5,
)
sample_stride = st.sidebar.slider(
    "Save sample frame every N frames", 10, 200, 50, 10
)
smoothing_window_sec = st.sidebar.slider(
    "Queue length smoothing window (seconds, 0 = no smoothing)",
    min_value=0,
    max_value=60,
    value=10,
    step=5,
)

st.sidebar.markdown("---")
st.sidebar.write("💡 For real-time performance, start with `yolo11n.pt` (nano model).")

# =====================================================
# 3. Video upload
# =====================================================

uploaded_file = st.file_uploader(
    "Upload a queue video (.mp4, .mov, .avi, .mkv)",
    type=["mp4", "mov", "avi", "mkv"],
)

if uploaded_file is None:
    st.info("Please upload a video to begin.")
    st.stop()

# Save uploaded video to a temporary file
temp_dir = tempfile.mkdtemp()
video_path = str(Path(temp_dir) / uploaded_file.name)
with open(video_path, "wb") as f:
    f.write(uploaded_file.read())

# =====================================================
# 4. Show first frame & let user draw polygon zones
# =====================================================

first_frame_bgr = get_first_frame(video_path)
first_frame_rgb = cv2.cvtColor(first_frame_bgr, cv2.COLOR_BGR2RGB)
h, w, _ = first_frame_rgb.shape

st.subheader("1️⃣ Draw queue zone(s) as polygons")

st.write(
    "Draw one or more polygons to define the queue area(s). "
    "People are considered 'in queue' if their center is inside **any** of these polygons."
)

col_canvas, col_info = st.columns([3, 2])
print(w, h)

with col_canvas:
    canvas_result = st_canvas(
        fill_color="rgba(0, 255, 0, 0.3)",  # polygon fill
        stroke_width=2,
        stroke_color="#00FF00",
        background_image=Image.fromarray(first_frame_rgb),
        update_streamlit=True,
        height=h,
        width=w,
        drawing_mode="polygon",  # polygon drawing mode
        display_toolbar=True,
        key="queue_zone_canvas",
    )

with col_info:
    st.write(f"Frame size: **{w} x {h}** (width x height)")
    st.markdown(
        """
        **Instructions:**
        - Select the **polygon** tool in the left toolbar.
        - Click to create vertices.
        - Double-click (or use the toolbar) to close a polygon.
        - Repeat to draw multiple zone polygons if needed.
        """
    )

polygons = []
if canvas_result.json_data is not None:
    polygons = polygons_from_canvas_json(canvas_result.json_data)

st.write(f"Detected polygon zones: **{len(polygons)}**")
if polygons:
    st.expander("Preview polygon coordinates").code(
        json.dumps(polygons, indent=2), language="json"
    )

st.markdown("---")

# =====================================================
# 5. Run analysis
# =====================================================

st.subheader("2️⃣ Run queue analysis")

run_button = st.button("🚀 Run analysis", disabled=len(polygons) == 0)

if run_button:
    if not polygons:
        st.error("Please draw at least one polygon zone before running the analysis.")
        st.stop()

    st.write("Reading video metadata...")
    fps, frame_count, duration_sec = get_video_metadata(video_path)
    st.write(f"- FPS: **{fps:.2f}**")
    st.write(f"- Frames: **{frame_count}**")
    st.write(f"- Duration: **{duration_sec:.1f} seconds**")

    with st.spinner("Running YOLO tracking and computing waiting times inside polygon zones..."):
        model = load_model(model_path)
        (
            metrics,
            times,
            queue_lengths,
            sample_frames,
            wait_times,
            per_polygon_metrics,
        ) = run_queue_analysis(
            model=model,
            video_path=video_path,
            polygons=polygons,
            fps=fps,
            frame_count=frame_count,
            conf=conf_threshold,
            min_wait_sec_filter=min_wait_filter,
            sample_stride=sample_stride,
        )

    st.success("Analysis complete ✅")

    # =================================================
    # 6. Show global metrics
    # =================================================
    st.subheader("3️⃣ Global results (all zones combined)")

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric(
            "Average waiting time (s)",
            f"{metrics['avg_wait']:.2f}"
            if metrics["avg_wait"] is not None
            else "N/A",
        )
    with col2:
        st.metric(
            "Min waiting time (s)",
            f"{metrics['min_wait']:.2f}"
            if metrics["min_wait"] is not None
            else "N/A",
        )
    with col3:
        st.metric(
            "Max waiting time (s)",
            f"{metrics['max_wait']:.2f}"
            if metrics["max_wait"] is not None
            else "N/A",
        )
    with col4:
        st.metric(
            "Avg queue length (people in any polygon)",
            f"{metrics['avg_queue_len']:.2f}"
            if metrics["avg_queue_len"] is not None
            else "N/A",
        )

    st.write(
        f"Number of people with measured waiting time: "
        f"**{metrics['num_people_measured']}**"
    )

    # =================================================
    # 7. Per-polygon metrics
    # =================================================
    if per_polygon_metrics:
        st.subheader("4️⃣ Per-zone results")

        for idx, pm in enumerate(per_polygon_metrics):
            st.markdown(f"#### Zone {idx + 1}")

            c1, c2, c3, c4 = st.columns(4)
            with c1:
                st.metric(
                    "Avg wait (s)",
                    f"{pm['avg_wait']:.2f}"
                    if pm["avg_wait"] is not None
                    else "N/A",
                )
            with c2:
                st.metric(
                    "Min wait (s)",
                    f"{pm['min_wait']:.2f}"
                    if pm["min_wait"] is not None
                    else "N/A",
                )
            with c3:
                st.metric(
                    "Max wait (s)",
                    f"{pm['max_wait']:.2f}"
                    if pm["max_wait"] is not None
                    else "N/A",
                )
            with c4:
                st.metric(
                    "Avg queue length",
                    f"{pm['avg_queue_len']:.2f}"
                    if pm["avg_queue_len"] is not None
                    else "N/A",
                )

            st.write(
                f"People measured in this zone: "
                f"**{pm['num_people_measured']}**"
            )
            st.markdown("---")

    # =================================================
    # 8. Smoothed queue length over time (global)
    # =================================================
    if len(times) > 0 and len(queue_lengths) > 0:
        st.subheader("📈 Queue length over time (global, smoothed)")

        times_arr = np.array(times)
        q_arr = np.array(queue_lengths)

        if smoothing_window_sec > 0:
            # Bin-based smoothing: average queue length per X seconds
            bin_indices = (times_arr // smoothing_window_sec).astype(int)
            unique_bins = np.unique(bin_indices)

            smooth_times = []
            smooth_q = []

            for b in unique_bins:
                mask = bin_indices == b
                if not np.any(mask):
                    continue
                # You can also use median here if you want
                smooth_times.append(times_arr[mask].mean())
                smooth_q.append(q_arr[mask].mean())

            chart_data = {
                "time_s": smooth_times,
                "queue_length": smooth_q,
            }
        else:
            # No smoothing
            chart_data = {
                "time_s": times,
                "queue_length": queue_lengths,
            }

        st.line_chart(chart_data, x="time_s", y="queue_length")
    else:
        st.info("No queue length data recorded.")

    # Waiting time distribution (global)
    if len(wait_times) > 0:
        st.subheader("⏱ Distribution of waiting times (global)")
        hist_vals, hist_edges = np.histogram(wait_times, bins=10)
        hist_chart_data = {
            "bin_start": hist_edges[:-1],
            "count": hist_vals,
        }
        st.bar_chart(hist_chart_data, x="bin_start", y="count")
    else:
        st.info(
            "No waiting times measured. Maybe nobody stayed inside the polygon zones long enough?"
        )

    # Sample frames (limited)
    if len(sample_frames) > 0:
        st.subheader("🖼 Sample annotated frames (limited)")
        st.write(
            "These frames show YOLO detections and tracking IDs. "
            "The queue region(s) are the polygon(s) you drew."
        )
        sample_imgs_rgb = [
            cv2.cvtColor(f, cv2.COLOR_BGR2RGB) for f in sample_frames
        ]
        st.image(
            sample_imgs_rgb,
            caption=[f"Sample frame {i+1}" for i in range(len(sample_imgs_rgb))],
        )
    else:
        st.info(
            "No sample frames saved. You can lower `sample_stride` in the sidebar to save more."
        )
