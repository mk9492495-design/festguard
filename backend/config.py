
import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    APP_NAME = "CrowdGuard AI"
    APP_VERSION = "1.0.0"

    HOST = "0.0.0.0"
    PORT = 8000

    MAX_CAMERAS = 3

    MODEL_PATH = os.getenv(
        "MODEL_PATH",
        "../models/yolov8n.pt"
    )

    CONFIDENCE_THRESHOLD = 0.45

    DATABASE_HOST = os.getenv("DB_HOST", "localhost")
    DATABASE_USER = os.getenv("DB_USER", "root")
    DATABASE_PASSWORD = os.getenv("DB_PASSWORD", "")
    DATABASE_NAME = os.getenv("DB_NAME", "crowdguard")

settings = Settings()
