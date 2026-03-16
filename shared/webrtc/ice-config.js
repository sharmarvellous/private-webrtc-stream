export function buildSharedIceServers({
  stunUrls = ["stun:stun.l.google.com:19302"],
  turnUrls = [],
  turnUsername = "",
  turnCredential = ""
} = {}) {
  const iceServers = [];

  if (stunUrls.length > 0) {
    iceServers.push({ urls: stunUrls });
  }

  if (turnUrls.length > 0) {
    iceServers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential
    });
  }

  return iceServers;
}
