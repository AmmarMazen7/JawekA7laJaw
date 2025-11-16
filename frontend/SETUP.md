# Queue AI - Queue Management System Setup Guide

## Overview
Queue AI is a comprehensive AI-powered queue management system for supermarkets and retail environments. It combines computer vision (YOLOv11) with real-time analytics to optimize service times and customer satisfaction.

## System Architecture

### Frontend (Next.js)
- Modern React dashboard with real-time metrics
- Video zone configuration with polygon drawing
- Employee management system
- Dark/light theme support
- WebSocket for real-time updates

### Backend (FastAPI)
- YOLOv11 computer vision detection
- Queue analytics and metrics
- Real-time employee notifications
- WebSocket streaming
- Zone configuration management

## Prerequisites

### Frontend Requirements
- Node.js 18+ and npm/yarn
- React 19+
- Next.js 16+

### Backend Requirements (FastAPI)
- Python 3.9+
- FastAPI
- YOLOv11
- OpenCV
- uvicorn

## Frontend Setup

### 1. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 2. Environment Configuration
Create a `.env.local` file:

\`\`\`env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
FASTAPI_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/ws

# Other configs
NODE_ENV=development
\`\`\`

### 3. Run Development Server
\`\`\`bash
npm run dev
\`\`\`

The app will be available at `http://localhost:3000`

## Backend Setup (FastAPI with YOLOv11)

### 1. Create Python Virtual Environment
\`\`\`bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
\`\`\`

### 2. Install Backend Dependencies
\`\`\`bash
pip install fastapi uvicorn python-multipart websockets pydantic opencv-python ultralytics
\`\`\`

### 3. Example FastAPI Server Structure

\`\`\`python
from fastapi import FastAPI, UploadFile, File, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import asyncio
import json

app = FastAPI(title="Queue AI Backend")

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load YOLOv11 model
model = YOLO("yolov11n.pt")

# Queue metrics storage
queue_metrics = {
    "totalCustomers": 0,
    "customersServed": 0,
    "averageServiceTime": 0,
    "customersAbandoned": 0,
    "queueEfficiency": 0,
}

# WebSocket connections
active_connections = []

@app.post("/api/video/upload")
async def upload_video(file: UploadFile = File(...)):
    """Handle video uploads"""
    video_id = f"video-{file.filename}-{int(time.time())}"
    # Save and process video
    return {"videoId": video_id, "status": "uploaded"}

@app.post("/api/zones/config")
async def process_zone_config(request: dict):
    """Process zone configuration for YOLO detection"""
    video_id = request.get("videoId")
    zones = request.get("zones")
    # Extract polygon points and prepare for YOLO detection
    return {"status": "processed", "configId": f"config-{video_id}"}

@app.get("/api/queue/metrics")
async def get_queue_metrics(timeRange: str = "1h"):
    """Return real-time queue metrics"""
    return queue_metrics

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            # Simulate metric updates
            await asyncio.sleep(2)
            updated_metrics = get_updated_metrics()
            await websocket.send_json({
                "type": "queue_metrics",
                "payload": updated_metrics
            })
    except Exception as e:
        active_connections.remove(websocket)

@app.post("/api/detection/start")
async def start_detection(request: dict):
    """Start YOLOv11 detection on video with zone config"""
    video_id = request.get("videoId")
    zones = request.get("zoneConfig")
    # Run YOLO detection with zones
    # Return detection results
    return {"detectionId": f"det-{video_id}", "status": "running"}

@app.get("/api/detection/{detection_id}/stream")
async def get_detection_stream(detection_id: str):
    """Stream live detection results"""
    # Stream processed video with bounding boxes
    pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
\`\`\`

### 4. Run Backend Server
\`\`\`bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
\`\`\`

## Zone Configuration Format

The zone configuration is output as a JSON file with polygon coordinates:

\`\`\`json
[
  [
    [697, 133], [693, 217], [724, 214], 
    [723, 275], [700, 273], [731, 635], 
    [950, 616], [816, 128], [702, 98]
  ],
  [
    [981, 117], [1215, 497], [1278, 463], 
    [1179, 155], [1112, 74]
  ],
  [
    [493, 150], [434, 562], [305, 631], 
    [419, 164]
  ]
]
\`\`\`

This format is compatible with YOLOv11's polygon detection system.

## Key Features

### 1. Video Zone Configuration
- Upload surveillance videos
- Draw custom detection zones on 3 key frames
- Export zone config as JSON for YOLO

### 2. Employee Management
- Add employees with roles (Cashier, Supervisor, Manager)
- Track availability status (Available, Busy, Break)
- Assign employees to specific zones
- Set work schedules

### 3. Real-time Analytics
- Live queue metrics (service time, efficiency, etc.)
- Wait time trends by zone
- Customer flow visualization
- Load distribution across zones

### 4. Notifications & Alerts
- High queue alerts
- Staff availability alerts
- Peak time predictions
- AI-powered recommendations

### 5. Real-time Updates
- WebSocket-based live metrics
- Automatic employee notifications
- Queue status streaming

## API Endpoints Reference

### Queue Management
- `GET /api/queue/metrics` - Get queue metrics
- `GET /api/queues/{queueId}` - Get specific queue
- `GET /api/zones/{zoneId}/stats` - Get zone statistics

### Video Processing
- `POST /api/video/upload` - Upload video
- `POST /api/zones/config` - Process zone config
- `GET /api/video/{videoId}/status` - Check processing status

### Detection
- `POST /api/detection/start` - Start YOLOv11 detection
- `POST /api/detection/{detectionId}/stop` - Stop detection
- `GET /api/detection/{detectionId}/results` - Get results

### Employee Management
- `GET /api/employees` - List all employees
- `POST /api/employees` - Create employee
- `PUT /api/employees/{id}` - Update employee
- `DELETE /api/employees/{id}` - Delete employee
- `PUT /api/employees/{id}/availability` - Update availability

### Notifications
- `GET /api/notifications` - Get notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/{id}/read` - Mark as read

