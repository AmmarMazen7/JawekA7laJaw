from datetime import datetime, timedelta
from typing import Dict, Optional
import numpy as np  
import supervision as supervision



class FPSBasedTimer:
    def __init__(self, fps: int=30) -> None:
        self.fps = fps
        self.frame_id = 0
        self.tracker_id2frame_id: Dict[int, int] = {}
    
    def ticks(self, detections: sv.Detections) -> np.ndarray:
        self.frame_id += 1
        ticks = np.zeros(len(detections), dtype=bool)

        for idx, tracker_id in enumerate(detections.tracker_id):
            if tracker_id is None:
                continue
            
            if tracker_id not in self.tracker_id2frame_id:
                self.tracker_id2frame_id[tracker_id] = self.frame_id
                ticks[idx] = True
            else:
                last_frame_id = self.tracker_id2frame_id[tracker_id]
                if (self.frame_id - last_frame_id) >= self.fps:
                    self.tracker_id2frame_id[tracker_id] = self.frame_id
                    ticks[idx] = True
        
        return ticks
