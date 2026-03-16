import { useEffect, useRef, useState } from "react";
import { createAuthenticatedSocket } from "../services/socketService.js";
import {
  getDisplayCaptureStream,
  createPeerConnection,
  describePeerConnection,
  getMediaCaptureStream,
  safelyClosePeerConnection
} from "../services/webrtcService.js";

const INITIAL_DEBUG_STATE = {
  connectionState: "new",
  iceConnectionState: "new",
  iceGatheringState: "new",
  signalingState: "stable"
};

export function useSourceStreaming({ accessToken, session, sourceVideoRef, previewVideoRef }) {
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingRemoteCandidatesRef = useRef([]);
  const isCleaningUpRef = useRef(false);
  const isSignalingReadyRef = useRef(false);
  const socketListenersBoundRef = useRef(false);
  const [debugState, setDebugState] = useState(INITIAL_DEBUG_STATE);
  const [publishState, setPublishState] = useState("idle");
  const [captureMode, setCaptureMode] = useState("video-element");
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  function refreshDebugState() {
    if (!peerConnectionRef.current) {
      setDebugState(INITIAL_DEBUG_STATE);
      return;
    }

    setDebugState(describePeerConnection(peerConnectionRef.current));
  }

  function bindPeerConnectionEvents(peerConnection, socket, sessionId) {
    peerConnection.onconnectionstatechange = () => {
      refreshDebugState();
      if (isCleaningUpRef.current) {
        return;
      }
      if (peerConnection.connectionState === "connected") {
        setPublishState("publishing");
      }
      if (["failed", "disconnected", "closed"].includes(peerConnection.connectionState)) {
        setPublishState("error");
      }
      socket.emit("peer:state", {
        sessionId,
        state: describePeerConnection(peerConnection)
      });
    };

    peerConnection.oniceconnectionstatechange = refreshDebugState;
    peerConnection.onicegatheringstatechange = refreshDebugState;
    peerConnection.onsignalingstatechange = refreshDebugState;
    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      if (!isSignalingReadyRef.current) {
        return;
      }

      socket.emit("signal:ice-candidate", {
        sessionId,
        candidate: event.candidate.toJSON()
      });
    };
  }

  function connectSocket(socket) {
    return new Promise((resolve, reject) => {
      const onConnect = () => {
        socket.off("connect_error", onError);
        resolve();
      };
      const onError = (error) => {
        socket.off("connect", onConnect);
        reject(error);
      };

      socket.once("connect", onConnect);
      socket.once("connect_error", onError);
      socket.connect();
    });
  }

  async function addOrQueueRemoteCandidate(candidateInit) {
    if (!candidateInit) {
      return;
    }

    const peerConnection = peerConnectionRef.current;
    if (!peerConnection) {
      return;
    }

    if (!peerConnection.remoteDescription) {
      pendingRemoteCandidatesRef.current.push(candidateInit);
      return;
    }

    try {
      await peerConnection.addIceCandidate(candidateInit);
    } catch {
      if (!isCleaningUpRef.current) {
        throw new Error("Failed to apply remote ICE candidate");
      }
    }
  }

  async function flushRemoteCandidates() {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection?.remoteDescription) {
      return;
    }

    for (const candidateInit of pendingRemoteCandidatesRef.current) {
      await addOrQueueRemoteCandidate(candidateInit);
    }

    pendingRemoteCandidatesRef.current = [];
  }

  async function acquireLocalStream(mode) {
    if (mode !== "video-element") {
      return getDisplayCaptureStream(mode);
    }

    return getMediaCaptureStream(sourceVideoRef.current);
  }

  function bindLocalStreamLifecycle(stream) {
    const handleTrackEnded = () => {
      if (isCleaningUpRef.current) {
        return;
      }

      setPublishState("ended");
      cleanup({ preserveVideoPreview: true, keepStatus: true });
    };

    stream.getTracks().forEach((track) => {
      track.onended = handleTrackEnded;
    });
  }

  function clearPeerConnection(options = {}) {
    isSignalingReadyRef.current = false;
    safelyClosePeerConnection(peerConnectionRef.current);
    peerConnectionRef.current = null;
    pendingRemoteCandidatesRef.current = [];

    if (!options.preserveLocalStream) {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (!options.preserveVideoPreview && previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }

    setDebugState(INITIAL_DEBUG_STATE);
  }

  function bindSocketListeners(socket, sessionId) {
    if (socketListenersBoundRef.current) {
      return;
    }

    socket.on("signal:answer", async ({ answer }) => {
      const peerConnection = peerConnectionRef.current;
      if (
        answer?.sdp &&
        peerConnection &&
        !peerConnection.currentRemoteDescription &&
        peerConnection.signalingState === "have-local-offer"
      ) {
        await peerConnection.setRemoteDescription(answer);
        await flushRemoteCandidates();
        refreshDebugState();
      }
    });

    socket.on("signal:ice-candidate", async ({ candidate }) => {
      if (!candidate?.candidate) {
        return;
      }

      await addOrQueueRemoteCandidate(candidate.candidate);
    });

    socket.on("peer:joined", async ({ role }) => {
      if (
        role !== "viewer" ||
        !localStreamRef.current ||
        !session?.id ||
        isCleaningUpRef.current ||
        peerConnectionRef.current
      ) {
        return;
      }

      setPublishState("connecting");
      await createAndSendOffer(socket, sessionId, localStreamRef.current);
    });

    socket.on("peer:left", ({ role }) => {
      if (role !== "viewer") {
        return;
      }

      clearPeerConnection({ preserveLocalStream: true, preserveVideoPreview: true });
      setPublishState("waiting_for_viewer");
    });

    socket.on("session:ended", () => {
      setPublishState("ended");
      cleanup({ preserveVideoPreview: true, keepStatus: true });
    });

    socketListenersBoundRef.current = true;
  }

  async function createAndSendOffer(socket, sessionId, localStream) {
    clearPeerConnection({ preserveLocalStream: true, preserveVideoPreview: true });

    const peerConnection = createPeerConnection(session?.webRtcConfig?.iceServers ?? []);
    peerConnectionRef.current = peerConnection;
    bindPeerConnectionEvents(peerConnection, socket, sessionId);

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    const joinResponse = await new Promise((resolve, reject) => {
      socket.emit("session:join", { sessionId }, (response) => {
        if (!response?.ok) {
          reject(new Error(response?.error ?? "Failed to join signaling session"));
          return;
        }

        resolve(response);
      });
    });
    isSignalingReadyRef.current = true;

    const bufferedViewerCandidates = joinResponse.session.viewerIceCandidates ?? [];
    for (const entry of bufferedViewerCandidates) {
      if (entry?.candidate) {
        await addOrQueueRemoteCandidate(entry.candidate);
      }
    }

    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await peerConnection.setLocalDescription(offer);
    refreshDebugState();

    await new Promise((resolve, reject) => {
      socket.emit(
        "signal:offer",
        {
          sessionId,
          sdp: offer.sdp
        },
        (response) => {
          if (!response?.ok) {
            reject(new Error(response?.error ?? "Failed to send SDP offer"));
            return;
          }

          resolve();
        }
      );
    });
  }

  async function startPublishing(options = {}) {
    if (!session?.id) {
      throw new Error("Create or select a session before publishing");
    }

    setError("");
    cleanup({ preserveVideoPreview: true, keepStatus: true });
    setPublishState("connecting");

    try {
      const nextCaptureMode = options.captureMode ?? "video-element";
      setCaptureMode(nextCaptureMode);
      const socket = createAuthenticatedSocket(accessToken);
      socketRef.current = socket;
      isCleaningUpRef.current = false;
      socketListenersBoundRef.current = false;

      const localStream = await acquireLocalStream(nextCaptureMode);
      localStreamRef.current = localStream;
      bindLocalStreamLifecycle(localStream);

      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = localStream;
        previewVideoRef.current.muted = true;
        previewVideoRef.current.play().catch(() => {});
      }

      bindSocketListeners(socket, session.id);
      await connectSocket(socket);
      await createAndSendOffer(socket, session.id, localStream);
      setError("");
    } catch (publishError) {
      setError(publishError.message ?? "Failed to start publishing");
      setPublishState("error");
      cleanup({ preserveVideoPreview: true });
      throw publishError;
    }
  }

  function cleanup(options = {}) {
    isCleaningUpRef.current = true;
    socketRef.current?.disconnect();
    socketRef.current = null;
    socketListenersBoundRef.current = false;
    clearPeerConnection({
      preserveLocalStream: false,
      preserveVideoPreview: options.preserveVideoPreview
    });
    if (!options.keepStatus) {
      setPublishState("idle");
    }
  }

  async function stopPublishing(options = {}) {
    if (socketRef.current && session?.id) {
      if (options.notifyServer !== false) {
        socketRef.current.emit("session:end", {
          sessionId: session.id,
          reason: "ended_by_source_from_ui"
        });
      }
    }

    cleanup();
    setPublishState("ended");
  }

  return {
    captureMode,
    debugState,
    publishState,
    error,
    startPublishing,
    stopPublishing
  };
}
