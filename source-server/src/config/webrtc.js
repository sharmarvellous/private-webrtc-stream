import { appConfig } from "./env.js";
import { buildSharedIceServers } from "../../../shared/webrtc/ice-config.js";

export function buildIceServers() {
  return buildSharedIceServers({
    stunUrls: appConfig.webrtc.stunUrls,
    turnUrls: appConfig.webrtc.turnUrls,
    turnUsername: appConfig.webrtc.turnUsername,
    turnCredential: appConfig.webrtc.turnCredential
  });
}

export function getWebRtcConfig() {
  return {
    iceServers: buildIceServers(),
    iceTransportPolicy: "all",
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require"
  };
}
