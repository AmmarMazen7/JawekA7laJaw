# 🚀 Quick Start Guide

## Prerequisites

1. **Python 3.8+** (for backend)
2. **Node.js 18+** (for frontend)
3. **pnpm** (package manager)

## Setup Instructions

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows PowerShell:
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start backend server
python app.py
```

Backend will run on: `http://localhost:8000`

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend/jawek-ahla-jaw

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Frontend will run on: `http://localhost:5173`

## Usage Guide

### Step 1: Upload Video
1. Click "Analysis" tab
2. Upload a video file showing your queue area
3. Wait for processing

### Step 2: Define Queue Region (ROI)
1. Click and drag on the first frame to draw a rectangle
2. This marks where customers queue
3. Make sure the rectangle covers the entire queue area

### Step 3: Run Analysis
1. Click "Start Analysis" button
2. Wait for AI processing (may take a few minutes for long videos)
3. View results in real-time

### Step 4: View Dashboard
1. Click "Dashboard" tab
2. See comprehensive analytics:
   - Real-time alerts
   - Key metrics
   - Business recommendations
   - Queue trends
   - Visual analysis

## Features Explained

### 🎯 Dashboard View
- **Value Proposition Banner:** Shows business benefits
- **Real-Time Alerts:** Critical, warning, and info notifications
- **Key Metrics Cards:** Wait times, queue length, people count
- **Strategic Recommendations:** Actionable business insights
- **Queue Analytics Chart:** Visual representation of queue over time
- **Sample Frames:** AI-annotated video frames showing detections

### 🔬 Analysis View
- **Video Upload:** Support for all common video formats
- **ROI Selection:** Interactive drawing tool for queue region
- **AI Analysis:** YOLO11-powered person detection and tracking
- **Detailed Results:** Comprehensive statistics and visualizations

## Understanding the Metrics

### Wait Time Metrics
- **Average Wait Time:** Mean time customers spend in queue
- **Min Wait Time:** Shortest observed wait
- **Max Wait Time:** Longest observed wait
- **Target:** Keep average under 2 minutes for optimal experience

### Queue Metrics
- **Average Queue Length:** Mean number of people in queue
- **People Measured:** Total customers analyzed
- **Target:** Keep queue length under 5 people

### Alert Levels

#### 🔴 Critical (Immediate Action)
- Average wait > 3 minutes
- Queue length > 10 people
- **Action:** Add staff immediately

#### 🟡 Warning (Monitor)
- Average wait 2-3 minutes
- Queue length 6-10 people
- **Action:** Prepare to add staff

#### 🔵 Info (Normal)
- All metrics within normal range
- **Action:** Continue monitoring

## Business Recommendations

### High Priority
- **Immediate staffing changes** (critical situations)
- **Real-time monitoring system** implementation
- **Express lane** for simple orders

### Medium Priority
- **Queue layout optimization**
- **Service process standardization**
- **Staff training programs**

### Low Priority
- **Long-term operational improvements**
- **Technology upgrades**

## Tips for Best Results

### Video Quality
- ✅ Use 1080p or higher resolution
- ✅ Ensure good lighting conditions
- ✅ Fixed camera angle (no movement)
- ✅ Clear view of entire queue area
- ❌ Avoid extreme angles or obstructions

### ROI Selection
- ✅ Include entire queue waiting area
- ✅ Draw tight around the queue path
- ✅ Exclude non-queue areas (entrance, service counter)
- ❌ Don't include areas where people aren't waiting

### Analysis Parameters
- **Confidence threshold:** 0.4 (default) - Lower = more detections
- **Min wait filter:** 1.0 seconds - Filters out passing traffic
- **Sample stride:** 40 frames - Balance between detail and speed

## Troubleshooting

### Backend Issues

