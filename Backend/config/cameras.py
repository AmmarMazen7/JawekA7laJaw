"""
CCTV Camera Configuration
Simulates a real supermarket surveillance system with predefined cameras and zones
"""

import os
from typing import List, Dict

# Base path for data
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

# Camera configurations for Walmart Supermarket
CCTV_CAMERAS = {
    "CAM-WM-CHECKOUT-01": {
        "id": "CAM-WM-CHECKOUT-01",
        "name": "Walmart Checkout Lane 1-3",
        "location": "Walmart Supercenter #5472",
        "address": "123 Commerce Blvd, Springfield, IL 62701",
        "area": "Front End - Checkout",
        "video_file": "walmart_checkout_cam01.mp4",
        "resolution": "1920x1080",
        "fps": 30,
        "installed_date": "2023-08-15",
        "status": "active",
        "zones": [
            {
                "name": "Checkout Lane 1",
                "type": "checkout_queue",
                "polygon": [
                    [100, 300],
                    [350, 300],
                    [350, 650],
                    [100, 650]
                ],
                "color": "#FF0000",  # Red
                "description": "Queue waiting area for checkout lane 1"
            },
            {
                "name": "Checkout Lane 2",
                "type": "checkout_queue",
                "polygon": [
                    [400, 250],
                    [650, 250],
                    [650, 600],
                    [400, 600]
                ],
                "color": "#00FF00",  # Green
                "description": "Queue waiting area for checkout lane 2"
            },
            {
                "name": "Checkout Lane 3",
                "type": "checkout_queue",
                "polygon": [
                    [700, 200],
                    [950, 200],
                    [950, 550],
                    [700, 550]
                ],
                "color": "#0000FF",  # Blue
                "description": "Queue waiting area for checkout lane 3"
            }
        ],
        "metadata": {
            "store_id": "WM-5472",
            "region": "Midwest",
            "store_manager": "John Anderson",
            "camera_model": "HD-SDI 1080P",
            "recording_mode": "continuous",
            "retention_days": 30
        }
    },
    "CAM-WM-ENTRANCE-01": {
        "id": "CAM-WM-ENTRANCE-01",
        "name": "Walmart Main Entrance",
        "location": "Walmart Supercenter #5472",
        "address": "123 Commerce Blvd, Springfield, IL 62701",
        "area": "Main Entrance",
        "video_file": "walmart_checkout_cam01.mp4",  # Using same video for demo
        "resolution": "1920x1080",
        "fps": 30,
        "installed_date": "2023-08-15",
        "status": "active",
        "zones": [
            {
                "name": "Entry Zone",
                "type": "entrance",
                "polygon": [
                    [200, 200],
                    [500, 200],
                    [500, 500],
                    [200, 500]
                ],
                "color": "#FFD700",  # Gold
                "description": "Customer entry monitoring zone"
            },
            {
                "name": "Exit Zone",
                "type": "exit",
                "polygon": [
                    [600, 200],
                    [900, 200],
                    [900, 500],
                    [600, 500]
                ],
                "color": "#FF6347",  # Tomato
                "description": "Customer exit monitoring zone"
            }
        ],
        "metadata": {
            "store_id": "WM-5472",
            "region": "Midwest",
            "store_manager": "John Anderson",
            "camera_model": "HD-SDI 1080P",
            "recording_mode": "continuous",
            "retention_days": 30
        }
    },
    "CAM-WM-ELECTRONICS-01": {
        "id": "CAM-WM-ELECTRONICS-01",
        "name": "Walmart Electronics Department",
        "location": "Walmart Supercenter #5472",
        "address": "123 Commerce Blvd, Springfield, IL 62701",
        "area": "Electronics Department",
        "video_file": "walmart_checkout_cam01.mp4",  # Using same video for demo
        "resolution": "1920x1080",
        "fps": 30,
        "installed_date": "2023-08-15",
        "status": "active",
        "zones": [
            {
                "name": "Service Counter Queue",
                "type": "service_queue",
                "polygon": [
                    [300, 250],
                    [700, 250],
                    [700, 600],
                    [300, 600]
                ],
                "color": "#9370DB",  # Medium Purple
                "description": "Customer service counter queue"
            }
        ],
        "metadata": {
            "store_id": "WM-5472",
            "region": "Midwest",
            "store_manager": "John Anderson",
            "camera_model": "HD-SDI 1080P",
            "recording_mode": "continuous",
            "retention_days": 30,
            "department": "Electronics"
        }
    }
}


def get_camera_config(camera_id: str) -> Dict:
    """Get camera configuration by ID"""
    return CCTV_CAMERAS.get(camera_id)


def get_all_cameras() -> List[Dict]:
    """Get all available cameras"""
    return list(CCTV_CAMERAS.values())


def get_camera_video_path(camera_id: str) -> str:
    """Get full path to camera's video file"""
    camera = get_camera_config(camera_id)
    if not camera:
        raise ValueError(f"Camera {camera_id} not found")
    
    video_file = camera["video_file"]
    video_path = os.path.join(DATA_DIR, video_file)
    
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")
    
    return video_path


def get_cameras_by_location(location: str) -> List[Dict]:
    """Get all cameras at a specific location"""
    return [cam for cam in CCTV_CAMERAS.values() if cam["location"] == location]


def get_cameras_by_area(area: str) -> List[Dict]:
    """Get all cameras in a specific area"""
    return [cam for cam in CCTV_CAMERAS.values() if cam["area"] == area]
