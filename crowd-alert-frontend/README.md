# Campus Crowd Density Alert – Frontend

Plain HTML/CSS/JS. Koi build tool ya npm nahi chahiye.

## Chalane ka tarika
1. Folder mein terminal kholo: `python -m http.server 5500`
2. Browser mein kholo: http://localhost:5500
3. Default mein demo simulation chalta hai (backend ki zarurat nahi).

## Backend se kaise jodna hai
1. Backend chalao (jaise `uvicorn main:app --reload --port 8000`) aur CORS allow karo (sample_backend/main.py dekho).
2. `js/api.js` mein `API_BASE: "http://localhost:8000"` set karo.
3. Page reload karo. Ab dashboard har 2 second mein `GET /api/state` padhega.

## API contract
`GET /api/state` ->
{
  "zones":[{"id":"fc","name":"Food Court","capacity":250,"count":132,"inflow":40,"outflow":22,"prediction_seconds":90 | null}],
  "queues":[{"name":"Food counter 1","people":30}],
  "incidents":[{"time":"14:32:10","zone":"Food Court","message":"Sudden congestion"}],
  "alerts":[{"zone":"fc","level":"critical" | "warning","notified":false,"suggested_action":"Divert crowd toward the stage"}]
}
`POST /api/alerts/{zone_id}/notify` – "Alert volunteers" button dabane par
`POST /api/zones/{zone_id}/divert` – "Divert crowd" button dabane par
`GET  /api/video/{zone_id}` – (optional) MJPEG stream, sirf anonymous frames

## Zone IDs
Frontend ye IDs maanta hai: g1 (Main Gate), g2 (Side Gate), rg (Registration), fc (Food Court), st (Main Stage), ex (Exit Road).
Apne zones alag hain to `js/app.js` ke `const Z=[...]` mein id, name, cap aur map position badlo.

## Kaun si backend file kis panel ko data deti hai
Live map -> heatmap.py | Forecast -> prediction.py | Flow table -> crowd_flow.py | Alerts -> emergency_alerts.py
Cameras -> camera_stream.py + multi_camera.py | Queue -> queue_monitor.py | Incident log -> incident_detection.py