**Problem:** "Port 8000 already in use"
```bash
# Find and kill process using port 8000
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

**Problem:** "YOLO model not found"
```bash
# Model downloads automatically on first run
# Ensure internet connection
# Check YOLO11 model exists in backend directory
```

### Frontend Issues

**Problem:** "Cannot connect to backend"
- Ensure backend is running on port 8000
- Check API_BASE constant in App.tsx
- Disable any firewall/antivirus blocking localhost

**Problem:** "Video upload fails"
- Check video format (mp4, avi, mov supported)
- Ensure video file is not corrupted
- Check available disk space

### Analysis Issues

**Problem:** "No people detected"
- Adjust confidence threshold (lower to 0.3)
- Check video quality and lighting
- Ensure people are clearly visible

**Problem:** "Wrong queue count"
- Redraw ROI more precisely
- Exclude areas where people aren't queueing
- Adjust detection parameters

## Advanced Configuration

### Backend Configuration (app.py)

```python
# Adjust YOLO model
MODEL_PATH = "yolo11n.pt"  # n=nano, s=small, m=medium, l=large

# GPU configuration
DEVICE = "0"  # Use "cpu" for CPU-only

# Confidence threshold
conf = 0.4  # Range: 0.1-0.9
```

### Frontend Configuration (App.tsx)

```typescript
// API endpoint
const API_BASE = "http://localhost:8000";

// Analysis parameters
{
  conf: 0.4,              // Detection confidence
  min_wait_sec_filter: 1.0,  // Minimum wait time
  sample_stride: 40       // Frame sampling rate
}
```

## Performance Optimization

### For Faster Analysis
- Use smaller video files (30 seconds - 2 minutes)
- Reduce video resolution (720p is sufficient)
- Use YOLO11n (nano) model for speed
- Increase sample_stride (skip more frames)

### For Better Accuracy
- Use longer video clips (5+ minutes)
- Use higher resolution (1080p+)
- Use YOLO11m (medium) or larger model
- Decrease sample_stride (analyze more frames)

## API Endpoints

### POST /upload-video
Upload video file for analysis

**Request:** multipart/form-data with video file

**Response:**
```json
{
  "video_id": "vid_1234567890",
  "width": 1920,
  "height": 1080,
  "first_frame": "data:image/jpeg;base64,...",
  "fps": 30.0,
  "frame_count": 3000,
  "duration_sec": 100.0
}
```

### POST /analyze
Analyze queue in uploaded video

**Request:**
```json
{
  "video_id": "vid_1234567890",
  "roi": [100, 200, 800, 900],
  "conf": 0.4,
  "min_wait_sec_filter": 1.0,
  "sample_stride": 40
}
```

**Response:**
```json
{
  "metrics": {
    "avg_wait": 45.2,
    "min_wait": 12.5,
    "max_wait": 120.8,
    "avg_queue_len": 3.5,
    "num_people_measured": 42
  },
  "times": [0.0, 1.0, 2.0, ...],
  "queue_lengths": [3, 4, 3, 5, ...],
  "sample_frames": ["data:image/jpeg;base64,..."],
  "wait_times": [45.2, 38.1, 67.3, ...],
  "fps": 30.0,
  "frame_count": 3000,
  "duration_sec": 100.0
}
```

## Demo Data

For testing without real footage, you can:
1. Use sample queue videos from YouTube
2. Record a simulation with people standing in line
3. Use the provided test video (if available)

## Support & Resources

- **YOLO Documentation:** https://docs.ultralytics.com/
- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **React Docs:** https://react.dev/

## Production Deployment

### Backend (Cloud)
```bash
# Using Heroku, AWS, or similar
# Set environment variables
export MODEL_PATH=yolo11n.pt
export DEVICE=cpu

# Run with production server
gunicorn app:app --workers 4 --bind 0.0.0.0:8000
```

### Frontend (Vercel/Netlify)
```bash
# Build for production
pnpm build

# Deploy dist folder
# Update API_BASE to production backend URL
```

---

**Ready to revolutionize queue management!** 🎂✨

For questions or issues, contact the development team.
