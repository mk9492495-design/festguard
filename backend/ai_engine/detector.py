
from pathlib import Path
from ultralytics import YOLO


class CrowdDetector:

    def __init__(self, confidence=0.45):
        self.confidence = confidence

        # Locate yolo26n.pt in the main project folder
        project_root = Path(__file__).resolve().parents[2]
        self.model_path = project_root / "yolo26n.pt"

        if not self.model_path.exists():
            raise FileNotFoundError(
                f"YOLO model not found: {self.model_path}"
            )

        print(f"[AI] Loading model: {self.model_path}")
        self.model = YOLO(str(self.model_path))
        print("[AI] Crowd detection model loaded!")

    def detect_people(self, frame):

        if frame is None:
            raise ValueError("Empty camera frame received")

        results = self.model.predict(
            source=frame,
            conf=self.confidence,
            classes=[0],  # Class 0 = Person
            verbose=False
        )

        detections = []

        for result in results:
            if result.boxes is None:
                continue

            boxes = result.boxes

            for box in boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().tolist()
                confidence = float(box.conf[0].cpu())

                detections.append({
                    "class": "person",
                    "confidence": round(confidence, 3),
                    "bbox": [
                        int(x1),
                        int(y1),
                        int(x2),
                        int(y2)
                    ]
                })

            annotated_frame = result.plot()

        return {
            "person_count": len(detections),
            "detections": detections,
            "annotated_frame": annotated_frame
        }
