
import asyncio
import threading
from datetime import datetime, timezone

from ai_engine.detector import CrowdDetector


class CrowdAIProcessor:

    def __init__(self):
        self.detector = None
        self.lock = threading.Lock()

    def _detect_sync(self, frame):

        with self.lock:

            if self.detector is None:
                self.detector = CrowdDetector()

            return self.detector.detect_people(frame)

    async def process_frame(self, frame):

        result = await asyncio.to_thread(
            self._detect_sync,
            frame
        )

        return {
            "person_count": result["person_count"],
            "detections": result["detections"],
            "annotated_frame": result["annotated_frame"],
            "processed_at": datetime.now(timezone.utc).isoformat()
        }


crowd_processor = CrowdAIProcessor()
