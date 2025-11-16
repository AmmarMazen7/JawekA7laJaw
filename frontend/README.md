# Queue AI - Intelligent Queue Management System

## Overview
Queue AI is an AI-powered queue management and analytics platform designed for retail environments. It uses computer vision (YOLOv11) to monitor queues in real-time and provides actionable insights to optimize customer service.

## Key Features

### 📹 Computer Vision Zone Configuration
- Upload surveillance videos and define custom detection zones
- Interactive polygon drawing on key video frames
- Support for up to 3 zones per video
- JSON export for YOLO integration

### 👥 Employee Management
- Manage team members and their roles
- Track availability in real-time (Available/Busy/Break)
- Assign employees to specific zones
- Set work schedules and shifts

### 📊 Real-time Analytics Dashboard
- Live queue metrics (service time, efficiency, abandonment)
- Wait time trends by zone
- Customer flow visualization
- Load distribution analysis
- AI-powered recommendations

### 🔔 Notification & Alert System
- Real-time alerts for queue overflow
- Staff notifications for high-demand periods
- Performance insights and recommendations
- Customizable alert thresholds

### 🔄 Real-time Updates
- WebSocket-based live metrics
- Automatic employee notifications
- Live streaming from detection system
- Synchronized across all users

## Technology Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS v4** - Utility-first styling
- **Recharts** - Data visualization
- **Lucide Icons** - Icon system

### Backend (FastAPI)
- **FastAPI** - Modern Python web framework
- **YOLOv11** - Object detection model
- **OpenCV** - Computer vision processing
- **WebSockets** - Real-time communication
- **Pydantic** - Data validation

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- npm or yarn

### Frontend Setup
\`\`\`bash
npm install
npm run dev
# Open http://localhost:3000
\`\`\`

### Backend Setup
\`\`\`bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
# Backend runs on http://localhost:8000
\`\`\`

### Environment Variables
\`\`\`env
NEXT_PUBLIC_API_URL=http://localhost:8000
FASTAPI_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/ws
\`\`\`

## Usage Guide

### 1. Zone Configuration
1. Navigate to "Zone Configuration" tab
2. Upload a surveillance video
3. Draw polygons on video frames to define detection zones
4. Download the JSON config file
5. Send config to FastAPI backend for YOLOv11 detection

### 2. Employee Management
1. Go to "Employee Management"
2. Add employees with roles and availability
3. Assign them to specific zones
4. Set their work schedules
5. Update availability status in real-time

### 3. Monitor Analytics
1. View live metrics on the Dashboard
2. Monitor queue trends and performance
3. Check zone-specific statistics
4. Review AI recommendations

### 4. Respond to Alerts
1. Check notifications for queue alerts
2. Mobilize staff based on recommendations
3. Monitor staffing impact on queue times
4. Optimize zone assignments

## API Endpoints

See `SETUP.md` for complete API reference.

### Key Endpoints
- `GET /api/queue/metrics` - Queue statistics
- `POST /api/video/upload` - Upload surveillance video
- `POST /api/zones/config` - Configure detection zones
- `GET /api/employees` - List employees
- `WS /api/ws` - Real-time updates

## Project Structure

\`\`\`
├── app/
│   ├── page.tsx                 # Main app
│   ├── layout.tsx               # Root layout
│   ├── globals.css              # Global styles
│   └── api/                     # API routes
├── components/
│   ├── layout/                  # Header, sidebar, notifications
│   ├── pages/                   # Main page components
│   ├── employees/               # Employee management components
│   ├── video/                   # Video zone drawing
│   └── realtime/                # Real-time updates
├── lib/
│   ├── api-client.ts            # FastAPI client
│   ├── validators.ts            # Form validators
│   └── demo-data.ts             # Mock data
└── hooks/
    ├── use-notifications.ts     # Notification hook
    ├── use-real-time-data.ts    # Real-time data hook
    └── use-api.ts               # API hook
\`\`\`

## Configuration

### Dark Mode
Toggle dark/light theme via the sun/moon icon in the header. Settings are stored in component state.

### Time Range Filters
Dashboard supports multiple time ranges:
- 1 hour
- 4 hours
- 24 hours
- 7 days

### Zone Customization
- Support for 3 zones per video
- Minimum 3 points per zone
- Maximum 10 points per zone

## Performance Considerations

- **Video Compression**: Compress videos before upload (max 500MB)
- **Zone Simplification**: Use fewer polygon points for faster processing
- **WebSocket Throttling**: Adjust update frequency based on server load
- **Caching**: Frontend caches metrics for 5 seconds

## Security

- CORS enabled for frontend-backend communication
- Rate limiting on video uploads
- Validation of all inputs
- WebSocket authentication ready

## Troubleshooting

### Backend Not Connecting
- Check FastAPI server is running on port 8000
- Verify CORS is properly configured
- Check environment variables

### WebSocket Connection Issues
- Ensure WebSocket URL is correct
- Check browser console for errors
- Verify firewall settings

### Zone Drawing Not Working
- Check video format (MP4, MOV, AVI)
- Ensure video is not corrupted
- Try a different video file

## Future Enhancements

- Database integration for historical data
- Multi-location dashboard
- Advanced scheduling system
- Predictive queue forecasting
- Mobile app for employee notifications
- Integration with POS systems
- Heat map visualization
- Customer satisfaction tracking

## Support

For issues and questions:
1. Check the SETUP.md file
2. Review API documentation at `/api/docs`
3. Check browser console for errors
4. Verify backend logs

## License

Queue AI - All rights reserved

## Contributors

Built with ❤️ for better queue management
