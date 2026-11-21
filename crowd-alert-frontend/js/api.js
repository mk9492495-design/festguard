
const CONFIG = {
  API_BASE: "",
  POLL_MS: 1000
};

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
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error("Backend connection error:", path, error);
    return null;
  }
}

async function apiPost(path) {
  try {
    const response = await fetch(CONFIG.API_BASE + path, {
      method: "POST",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error("Backend action error:", path, error);
    return null;
  }
}
