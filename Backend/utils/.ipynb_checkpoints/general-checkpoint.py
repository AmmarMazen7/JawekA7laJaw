import json
import cv2
import numpy as np
from collections.abc import Generator

def load_zones_config(file_path: str) -> list[np.ndarray]:
    """Load polygon zone configurations from a JSON file."""
    with open(file_path) as file:
        data = json.load(file)
        return [np.array(polygon, np.int32) for polygon in data]

def find_in_list(array: np.ndarray, search_list: list[int]) -> np.ndarray:
    """Return boolean mask where elements of array are in search_list."""
    if not search_list:
        return np.ones(array.shape, dtype=bool)
    return np.isin(array, search_list)

def get_stream_frames_generator(rtsp_url: str) -> Generator[np.ndarray, None, None]:
    """Yield frames from RTSP stream."""
    cap = cv2.VideoCapture(rtsp_url)
    if not cap.isOpened():
        raise Exception("Could not open video stream.")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            yield frame
    finally:
        cap.release()
