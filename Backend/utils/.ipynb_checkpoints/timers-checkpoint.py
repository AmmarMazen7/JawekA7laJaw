from datetime import datetime
import numpy as np
import supervision as sv

class FPSBasedTimer:
    def __init__(self, fps: int = 30):
        self.fps = fps
        self.frame_id = 0
        self.tracker_id2frame_id = {}

    def tick(self, detections: sv.Detections) -> np.ndarray:
        self.frame_id += 1
        times = []
        for tracker_id in detections.tracker_id:
            self.tracker_id2frame_id.setdefault(tracker_id, self.frame_id)
            start_frame = self.tracker_id2frame_id[tracker_id]
            times.append((self.frame_id - start_frame) / self.fps)
        return np.array(times)

class ClockBasedTimer:
    def __init__(self):
        self.tracker_id2start_time = {}

    def tick(self, detections: sv.Detections) -> np.ndarray:
        current_time = datetime.now()
        times = []
        for tracker_id in detections.tracker_id:
            self.tracker_id2start_time.setdefault(tracker_id, current_time)
            start_time = self.tracker_id2start_time[tracker_id]
            times.append((current_time - start_time).total_seconds())
        return np.array(times)
