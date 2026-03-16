const resolvedServerUrl =
  import.meta.env.VITE_SOURCE_SERVER_URL ?? window.location.origin ?? "http://localhost:5000";
const SOURCE_SERVER_URL = resolvedServerUrl.replace(/\/$/, "");
const API_BASE_URL = `${SOURCE_SERVER_URL}/api`;

async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type") ?? "";
  const rawText = await response.text();
  const trimmedText = rawText.trim();

  if (!trimmedText) {
    return null;
  }

  if (contentType.includes("application/json")) {
    return JSON.parse(trimmedText);
  }

  return rawText;
}

export async function httpRequest(path, { accessToken, method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      "Cache-Control": "no-cache"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await parseResponseBody(response);
  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Request failed with status ${response.status}`);
  }

  return data;
}

export async function authenticatedFetch(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: {
      Accept: "*/*",
      ...(options.headers ?? {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      "Cache-Control": "no-cache"
    }
  });

  if (!response.ok) {
    const parsed = await parseResponseBody(response);
    let message = `Request failed with status ${response.status}`;

    if (parsed && typeof parsed === "object") {
      message = parsed?.error?.message ?? message;
    } else if (typeof parsed === "string" && parsed.trim()) {
      message = parsed;
    }

    throw new Error(message);
  }

  return response;
}

export { API_BASE_URL, SOURCE_SERVER_URL };
