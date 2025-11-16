from fastapi import FastAPI, UploadFile, File, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import shutil
import os

from services.analyzer import analyze_video_with_zones
from models.zone import ZoneRequest

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

# =====================================================
# ================ 1) FILE UPLOAD =====================
# =====================================================

@app.post("/upload-video")
async def upload_video(file: UploadFile = File(...)):
    video_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"video_path": video_path}

# =====================================================
# =========== 2) ANALYZE MULTI-ZONE ===================
# =====================================================

@app.post("/analyze-multi-zone")
async def analyze_multi_zone(request: ZoneRequest):
    result = analyze_video_with_zones(
        video_path=request.video_path,
        zones=request.zones
    )
    return JSONResponse(result)

# =====================================================
# =============== 3) WEBSOCKET API ====================
# =====================================================

@app.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    await ws.send_json({"message": "WebSocket connected."})
    while True:
        data = await ws.receive_text()
        await ws.send_json({"echo": data})
