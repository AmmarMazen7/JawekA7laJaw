from pydantic import BaseModel
from typing import List

class Zone(BaseModel):
    name: str
    polygon: List[List[int]]

class ZoneRequest(BaseModel):
    video_id: str
    zones: List[Zone]
    conf: float = 0.4
    min_wait_sec_filter: float = 1.0
    sample_stride: int = 1
