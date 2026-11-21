// CrowdGuard API Configuration

const CONFIG = {
  API_BASE: "https://festguard.onrender.com",
  POLL_MS: 1000
};

// GET request
async function apiGet(path) {
  try {
    const response = await fetch(CONFIG.API_BASE + path, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    return await response.json();

  } catch (error) {
    console.error(
      "CrowdGuard backend GET error:",
      CONFIG.API_BASE + path,
      error
    );
    return null;
  }
}

// POST request
async function apiPost(path, body = null) {
  try {
    const options = {
      method: "POST",
      cache: "no-store",
      headers: {
        "Accept": "application/json"
      }
    };

    if (body !== null) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetch(CONFIG.API_BASE + path, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    return await response.json();

  } catch (error) {
    console.error(
      "CrowdGuard backend POST error:",
      CONFIG.API_BASE + path,
      error
    );
    return null;
  }
}

// Backend connection test
async function checkBackendConnection() {
  const result = await apiGet("/health");

  if (result && result.status === "healthy") {
    console.log("CrowdGuard backend connected successfully!");
    return true;
  }

  console.error("CrowdGuard backend connection failed.");
  return false;
}
