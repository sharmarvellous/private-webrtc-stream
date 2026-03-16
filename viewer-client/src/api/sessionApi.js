import { httpRequest } from "./httpClient.js";

export const sessionApi = {
  listSessions(accessToken) {
    return httpRequest("/sessions", { accessToken });
  },
  getSession(accessToken, sessionId) {
    return httpRequest(`/sessions/${sessionId}`, { accessToken });
  },
  createSession(accessToken, payload) {
    return httpRequest("/sessions", {
      accessToken,
      method: "POST",
      body: payload
    });
  },
  requestViewerAccess(accessToken, sessionId) {
    return httpRequest(`/sessions/${sessionId}/viewer-request`, {
      accessToken,
      method: "POST"
    });
  },
  approveViewer(accessToken, sessionId, viewerId) {
    return httpRequest(`/sessions/${sessionId}/approve-viewer`, {
      accessToken,
      method: "POST",
      body: { viewerId }
    });
  },
  endSession(accessToken, sessionId, reason) {
    return httpRequest(`/sessions/${sessionId}/end`, {
      accessToken,
      method: "POST",
      body: reason ? { reason } : {}
    });
  }
};
