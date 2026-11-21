
import asyncio
from pathlib import Path

import cv2
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from main import app
from cameras.camera_manager import camera_manager


@app.get("/api/state")
def dashboard_state():
    cameras = camera_manager.get_camera_status()

    active_cameras = [
        camera for camera in cameras
        if camera["status"] in ["connecting", "connected"]
    ]

    zones = []

    for camera in active_cameras:
        camera_id = camera["camera_id"]
        analytics = camera_manager.stream_receiver.get_analytics(camera_id)

        zones.append({
            "id": camera_id,
            "name": (
                camera["location"]
                if camera["location"] != "Unassigned"
                else camera_id
            ),
            "count": (
                analytics["person_count"]
                if analytics is not None else None
            ),
            "capacity": None,
            "status": camera["status"],
            "frames_received": camera["frames_received"],
            "prediction_seconds": None,
            "inflow": None,
            "outflow": None
        })

    total_people = sum(
        zone["count"] or 0 for zone in zones
    )

    return {
        "total_people_detected": total_people,
        "connected_cameras": len(active_cameras),
        "zones": zones,
        "alerts": [],
        "incidents": [],
        "queues": []
    }



@app.get("/api/video/{camera_id}")
async def dashboard_video(camera_id: str):
    if camera_id not in camera_manager.connections:
        raise HTTPException(
            status_code=404,
            detail="Camera not found"
        )

    async def generate_frames():
        receiver = camera_manager.stream_receiver

        while camera_id in camera_manager.connections:

            frame = receiver.latest_annotated_frames.get(camera_id)

            if frame is None:
                frame = receiver.latest_frames.get(camera_id)

            if frame is not None:
                success, buffer = cv2.imencode(".jpg", frame)

                if success:
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n\r\n"
                        + buffer.tobytes()
                        + b"\r\n"
                    )

            await asyncio.sleep(0.05)

    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


frontend_dir = (
    Path(__file__).resolve().parent.parent / "crowd-alert-frontend"
)

if not frontend_dir.is_dir():
    raise RuntimeError(
        f"Frontend folder not found: {frontend_dir}"
    )

app.mount(
    "/dashboard",
    StaticFiles(directory=str(frontend_dir), html=True),
    name="dashboard"
)
