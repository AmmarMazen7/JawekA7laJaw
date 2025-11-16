from fastapi import FastAPI, UploadFile, File, WebSocket, HTTPException, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import shutil
import os
import cv2
import base64
import time
import logging
import json

from services.analyzer import analyze_video_with_zones
from services.realtime_stream import RealtimeStreamProcessor
from services.ai_recommendations import recommendation_service
from models.zone import ZoneRequest
from config.cameras import get_camera_config, get_all_cameras, get_camera_video_path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

# -------------------- CORS -----------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Store mapping: video_id -> video_path
VIDEO_STORE = {}
OUTPUT_VIDEO_STORE = {}
ACTIVE_STREAMS = {}  # stream_id -> RealtimeStreamProcessor

def get_first_frame(video_path: str):
    """Extract the first frame from a video file"""
    cap = cv2.VideoCapture(video_path)
    success, frame = cap.read()
    cap.release()
    if not success or frame is None:
        raise RuntimeError("Could not read first frame from video.")
    return frame

def get_video_metadata(video_path: str):
    """Extract FPS, frame count, and duration from video"""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError("Could not open video file.")
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 25.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration_sec = frame_count / fps if frame_count > 0 else 0
    cap.release()
    return fps, frame_count, width, height, duration_sec

def encode_image_bgr_to_base64(frame_bgr):
    """Convert BGR image to base64 JPEG string"""
    _, buf = cv2.imencode(".jpg", frame_bgr)
    jpg_bytes = buf.tobytes()
    b64 = base64.b64encode(jpg_bytes).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"

# =====================================================
# ================ 1) FILE UPLOAD =====================
# =====================================================

