from pydantic import BaseModel
from typing import List

class Zone(BaseModel):
    name: str
    polygon: List[List[int]]

class ZoneRequest(BaseModel):
    video_path: str
    zones: List[Zone]
