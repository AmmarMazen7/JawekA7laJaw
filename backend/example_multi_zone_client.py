"""
Example client to demonstrate multi-zone queue analysis.
This shows how to use the new /analyze-multi-zone endpoint.
"""

import requests
import json

# API endpoint
BASE_URL = "http://localhost:8000"

# Example: Define multiple zones for a supermarket
# Each zone is a polygon defined by corner points
zones = [
    {
        "name": "Checkout Lane 1",
        "polygon": [
            [100, 200],  # top-left
            [300, 200],  # top-right
            [300, 400],  # bottom-right
            [100, 400]   # bottom-left
        ]
    },
    {
        "name": "Checkout Lane 2",
        "polygon": [
            [350, 200],
            [550, 200],
            [550, 400],
            [350, 400]
        ]
    },
    {
        "name": "Checkout Lane 3",
        "polygon": [
            [600, 200],
            [800, 200],
            [800, 400],
            [600, 400]
        ]
    },
    {
        "name": "Self-Checkout Area",
        "polygon": [
            [850, 150],
            [1100, 150],
            [1100, 450],
            [850, 450]
        ]
    }
]

def upload_video(video_path: str):
    """Upload a video and get video_id"""
    with open(video_path, 'rb') as f:
        files = {'file': f}
        response = requests.post(f"{BASE_URL}/upload-video", files=files)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Video uploaded successfully!")
        print(f"  Video ID: {data['video_id']}")
        print(f"  Dimensions: {data['width']}x{data['height']}")
        print(f"  FPS: {data['fps']}")
        print(f"  Duration: {data['duration_sec']:.2f}s")
        return data
    else:
        print(f"✗ Upload failed: {response.text}")
        return None


def analyze_multi_zone(video_id: str, zones: list):
    """Analyze multiple zones in the video"""
    payload = {
        "video_id": video_id,
        "zones": zones,
        "conf": 0.4,
        "min_wait_sec_filter": 1.0,
        "sample_stride": 40
    }
    
    print(f"\n🔍 Analyzing {len(zones)} zones...")
    response = requests.post(f"{BASE_URL}/analyze-multi-zone", json=payload)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✓ Analysis complete!")
        print(f"  Duration: {data['duration_sec']:.2f}s")
        print(f"  Sample frames: {len(data['sample_frames'])}")
        
        print(f"\n📊 Results per zone:")
        print("=" * 80)
        
        for zone_result in data['zones']:
            zone_name = zone_result['zone_name']
            metrics = zone_result['metrics']
            
            print(f"\n🏪 {zone_name}")
            print(f"   Average Wait Time: {metrics['avg_wait']:.2f}s" if metrics['avg_wait'] else "   No data")
            print(f"   Min Wait Time: {metrics['min_wait']:.2f}s" if metrics['min_wait'] else "   N/A")
            print(f"   Max Wait Time: {metrics['max_wait']:.2f}s" if metrics['max_wait'] else "   N/A")
            print(f"   Average Queue Length: {metrics['avg_queue_len']:.1f}" if metrics['avg_queue_len'] else "   N/A")
            print(f"   Max Queue Length: {metrics['max_queue_len']}")
            print(f"   People Measured: {metrics['num_people_measured']}")
        
        return data
    else:
        print(f"✗ Analysis failed: {response.text}")
        return None


def main():
    # Example usage
    print("=" * 80)
    print("Multi-Zone Queue Analysis Example")
    print("=" * 80)
    
    # Step 1: Upload video
    video_path = "your_video.mp4"  # Replace with your video path
    video_data = upload_video(video_path)
    
    if video_data:
        video_id = video_data['video_id']
        
        # Step 2: Analyze with multiple zones
        results = analyze_multi_zone(video_id, zones)
        
        if results:
            # You can now process the results further
            # For example, save to a file
            with open('multi_zone_results.json', 'w') as f:
                json.dump(results, f, indent=2)
            print(f"\n💾 Results saved to multi_zone_results.json")


if __name__ == "__main__":
    # Note: Make sure the server is running first:
    # uvicorn app:app --host 0.0.0.0 --port 8000
    
    print("\n⚠️  Make sure to:")
    print("   1. Start the server: uvicorn app:app --host 0.0.0.0 --port 8000")
    print("   2. Update the video_path in this script")
    print("   3. Adjust the zone polygons to match your video\n")
    
    # Uncomment to run:
    # main()
