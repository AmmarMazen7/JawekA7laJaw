import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO
import base64

def analyze_video_with_zones(video_path: str, zones: list):
    # Load YOLO model (YOLOv8s)
    model = YOLO("yolov8s.pt")

    tracker = sv.ByteTrack(minimum_matching_threshold=0.5)

    # Video information
    video_info = sv.VideoInfo.from_video_path(video_path=video_path)
    frames_generator = sv.get_video_frames_generator(video_path)

    # Prepare polygon zones
    polygons = [np.array(z["polygon"], dtype=np.int32) for z in zones]
    polygon_zones = [
        sv.PolygonZone(polygon=p, triggering_anchors=(sv.Position.CENTER,))
        for p in polygons
    ]

    sample_frames = []
    frame_id = 0

    for frame in frames_generator:
        frame_id += 1

        # YOLO inference
        results = model(frame, conf=0.3, iou=0.7)[0]

        # Convert YOLO results → Supervision detections
        detections = sv.Detections.from_ultralytics(results)
        detections = tracker.update_with_detections(detections)

        # Collect preview frames every 40 frames
        if frame_id % 40 == 0:
            _, jpeg = cv2.imencode(".jpg", frame)
            sample_frames.append(
                "data:image/jpeg;base64," + base64.b64encode(jpeg).decode("utf-8")
            )

    return {
        "sample_frames": sample_frames,
        "fps": video_info.fps,
        "frame_count": frame_id,
        "duration_sec": frame_id / video_info.fps,
        "zones": [
            {
                "zone_name": z.get("name", f"Zone {i+1}"),
                "metrics": {},
                "queue_timestamps": [],
                "queue_lengths": [],
                "wait_times": [],
            }
            for i, z in enumerate(zones)
        ]
    }
