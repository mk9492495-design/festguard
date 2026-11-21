
from aiortc import RTCSessionDescription
from cameras.camera_manager import camera_manager


async def create_camera_offer(camera_id, offer_sdp):
    pc = camera_manager.create_connection(camera_id)

    try:
        offer = RTCSessionDescription(
            sdp=offer_sdp,
            type="offer"
        )

        await pc.setRemoteDescription(offer)

        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        return {
            "camera_id": camera_id,
            "type": pc.localDescription.type,
            "sdp": pc.localDescription.sdp
        }

    except Exception:
        await camera_manager.remove_camera(camera_id)
        raise