@app.post("/upload-video")
async def upload_video(file: UploadFile = File(...)):
    """Upload a video file and extract metadata"""
    logger.info("="*80)
    logger.info("VIDEO UPLOAD REQUEST")
    logger.info(f"Filename: {file.filename}")
    
    video_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    logger.info(f"Saved to: {video_path}")
    
    try:
        # Extract first frame
        first_frame_bgr = get_first_frame(video_path)
        first_frame_b64 = encode_image_bgr_to_base64(first_frame_bgr)
        
        # Get video metadata
        fps, frame_count, width, height, duration_sec = get_video_metadata(video_path)
        
        # Generate video ID and store path
        video_id = f"vid_{int(time.time()*1000)}"
        VIDEO_STORE[video_id] = video_path
        
        logger.info(f"Generated video ID: {video_id}")
        logger.info(f"Video metadata: {width}x{height}, {fps:.2f} FPS, {frame_count} frames, {duration_sec:.1f}s")
        logger.info("✅ Upload successful!")
        logger.info("="*80)
        
        return {
            "video_id": video_id,
            "width": width,
            "height": height,
            "first_frame": first_frame_b64,
            "fps": fps,
            "frame_count": frame_count,
            "duration_sec": duration_sec,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# =====================================================
# =========== 2) ANALYZE MULTI-ZONE ===================
# =====================================================

@app.post("/analyze-multi-zone")
async def analyze_multi_zone(request: ZoneRequest):
    """Analyze multiple zones in a video"""
    logger.info("="*80)
    logger.info("MULTI-ZONE ANALYSIS REQUEST")
    logger.info(f"Video ID: {request.video_id}")
    logger.info(f"Number of zones: {len(request.zones)}")
    logger.info(f"Available video IDs in store: {list(VIDEO_STORE.keys())}")
    
    if request.video_id not in VIDEO_STORE:
        logger.error(f"Video ID '{request.video_id}' not found in VIDEO_STORE")
        raise HTTPException(status_code=404, detail=f"Unknown video_id: {request.video_id}")
    
    video_path = VIDEO_STORE[request.video_id]
    logger.info(f"Video path: {video_path}")
    
    # Create output video path
    output_video_path = os.path.join(UPLOAD_DIR, f"annotated_{request.video_id}.mp4")
    
    # Convert Zone objects to dictionaries
    zones_dict = [
        {
            "name": zone.name,
            "polygon": zone.polygon
        }
        for zone in request.zones
    ]
    
    # Run analysis
    result = analyze_video_with_zones(
        video_path=video_path,
        zones=zones_dict,
        output_video_path=output_video_path,
        conf=request.conf,
        min_wait_sec_filter=request.min_wait_sec_filter,
        sample_stride=request.sample_stride
    )
    
    # Store output video path
    OUTPUT_VIDEO_STORE[request.video_id] = output_video_path
    
    # Add video URL to result
    result["output_video_url"] = f"/download-video/{request.video_id}"
    
    return JSONResponse(result)

@app.get("/download-video/{video_id}")
async def download_video(video_id: str):
    """Download or stream the annotated output video"""
    if video_id not in OUTPUT_VIDEO_STORE:
        raise HTTPException(status_code=404, detail="Output video not found")
    
    output_path = OUTPUT_VIDEO_STORE[video_id]
    
    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Output video file not found on disk")
    
    return FileResponse(
        output_path,
        media_type="video/mp4",
        filename=f"annotated_{video_id}.mp4"
    )

# =====================================================
# ============ 3) CCTV CAMERA MANAGEMENT ==============
# =====================================================

@app.get("/cameras")
async def list_cameras():
    """Get all available CCTV cameras"""
    cameras = get_all_cameras()
    return {
        "total": len(cameras),
        "cameras": cameras
    }

@app.get("/cameras/{camera_id}")
async def get_camera(camera_id: str):
    """Get specific camera details"""
    camera = get_camera_config(camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    return camera

@app.get("/cameras/{camera_id}/preview")
async def get_camera_preview(camera_id: str):
    """Get a preview frame from camera"""
    try:
        video_path = get_camera_video_path(camera_id)
        
        cap = cv2.VideoCapture(video_path)
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            raise HTTPException(status_code=500, detail="Could not read video frame")
        
        # Encode frame to JPEG
        _, buffer = cv2.imencode('.jpg', frame)
        frame_b64 = base64.b64encode(buffer).decode('utf-8')
        
        return {
            "camera_id": camera_id,
            "preview": f"data:image/jpeg;base64,{frame_b64}"
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================
# ============ 4) REAL-TIME STREAMING =================
# =====================================================

@app.post("/stream/start-camera/{camera_id}")
async def start_camera_stream(camera_id: str):
    """Start a real-time stream from a CCTV camera with predefined zones"""
    logger.info("="*80)
    logger.info("START CCTV CAMERA STREAM")
    logger.info(f"Camera ID: {camera_id}")
    
    # Get camera configuration
    camera = get_camera_config(camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    
    # Get video path
    try:
        video_path = get_camera_video_path(camera_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    # Generate stream ID
    stream_id = f"stream_{camera_id}_{int(time.time()*1000)}"
    
    # Use predefined zones from camera config
    zones_dict = [
        {
            "name": zone["name"],
            "polygon": zone["polygon"]
        }
        for zone in camera["zones"]
    ]
    
    logger.info(f"Using {len(zones_dict)} predefined zones from camera config")
    
    # Create stream processor
    processor = RealtimeStreamProcessor(
        video_path=video_path,
        zones=zones_dict,
        conf=0.4,
        target_fps=15,
        min_wait_sec_filter=0
    )
    
    ACTIVE_STREAMS[stream_id] = {
        "processor": processor,
        "camera": camera
    }
    
    logger.info(f"Created stream: {stream_id}")
    logger.info(f"Location: {camera['location']}")
    logger.info(f"Area: {camera['area']}")
    logger.info("="*80)
    
    return {
        "stream_id": stream_id,
        "camera_id": camera_id,
        "camera_name": camera["name"],
        "location": camera["location"],
        "area": camera["area"],
        "zones": len(zones_dict),
        "status": "ready",
        "target_fps": 15
    }

@app.post("/stream/start")
async def start_stream(request: ZoneRequest):
    """Start a real-time stream simulation (legacy - for uploaded videos)"""
    logger.info("="*80)
    logger.info("START REAL-TIME STREAM REQUEST")
    logger.info(f"Video ID: {request.video_id}")
    logger.info(f"Number of zones: {len(request.zones)}")
    
    if request.video_id not in VIDEO_STORE:
        logger.error(f"Video ID '{request.video_id}' not found")
        raise HTTPException(status_code=404, detail=f"Unknown video_id: {request.video_id}")
    
    video_path = VIDEO_STORE[request.video_id]
    
    # Generate stream ID
    stream_id = f"stream_{int(time.time()*1000)}"
    
    # Convert Zone objects to dictionaries
    zones_dict = [
        {
            "name": zone.name,
            "polygon": zone.polygon
        }
        for zone in request.zones
    ]
    
    # Create stream processor
    processor = RealtimeStreamProcessor(
        video_path=video_path,
        zones=zones_dict,
        conf=request.conf,
        target_fps=15,  # Stream at 15 FPS
        min_wait_sec_filter=request.min_wait_sec_filter
    )
    
    ACTIVE_STREAMS[stream_id] = {
        "processor": processor,
        "camera": None
    }
    
    logger.info(f"Created stream: {stream_id}")
    logger.info("="*80)
    
    return {
        "stream_id": stream_id,
        "status": "ready",
        "target_fps": 15
    }

@app.websocket("/ws/stream/{stream_id}")
async def stream_websocket(websocket: WebSocket, stream_id: str):
    """WebSocket endpoint for real-time video streaming"""
    await websocket.accept()
    
    logger.info(f"WebSocket connected for stream: {stream_id}")
    
    if stream_id not in ACTIVE_STREAMS:
        await websocket.send_json({"error": "Stream not found"})
        await websocket.close()
        return
    
    stream_data = ACTIVE_STREAMS[stream_id]
    processor = stream_data["processor"]
    camera = stream_data.get("camera")
    
    try:
        # Send connection info with camera details
        connection_msg = {
            "type": "connected",
            "stream_id": stream_id,
            "message": "Stream started"
        }
        
        if camera:
            connection_msg["camera"] = {
                "id": camera["id"],
                "name": camera["name"],
                "location": camera["location"],
                "area": camera["area"],
                "address": camera.get("address", ""),
                "metadata": camera.get("metadata", {})
            }
        
        await websocket.send_json(connection_msg)
        
        # Process and stream frames
        async for stream_frame in processor.process_stream():
            # Encode frame to base64
            frame_b64 = base64.b64encode(stream_frame.annotated_frame).decode('utf-8')
            
            # Ensure zones_data is JSON serializable
            zones_list = []
            for zone_name, zone_data in stream_frame.zones_data.items():
                zone_info = {
                    "name": zone_name,
                    "current_count": int(zone_data.get("current_count", 0)),
                    "avg_wait_time": float(zone_data.get("avg_wait", 0.0)),
                    "max_queue": int(zone_data.get("max_queue", 0)),
                    "total_people": int(zone_data.get("total_people", 0)) if "total_people" in zone_data else int(len(zone_data.get("people_ids", []))),
                    "total_wait_time": float(zone_data.get("total_wait_time", 0.0)) if "total_wait_time" in zone_data else 0.0
                }
                zones_list.append(zone_info)
            
            # Send frame data
            data = {
                "type": "frame",
                "frame_id": int(stream_frame.frame_id),
                "timestamp": float(stream_frame.timestamp),
                "frame": f"data:image/jpeg;base64,{frame_b64}",
                "zones": zones_list,
                "fps": float(stream_frame.fps)
            }
            
            await websocket.send_json(data)
            
            # Check for stop command
            try:
                message = await websocket.receive_text()
                command = json.loads(message)
                if command.get("action") == "stop":
                    logger.info(f"Stop command received for stream: {stream_id}")
                    break
            except:
                pass
        
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for stream: {stream_id}")
    except Exception as e:
        logger.error(f"Stream error: {str(e)}")
        await websocket.send_json({"type": "error", "message": str(e)})
    finally:
        if stream_id in ACTIVE_STREAMS:
            stream_data = ACTIVE_STREAMS[stream_id]
            stream_data["processor"].cleanup()
            del ACTIVE_STREAMS[stream_id]
        await websocket.close()

@app.post("/stream/stop/{stream_id}")
async def stop_stream(stream_id: str):
    """Stop an active stream"""
    if stream_id in ACTIVE_STREAMS:
        stream_data = ACTIVE_STREAMS[stream_id]
        stream_data["processor"].cleanup()
        del ACTIVE_STREAMS[stream_id]
        logger.info(f"Stopped stream: {stream_id}")
        return {"status": "stopped", "stream_id": stream_id}
    else:
        raise HTTPException(status_code=404, detail="Stream not found")

@app.get("/stream/stats/{stream_id}")
async def get_stream_stats(stream_id: str):
    """Get accumulated statistics for a stream"""
    if stream_id not in ACTIVE_STREAMS:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    stream_data = ACTIVE_STREAMS[stream_id]
    processor = stream_data["processor"]
    stats = processor.get_summary_stats()
    
    # Add camera info if available
    if stream_data.get("camera"):
        camera = stream_data["camera"]
        stats["camera"] = {
            "id": camera["id"],
            "name": camera["name"],
            "location": camera["location"],
            "area": camera["area"]
        }
    
    return stats

# =====================================================
# =============== 4) AI RECOMMENDATIONS ==============
# =====================================================

@app.post("/api/recommendations")
async def generate_ai_recommendations(analytics_data: dict):
    """
    Generate intelligent AI-powered recommendations based on queue analytics
    
    This endpoint uses OpenAI GPT to analyze queue metrics and provide
    actionable business recommendations for queue optimization.
    
    Args:
        analytics_data: Queue analytics data from video analysis
        
    Returns:
        AI-generated recommendations with priorities, insights, and actions
    """
    try:
        logger.info("Generating AI recommendations for analytics data")
        
        # Add timestamp if not present
        if "timestamp" not in analytics_data:
            analytics_data["timestamp"] = time.time()
        
        # Generate intelligent recommendations
        recommendations = recommendation_service.generate_recommendations(analytics_data)
        
        logger.info(f"Generated {len(recommendations.get('priority_recommendations', []))} recommendations")
        
        return JSONResponse(
            content={
                "success": True,
                "recommendations": recommendations,
                "generated_at": time.time()
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating recommendations: {str(e)}")
        return JSONResponse(
            content={
                "success": False,
                "error": str(e),
                "recommendations": {
                    "priority_recommendations": [{
                        "priority": "low",
                        "action": "Review system configuration",
                        "reason": "Unable to generate AI recommendations",
                        "impact": "Ensure OpenAI integration is properly configured"
                    }],
                    "alert_level": "warning",
                    "ai_powered": False,
                    "confidence_score": 50
                }
            },
            status_code=500
        )

@app.get("/api/recommendations/instant")
async def get_instant_recommendations(video_id: str = None):
    """
    Get instant recommendations for the current queue situation
    
    This is a quick endpoint that provides immediate insights
    for the floating recommendation button in the dashboard.
    """
    try:
        if video_id and video_id in VIDEO_STORE:
            # If we have video data, use it
            # For now, return sample data - in production this would
            # pull from the latest analysis results
            sample_analytics = {
                "zones": [
                    {
                        "zone_name": "Main Queue",
                        "metrics": {
                            "num_people_measured": 15,
                            "avg_wait": 95.0,
                            "max_wait": 180.0,
                            "avg_queue_len": 3.2
                        }
                    }
                ],
                "timestamp": time.time()
            }
        else:
            # Default sample data for instant recommendations
            sample_analytics = {
                "zones": [
                    {
                        "zone_name": "Current Queue",
                        "metrics": {
                            "num_people_measured": 8,
                            "avg_wait": 65.0,
                            "max_wait": 120.0,
                            "avg_queue_len": 2.1
                        }
                    }
                ],
                "timestamp": time.time()
            }
        
        # Generate quick recommendations
        recommendations = recommendation_service.generate_recommendations(sample_analytics)
        
        # Return condensed format for instant display
        return JSONResponse(content={
            "success": True,
            "instant_insight": recommendations.get("insights", ["Queue operating normally"])[0],
            "priority_action": recommendations.get("priority_recommendations", [{}])[0].get("action", "Continue monitoring"),
            "alert_level": recommendations.get("alert_level", "normal"),
            "confidence": recommendations.get("confidence_score", 75),
            "ai_powered": recommendations.get("ai_powered", False)
        })
        
    except Exception as e:
        logger.error(f"Error generating instant recommendations: {str(e)}")
        return JSONResponse(content={
            "success": False,
            "instant_insight": "Queue monitoring active",
            "priority_action": "Continue normal operations",
            "alert_level": "normal",
            "confidence": 50,
            "ai_powered": False
        })

# =====================================================
# =============== 5) WEBSOCKET API ====================
# =====================================================

@app.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    await ws.send_json({"message": "WebSocket connected."})
    while True:
        data = await ws.receive_text()
        await ws.send_json({"echo": data})
