cd /Users/manpreetkaur/H7_Crowd_Detection/crowd-alert-frontend

cp js/app.js js/app_backup.js

cat > js/app.js <<'EOF'
// CrowdGuard dashboard - connected to the real FastAPI backend

const $ = id => document.getElementById(id);

const STATE = {
  data: null,
  selected: null,
  cameraIds: ""
};

const SC = [
  ["safe", "Safe"],
  ["mod", "Moderate"],
  ["high", "High"],
  ["crit", "Critical"]
];

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function getStatus(zone) {
  if (zone.count == null || zone.capacity == null || zone.capacity <= 0) {
    return { level: -1, label: "Waiting for detection", color: "var(--mut)" };
  }

  const ratio = zone.count / zone.capacity;

  if (ratio >= 0.9) return { level: 3, label: "Critical", color: "var(--crit)" };
  if (ratio >= 0.65) return { level: 2, label: "High", color: "var(--high)" };
  if (ratio >= 0.4) return { level: 1, label: "Moderate", color: "var(--mod)" };

  return { level: 0, label: "Safe", color: "var(--safe)" };
}

function renderStats(data) {
  $("tot").textContent = data.total_people_detected ?? 0;

  const zones = data.zones || [];
  $("ncrit").textContent = zones.filter(z => getStatus(z).level === 3).length;
  $("nal").textContent = (data.alerts || []).length;
}

function renderMap(zones) {
  const map = $("map");

  if (!zones.length) {
    map.innerHTML = `
      <text x="320" y="180" text-anchor="middle"
        fill="var(--mut)" font-size="18">
        No connected cameras yet
      </text>`;
    return;
  }

  const columns = 2;
  const width = 280;
  const height = 125;

  map.innerHTML = zones.map((zone, index) => {
    const x = 15 + (index % columns) * 315;
    const y = 15 + Math.floor(index / columns) * 145;
    const status = getStatus(zone);
    const selected = STATE.selected === zone.id;

    const count = zone.count == null ? "Waiting" : zone.count;
    const capacity = zone.capacity == null ? "Capacity unknown" : `/ ${zone.capacity}`;

    return `
      <g class="z" data-zone="${escapeHTML(zone.id)}"
        tabindex="0" role="button"
        style="cursor:pointer">
        <rect x="${x}" y="${y}" width="${width}" height="${height}"
          rx="8" fill="${status.color}"
          fill-opacity=".22"
          stroke="${selected ? "var(--acc)" : status.color}"
          stroke-width="${selected ? 4 : 2}"/>
        <text x="${x + 14}" y="${y + 32}"
          fill="var(--fg)" font-size="16">
          ${escapeHTML(zone.name)}
        </text>
        <text x="${x + 14}" y="${y + 72}"
          fill="var(--fg)" font-size="23">
          ${escapeHTML(count)}
        </text>
        <text x="${x + 14}" y="${y + 98}"
          fill="var(--mut)" font-size="13">
          ${escapeHTML(capacity)} · ${escapeHTML(status.label)}
        </text>
      </g>`;
  }).join("");

  map.querySelectorAll("[data-zone]").forEach(element => {
    const select = () => {
      STATE.selected = element.dataset.zone;
      renderDashboard(STATE.data);
    };

    element.addEventListener("click", select);
    element.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
  });
}

function renderAlerts(alerts) {
  if (!alerts.length) {
    $("alerts").innerHTML =
      '<p class="empty">No active alerts reported by the backend.</p>';
    return;
  }

  $("alerts").innerHTML = alerts.map(alert => `
    <div class="alert">
      <h3>${escapeHTML(alert.message || alert.title || "Backend alert")}</h3>
      <p>${escapeHTML(alert.suggested_action || "No suggested action provided.")}</p>
    </div>
  `).join("");
}

function renderPrediction(zones) {
  const zone = zones.find(item => item.id === STATE.selected);

  if (!zone) {
    $("pred").innerHTML = `
      <h2>No camera selected</h2>
      <p class="empty">Connect a camera to view its analytics.</p>`;
    return;
  }

  const status = getStatus(zone);
  const count = zone.count == null ? "Waiting for detection" : zone.count;
  const capacity = zone.capacity == null ? "Unknown" : zone.capacity;

  const prediction = zone.prediction_seconds == null
    ? "Prediction is not available from the backend yet."
    : `Estimated time to critical density: ${zone.prediction_seconds} seconds.`;

  $("pred").innerHTML = `
    <div class="head">
      <h2>${escapeHTML(zone.name)}</h2>
      <span class="chip">${escapeHTML(status.label)}</span>
    </div>
    <div class="big">
      ${escapeHTML(count)}
      <span class="mono"> / ${escapeHTML(capacity)} people</span>
    </div>
    <p>${escapeHTML(prediction)}</p>
    <p class="hint">Camera status: ${escapeHTML(zone.status || "Unknown")}</p>
    <p class="hint">Frames received: ${escapeHTML(zone.frames_received ?? 0)}</p>
  `;
}

