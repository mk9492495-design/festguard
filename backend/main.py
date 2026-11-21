from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
from pydantic import BaseModel
from datetime import datetime, timezone

from config import settings
from cameras.camera_manager import camera_manager
from cameras.signaling import create_camera_offer

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI Powered Campus Crowd Monitoring System"
)

# Allow the deployed Vercel frontend to access the Render backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://festguard.vercel.app",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CameraOffer(BaseModel):
    camera_id: str
    sdp: str
    type: str = "offer"


@app.get("/")
def home():
    return {
        "project": "CrowdGuard",
        "message": "CrowdGuard Backend is running!",
        "status": "online",
        "version": settings.APP_VERSION
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "server_time": datetime.now(timezone.utc).isoformat()
    }


# Get active camera count
@app.get("/cameras")
def get_cameras():
    cameras = camera_manager.get_camera_status()

    active_cameras = [
        camera for camera in cameras
        if camera["status"] in ["connecting", "connected"]
    ]

    return {
        "maximum_cameras": settings.MAX_CAMERAS,
        "connected_cameras": len(active_cameras),
        "cameras": active_cameras
    }


# Get individual camera analytics
@app.get("/cameras/{camera_id}/analytics")
def get_camera_analytics(camera_id: str):
    if camera_id not in camera_manager.connections:
        raise HTTPException(
            status_code=404,
            detail="Camera not found"
        )

    camera = camera_manager.connections[camera_id]

    if camera["status"] not in ["connecting", "connected"]:
        raise HTTPException(
            status_code=404,
            detail="Camera is not active"
        )

    analytics = camera_manager.stream_receiver.get_analytics(
        camera_id
    )

    if analytics is None:
        return {
            "camera_id": camera_id,
            "status": "waiting_for_video",
            "message": "No AI analytics available yet"
        }

    return {
        "camera_id": camera_id,
        "status": "processing",
        "person_count": analytics["person_count"],
        "detections": analytics["detections"],
        "processed_at": analytics["processed_at"]
    }


# Overall crowd analytics
@app.get("/analytics/summary")
def get_analytics_summary():
    cameras = camera_manager.get_camera_status()

    active_cameras = [
        camera for camera in cameras
        if camera["status"] in ["connecting", "connected"]
    ]

    total_people = 0
    processed_cameras = 0
    camera_results = []

    for camera in active_cameras:
        camera_id = camera["camera_id"]

        analytics = camera_manager.stream_receiver.get_analytics(
            camera_id
        )

        if analytics is not None:
            count = analytics["person_count"]
            total_people += count
            processed_cameras += 1

            camera_results.append({
                "camera_id": camera_id,
                "location": camera["location"],
                "person_count": count
            })

    return {
        "total_people_detected": total_people,
        "processed_cameras": processed_cameras,
        "connected_cameras": len(active_cameras),
        "camera_results": camera_results
    }


# Receive WebRTC camera connection
@app.post("/cameras/offer")
async def receive_camera_offer(data: CameraOffer):
    try:
        answer = await create_camera_offer(
            data.camera_id,
            data.sdp
        )
        return answer

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# Disconnect camera
@app.delete("/cameras/{camera_id}")
async def disconnect_camera(camera_id: str):
    removed = await camera_manager.remove_camera(camera_id)

    if not removed:
        raise HTTPException(
            status_code=404,
            detail="Camera not found"
        )

    return {
        "message": "Camera disconnected",
        "camera_id": camera_id
    }


# List CrowdGuard features
@app.get("/features")
def get_features():
    return {
        "features": [
            "Crowd Heatmap",
            "AI Crowd Prediction",
            "Crowd Flow Detection",
            "Smart Emergency Alerts",
            "Multi-Camera Intelligence",
            "Smart Queue Monitoring",
            "Privacy-First AI",
            "AI Incident Detection"
        ],
        "total_features": 8
    }


# Serve phone camera page
@app.get("/phone-camera")
def phone_camera():
    file_path = Path(__file__).parent / "phone_camera.html"

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Phone camera page not found"
        )

    return FileResponse(file_path)
