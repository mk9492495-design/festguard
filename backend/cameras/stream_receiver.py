
import asyncio
from aiortc.mediastreams import MediaStreamError

from ai_engine.processor import crowd_processor


class StreamReceiver:

    def __init__(self):
        self.latest_frames = {}
        self.latest_analytics = {}
        self.latest_annotated_frames = {}
        self.frame_counts = {}
        self.tasks = {}
        self.errors = {}

    def start(self, camera_id, track):

        if camera_id in self.tasks:
            return

        self.frame_counts[camera_id] = 0

        task = asyncio.create_task(
            self.receive_stream(camera_id, track)
        )

        self.tasks[camera_id] = task

    async def receive_stream(self, camera_id, track):

        print(f"[CAMERA] Receiving stream: {camera_id}")

        try:

            while True:

                frame = await track.recv()

                image = frame.to_ndarray(format="bgr24")

                self.latest_frames[camera_id] = image

                self.frame_counts[camera_id] = (
                    self.frame_counts.get(camera_id, 0) + 1
                )

                # Process every 5th frame to reduce CPU load
                if self.frame_counts[camera_id] % 5 == 0:

                    result = await crowd_processor.process_frame(image)

                    self.latest_analytics[camera_id] = {
                        "person_count": result["person_count"],
                        "detections": result["detections"],
                        "processed_at": result["processed_at"]
                    }

                    self.latest_annotated_frames[camera_id] = (
                        result["annotated_frame"]
                    )

                    print(
                        f"[AI] {camera_id}: "
                        f"{result['person_count']} people detected"
                    )

        except MediaStreamError:

            print(f"[CAMERA] Stream ended: {camera_id}")

        except asyncio.CancelledError:

            raise

        except Exception as error:

            self.errors[camera_id] = str(error)

            print(f"[CAMERA ERROR] {camera_id}: {error}")

        finally:

            self.tasks.pop(camera_id, None)

    def get_latest_frame(self, camera_id):
        return self.latest_frames.get(camera_id)

    def get_stats(self, camera_id):
        return self.frame_counts.get(camera_id, 0)

    def get_analytics(self, camera_id):
        return self.latest_analytics.get(camera_id)

    async def stop(self, camera_id):

        task = self.tasks.get(camera_id)

        if task:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)

        self.latest_frames.pop(camera_id, None)
        self.latest_analytics.pop(camera_id, None)
        self.latest_annotated_frames.pop(camera_id, None)
        self.frame_counts.pop(camera_id, None)
        self.errors.pop(camera_id, None)
        self.tasks.pop(camera_id, None)