function renderCameras(zones) {
  const ids = zones.map(zone => zone.id).join("|");

  if (ids !== STATE.cameraIds) {
    STATE.cameraIds = ids;

    $("cams").innerHTML = zones.length
      ? zones.map((zone, index) => `
          <div class="card" style="padding:10px">
            <img
              src="/api/video/${encodeURIComponent(zone.id)}"
              alt="Live camera feed for ${escapeHTML(zone.name)}"
              style="width:100%;aspect-ratio:16/10;object-fit:contain;background:#111"
            />
            <div class="cm">
              <b>Camera ${index + 1} · ${escapeHTML(zone.name)}</b>
            </div>
            <div class="cm" id="camera-meta-${index}"></div>
          </div>
        `).join("")
      : '<p class="empty">No mobile cameras connected. Connect your phone camera to see the live feed here.</p>';
  }

  zones.forEach((zone, index) => {
    const status = getStatus(zone);
    const count = zone.count == null
      ? "Waiting for detection"
      : `${zone.count} people`;

    const meta = $(`camera-meta-${index}`);

    if (meta) {
      meta.textContent =
        `${status.label} · ${count} · ${zone.status || "Unknown connection"}`;
    }
  });
}

function renderFlow(zones) {
  if (!zones.length) {
    $("flow").innerHTML =
      '<tr><td colspan="4">No camera data available.</td></tr>';
    return;
  }

  $("flow").innerHTML = zones.map(zone => `
    <tr>
      <td>${escapeHTML(zone.name)}</td>
      <td>${zone.inflow == null ? "—" : escapeHTML(zone.inflow)}</td>
      <td>${zone.outflow == null ? "—" : escapeHTML(zone.outflow)}</td>
      <td>Not available</td>
    </tr>
  `).join("");
}

function renderQueues(queues) {
  if (!queues.length) {
    $("q").innerHTML =
      '<tr><td colspan="3">Queue monitoring is not connected yet.</td></tr>';
    $("qs").textContent = "Queue data is not currently provided by the backend.";
    return;
  }

  $("q").innerHTML = queues.map(queue => `
    <tr>
      <td>${escapeHTML(queue.name)}</td>
      <td>${escapeHTML(queue.people ?? "—")}</td>
      <td>${escapeHTML(queue.wait_minutes ?? "—")}</td>
    </tr>
  `).join("");

  $("qs").textContent = "Showing queue information received from the backend.";
}

function renderIncidents(incidents) {
  $("inc").innerHTML = incidents.length
    ? incidents.map(item => `
        <li>
          <time>${escapeHTML(item.time || "")}</time>
          <span>${escapeHTML(item.zone || "")} · ${escapeHTML(item.message || "")}</span>
        </li>
      `).join("")
    : '<li><span class="empty">No incidents reported by the backend.</span></li>';
}

function renderDashboard(data) {
  if (!data) return;

  STATE.data = data;

  const zones = data.zones || [];

  if (!zones.some(zone => zone.id === STATE.selected)) {
    STATE.selected = zones.length ? zones[0].id : null;
  }

  $("clock").textContent = new Date().toLocaleTimeString("en-IN");

  renderStats(data);
  renderMap(zones);
  renderAlerts(data.alerts || []);
  renderPrediction(zones);
  renderCameras(zones);
  renderFlow(zones);
  renderQueues(data.queues || []);
  renderIncidents(data.incidents || []);
}

async function pollBackend() {
  const data = await apiGet("/api/state");

  if (data) {
    renderDashboard(data);
  } else {
    $("alerts").innerHTML =
      '<p class="empty">Cannot reach the backend. Check whether the server is running.</p>';
  }
}

async function boot() {
  $("tot").textContent = "—";
  $("ncrit").textContent = "—";
  $("nal").textContent = "—";

  await pollBackend();
  setInterval(pollBackend, CONFIG.POLL_MS);
}

boot();
EOF