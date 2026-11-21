# Sirf testing ke liye. Asli project mein apne heatmap.py / prediction.py / crowd_flow.py etc. se data bharo.
# Run: pip install fastapi uvicorn   ->   uvicorn main:app --reload --port 8000
import random, time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

ZONES = {"g1": ("Main Gate", 300), "g2": ("Side Gate", 150), "rg": ("Registration", 120),
         "fc": ("Food Court", 250), "st": ("Main Stage", 600), "ex": ("Exit Road", 200)}

@app.get("/api/state")
def state():
    zones = []
    for zid, (name, cap) in ZONES.items():
        count = random.randint(int(cap * .2), int(cap * .95))       # TODO: detection.py ka count
        zones.append({"id": zid, "name": name, "capacity": cap, "count": count,
                      "inflow": random.randint(20, 60), "outflow": random.randint(15, 55),  # TODO: crowd_flow.py
                      "prediction_seconds": 90 if count > cap * .8 else None})              # TODO: prediction.py
    return {
        "zones": zones,
        "queues": [{"name": "Food counter 1", "people": 30}, {"name": "Registration A", "people": 12}],  # queue_monitor.py
        "incidents": [{"time": time.strftime("%H:%M:%S"), "zone": "Food Court", "message": "Sudden congestion"}],  # incident_detection.py
        "alerts": [{"zone": "fc", "level": "warning", "notified": False,
                    "suggested_action": "Divert crowd toward the stage"}],  # emergency_alerts.py
    }

@app.post("/api/alerts/{zone_id}/notify")
def notify(zone_id: str):
    return {"ok": True}    # TODO: volunteers ko notification bhejo

@app.post("/api/zones/{zone_id}/divert")
def divert(zone_id: str):
    return {"ok": True}    # TODO: divert action log karo

# Camera: GET /api/video/{zone_id} par MJPEG stream (multipart/x-mixed-replace) do.
# Privacy ke liye sirf blurred/boxes wali anonymous frames bhejo (privacy.py se guzar kar).
