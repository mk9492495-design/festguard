
// CrowdGuard dashboard - real FastAPI backend

const $ = id => document.getElementById(id);

const STATE = {
  data: null,
  selected: null,
  cameraIds: null,
  polling: false,
  mapListenerReady: false
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

// Density status is calculated only when real capacity is supplied.
function getStatus(zone) {
  if (
    zone.count == null ||
    zone.capacity == null ||
    Number(zone.capacity) <= 0
  ) {
    return {
      level: -1,
      label: "Capacity not configured",
      color: "#64748b"
    };
  }

  const ratio = Number(zone.count) / Number(zone.capacity);

  if (ratio >= 0.9) {
    return { level: 3, label: "Critical", color: "var(--crit)" };
  }

  if (ratio >= 0.65) {
    return { level: 2, label: "High", color: "var(--high)" };
  }

  if (ratio >= 0.4) {
    return { level: 1, label: "Moderate", color: "var(--mod)" };
  }

  return { level: 0, label: "Safe", color: "var(--safe)" };
}

function renderStats(data) {
  const zones = data.zones || [];

  $("tot").textContent = data.total_people_detected ?? 0;

  $("ncrit").textContent = zones.filter(
    zone => getStatus(zone).level === 3
  ).length;

  $("nal").textContent = (data.alerts || []).length;
}

// LIVE CAMPUS MAP
// Camera locations are displayed as schematic zone boxes.
// Actual campus geography requires real campus coordinates.
function renderMap(zones) {
  const map = $("map");
  if (!map) return;

  if (!zones.length) {
    map.innerHTML = `
      <rect x="10" y="10" width="620" height="370"
        rx="16" fill="#64748b" fill-opacity=".06"
        stroke="#64748b" stroke-dasharray="6 6"/>

      <text x="320" y="175" text-anchor="middle"
        fill="currentColor" font-size="22" font-weight="700">
        Live Campus Map
      </text>

      <text x="320" y="210" text-anchor="middle"
        fill="currentColor" opacity=".65" font-size="14">
        Waiting for connected camera data
      </text>
    `;

    return;
  }

  const positions = [
    { x: 20, y: 25 },
    { x: 330, y: 25 },
    { x: 20, y: 205 },
    { x: 330, y: 205 }
  ];

  let output = `
    <rect x="0" y="0" width="640" height="390"
      rx="14" fill="#64748b" fill-opacity=".045"/>

    <path d="M 10 190 H 630"
      stroke="#64748b" stroke-opacity=".25"
      stroke-width="12" stroke-dasharray="8 8"/>

    <path d="M 320 10 V 380"
      stroke="#64748b" stroke-opacity=".20"
      stroke-width="10" stroke-dasharray="8 8"/>

    <text x="320" y="190" text-anchor="middle"
      fill="currentColor" opacity=".55" font-size="10">
      CAMPUS ROUTE
    </text>
  `;

  zones.forEach((zone, index) => {
    const position = positions[index % positions.length];
    const status = getStatus(zone);

    const x = position.x;
    const y = position.y;

    const name = zone.name === "Unassigned"
      ? "Phone Camera"
      : zone.name;

    const count = zone.count == null
      ? "Waiting..."
      : `${zone.count} people`;

    const selected = zone.id === STATE.selected;

    output += `
      <g class="map-zone"
         data-zone-id="${escapeHTML(zone.id)}"
         style="cursor:pointer">

        <rect
          x="${x}" y="${y}"
          width="280" height="145"
          rx="13"
          fill="${status.color}"
          fill-opacity="${status.level === -1 ? ".10" : ".16"}"
          stroke="${status.color}"
          stroke-width="${selected ? 4 : 2}"
        />

        <circle
          cx="${x + 24}" cy="${y + 27}"
          r="7"
          fill="${status.color}"
        />

        <text
          x="${x + 42}" y="${y + 32}"
          fill="currentColor"
          font-size="16"
          font-weight="700">
          ${escapeHTML(name).slice(0, 24)}
        </text>

        <text
          x="${x + 18}" y="${y + 75}"
          fill="currentColor"
          font-size="24"
          font-weight="700">
          ${escapeHTML(count)}
        </text>

        <text
          x="${x + 18}" y="${y + 105}"
          fill="${status.color}"
          font-size="13"
          font-weight="700">
          ${escapeHTML(status.label)}
        </text>

        <text
          x="${x + 18}" y="${y + 127}"
          fill="currentColor"
          opacity=".65"
          font-size="11">
          ${escapeHTML(zone.status || "Unknown")} · ${escapeHTML(zone.frames_received ?? 0)} frames
        </text>

      </g>
    `;
  });

  map.innerHTML = output;

  // Register one click listener for map zone selection.
  if (!STATE.mapListenerReady) {
    map.addEventListener("click", event => {
      const group = event.target.closest("[data-zone-id]");
      if (!group || !STATE.data) return;

      STATE.selected = group.getAttribute("data-zone-id");

      renderMap(STATE.data.zones || []);
      renderPrediction(STATE.data.zones || []);
    });

    STATE.mapListenerReady = true;
  }
}

function renderCameras(zones) {
  const ids = zones.map(zone => zone.id).join("|");

  const secure = window.location.protocol === "https:";
  const phoneUrl = `${window.location.origin}/phone-camera`;

  const connectCard = `
    <div class="card" style="padding:14px;margin-bottom:12px">
      <h3>Connect iPhone Camera</h3>
      <p class="hint">
        Open this secure camera link on your iPhone to start live video.
      </p>

      ${
        secure
          ? `
            <a href="${phoneUrl}" target="_blank"
               rel="noopener noreferrer"
               style="display:inline-block;padding:10px 14px;
               background:var(--acc);color:white;border-radius:8px;
               text-decoration:none">
              Open Camera Setup
            </a>
            <p class="hint" style="word-break:break-all">
              ${escapeHTML(phoneUrl)}
            </p>
          `
          : `
            <p class="hint">
              HTTPS is required for iPhone camera permission.
              Open the dashboard using its secure HTTPS address.
            </p>
          `
      }
    </div>
  `;

  if (ids !== STATE.cameraIds) {
    STATE.cameraIds = ids;

    $("cams").innerHTML = connectCard + (
      zones.length
        ? zones.map((zone, index) => `
          <div class="card" style="padding:10px">
            <img
              src="/api/video/${encodeURIComponent(zone.id)}"
              alt="Live camera feed for ${escapeHTML(zone.name)}"
              style="width:100%;aspect-ratio:16/10;
              object-fit:contain;background:#111"
            />

            <div class="cm">
              <b>Camera ${index + 1} · ${escapeHTML(zone.name)}</b>
            </div>

            <div class="cm" id="camera-meta-${index}"></div>
          </div>
        `).join("")
        : `
          <p class="empty">
            No mobile cameras connected yet.
            Connect your iPhone to see its live feed here.
          </p>
        `
    );
  }

  zones.forEach((zone, index) => {
    const status = getStatus(zone);

    const count = zone.count == null
      ? "Waiting for detection"
      : `${zone.count} people`;

    const meta = $(`camera-meta-${index}`);

    if (meta) {
      meta.textContent =
        `${status.label} · ${count} · ${zone.status || "Unknown"}`;
    }
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
      <p class="empty">Connect a camera to view its analytics.</p>
    `;
    return;
  }

  const status = getStatus(zone);
  const count = zone.count == null ? "Waiting for detection" : zone.count;
  const capacity = zone.capacity == null ? "Not configured" : zone.capacity;

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
      <span class="mono"> / ${escapeHTML(capacity)} capacity</span>
    </div>

    <p>${escapeHTML(prediction)}</p>
    <p class="hint">Camera status: ${escapeHTML(zone.status || "Unknown")}</p>
    <p class="hint">Frames received: ${escapeHTML(zone.frames_received ?? 0)}</p>
  `;
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

    $("qs").textContent =
      "Queue data is not currently provided by the backend.";

    return;
  }

  $("q").innerHTML = queues.map(queue => `
    <tr>
      <td>${escapeHTML(queue.name)}</td>
      <td>${escapeHTML(queue.people ?? "—")}</td>
      <td>${escapeHTML(queue.wait_minutes ?? "—")}</td>
    </tr>
  `).join("");

  $("qs").textContent =
    "Showing queue information received from the backend.";
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

// Poll every second, without overlapping requests.
async function pollBackend() {
  if (STATE.polling) return;

  STATE.polling = true;

  try {
    const data = await apiGet("/api/state");

    if (data) {
      renderDashboard(data);
    } else {
      $("alerts").innerHTML =
        '<p class="empty">Cannot reach the backend. Check whether the server is running.</p>';
    }
  } catch (error) {
    console.error("Dashboard update failed:", error);
  } finally {
    STATE.polling = false;

    setTimeout(pollBackend, CONFIG.POLL_MS);
  }
}

function boot() {
  $("tot").textContent = "—";
  $("ncrit").textContent = "—";
  $("nal").textContent = "—";

  pollBackend();
}

boot();
