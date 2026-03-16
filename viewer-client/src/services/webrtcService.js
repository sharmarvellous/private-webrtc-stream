export function createPeerConnection(iceServers) {
  return new RTCPeerConnection({
    iceServers,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require"
  });
}

export function getMediaCaptureStream(videoElement) {
  if (!videoElement) {
    throw new Error("Missing source video element");
  }

  const captureStream =
    videoElement.captureStream?.bind(videoElement) ??
    videoElement.mozCaptureStream?.bind(videoElement);

  if (!captureStream) {
    throw new Error("captureStream() is unavailable in this browser. Chrome-based browsers are recommended for this MVP.");
  }

  const stream = captureStream();
  if (!stream || stream.getTracks().length === 0) {
    throw new Error("Protected video did not expose capturable tracks. Start playback before publishing.");
  }

  return stream;
}

export async function getDisplayCaptureStream(mode = "browser-tab") {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error(
      "Display capture is unavailable in this browser. Use a recent Chrome-based browser for this MVP."
    );
  }

  const video =
    mode === "window"
      ? { displaySurface: "window" }
      : mode === "screen"
        ? { displaySurface: "monitor" }
        : { displaySurface: "browser" };

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video,
    audio: true,
    preferCurrentTab: mode === "browser-tab",
    selfBrowserSurface: mode === "browser-tab" ? "include" : "exclude",
    surfaceSwitching: "include"
  });

  if (!stream || stream.getTracks().length === 0) {
    throw new Error("The selected display source did not expose any capturable media tracks.");
  }

  return stream;
}

export function safelyClosePeerConnection(peerConnection) {
  if (!peerConnection) {
    return;
  }

  peerConnection.onconnectionstatechange = null;
  peerConnection.oniceconnectionstatechange = null;
  peerConnection.onicegatheringstatechange = null;
  peerConnection.onsignalingstatechange = null;
  peerConnection.onicecandidate = null;
  peerConnection.ontrack = null;

  peerConnection.close();
}

export function describePeerConnection(peerConnection) {
  return {
    connectionState: peerConnection.connectionState,
    iceConnectionState: peerConnection.iceConnectionState,
    iceGatheringState: peerConnection.iceGatheringState,
    signalingState: peerConnection.signalingState
  };
}
