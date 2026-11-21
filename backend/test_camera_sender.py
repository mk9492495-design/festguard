
import asyncio
import json
import urllib.request
from pathlib import Path

import cv2
from av import VideoFrame
from aiortc import RTCPeerConnection, VideoStreamTrack


PROJECT_ROOT = Path(__file__).resolve().parents[1]
IMAGE_PATH = PROJECT_ROOT / "bus.jpg"


class TestCamera(VideoStreamTrack):

    def __init__(self):
        super().__init__()

        self.image = cv2.imread(str(IMAGE_PATH))

        if self.image is None:
            raise FileNotFoundError(
                f"Cannot load image: {IMAGE_PATH}"
            )

    async def recv(self):
        pts, time_base = await self.next_timestamp()

        frame = VideoFrame.from_ndarray(
            self.image,
            format="bgr24"
        )

        frame.pts = pts
        frame.time_base = time_base

        return frame


async def main():

    pc = RTCPeerConnection()

    pc.addTrack(TestCamera())

    offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    request_data = json.dumps({
        "camera_id": "test_camera_1",
        "type": "offer",
        "sdp": pc.localDescription.sdp
    }).encode("utf-8")

    request = urllib.request.Request(
        "http://127.0.0.1:8000/cameras/offer",
        data=request_data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(request) as response:
            answer = json.loads(response.read().decode("utf-8"))

        from aiortc import RTCSessionDescription

        await pc.setRemoteDescription(
            RTCSessionDescription(
                sdp=answer["sdp"],
                type=answer["type"]
            )
        )

        print("[SUCCESS] Test camera connected!")

        print("Sending video frames for 30 seconds...")

        await asyncio.sleep(30)

    finally:
        await pc.close()


if __name__ == "__main__":
    asyncio.run(main())
