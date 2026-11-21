
from aiortc import RTCPeerConnection
from datetime import datetime, timezone

from cameras.stream_receiver import StreamReceiver


class CameraManager:

    def __init__(self, max_cameras=3):
        self.max_cameras = max_cameras
        self.connections = {}
        self.stream_receiver = StreamReceiver()
        self.cleaning_cameras = set()

    def create_connection(self, camera_id):

        if camera_id in self.connections:
            raise ValueError("Camera ID already exists")

        active_count = sum(
            1 for camera in self.connections.values()
            if camera["status"] in ["connecting", "connected"]
        )

        if active_count >= self.max_cameras:
            raise ValueError("Maximum camera limit reached")

        pc = RTCPeerConnection()

        self.connections[camera_id] = {
            "pc": pc,
            "status": "connecting",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "location": "Unassigned"
        }

        @pc.on("track")
        def on_track(track):

            if track.kind == "video":
                self.stream_receiver.start(camera_id, track)

        @pc.on("connectionstatechange")
        async def on_connection_state_change():

            state = pc.connectionState

            if camera_id in self.connections:
                self.connections[camera_id]["status"] = state

            print(f"[CAMERA] {camera_id}: {state}")

            if state in ["closed", "failed"]:
                await self.cleanup_camera(camera_id)

        return pc

    async def cleanup_camera(self, camera_id):

        if camera_id not in self.connections:
            return

        if camera_id in self.cleaning_cameras:
            return

        self.cleaning_cameras.add(camera_id)

        try:
            print(f"[CAMERA] Cleaning up: {camera_id}")

            await self.stream_receiver.stop(camera_id)

            self.connections.pop(camera_id, None)

            print(f"[CAMERA] Removed: {camera_id}")

        finally:
            self.cleaning_cameras.discard(camera_id)

    def assign_location(self, camera_id, location):

        if camera_id not in self.connections:
            raise ValueError("Camera not found")

        self.connections[camera_id]["location"] = location

    async def remove_camera(self, camera_id):

        if camera_id not in self.connections:
            return False

        pc = self.connections[camera_id]["pc"]

        await self.cleanup_camera(camera_id)

        await pc.close()

        return True

    def get_camera_status(self):

        result = []

        for camera_id, camera in self.connections.items():

            result.append({
                "camera_id": camera_id,
                "status": camera["status"],
                "location": camera["location"],
                "created_at": camera["created_at"],
                "frames_received": self.stream_receiver.get_stats(
                    camera_id
                )
            })

        return result


camera_manager = CameraManager(max_cameras=3)