### WebSocket
- `WS /api/ws` - Real-time updates connection

## Troubleshooting

### Backend Connection Issues
If the frontend can't connect to FastAPI:
1. Check that FastAPI server is running on port 8000
2. Verify CORS is enabled
3. Check `NEXT_PUBLIC_API_URL` in `.env.local`
4. Try accessing `http://localhost:8000/docs` to verify backend is running

### WebSocket Connection Issues
1. Ensure WebSocket URL matches your backend (`ws://localhost:8000/api/ws`)
2. Check browser console for connection errors
3. Verify firewall isn't blocking WebSocket connections

### YOLOv11 Model Issues
1. First run will download the model (~60MB)
2. Ensure adequate disk space
3. For GPU acceleration, install `torch` with CUDA support

## Performance Tips

1. **Video Optimization**: Compress videos before upload for faster processing
2. **Zone Simplification**: Use minimum 3 points for zones, max 10 for best performance
3. **Real-time Updates**: Adjust WebSocket update frequency based on needs
4. **Database**: Consider adding a database for historical data (PostgreSQL recommended)

## Deployment

### Production Deployment

#### Frontend (Vercel)
\`\`\`bash
npm run build
# Deploy to Vercel via CLI or Git integration
vercel deploy
\`\`\`

#### Backend (Docker)
\`\`\`dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
\`\`\`

\`\`\`bash
docker build -t queue-ai-backend .
docker run -p 8000:8000 queue-ai-backend
\`\`\`

## Security Considerations

1. **Authentication**: Add JWT authentication to all API endpoints
2. **Rate Limiting**: Implement rate limiting on video uploads
3. **Data Privacy**: Ensure compliance with GDPR for video data
4. **Access Control**: Restrict admin functions to authorized users
5. **Video Storage**: Use secure cloud storage (S3, Azure Blob) instead of local storage

## Support & Documentation

For more information:
- FastAPI Docs: `http://localhost:8000/docs`
- YOLOv11 Guide: https://docs.ultralytics.com/models/yolov11/
- Next.js Documentation: https://nextjs.org/docs

## License
Queue AI - All rights reserved
