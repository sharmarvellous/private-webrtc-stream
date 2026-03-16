import { useEffect, useRef, useState } from "react";
import { createAuthenticatedSocket } from "../services/socketService.js";
import {
  createPeerConnection,
  describePeerConnection,
  safelyClosePeerConnection
} from "../services/webrtcService.js";

const INITIAL_DEBUG_STATE = {
  connectionState: "new",
  iceConnectionState: "new",
  iceGatheringState: "new",
  signalingState: "stable"
};

export function useViewerStreaming({ accessToken, session, remoteVideoRef }) {
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const pendingRemoteCandidatesRef = useRef([]);
  const isCleaningUpRef = useRef(false);
  const hasAnsweredRef = useRef(false);
  const isSignalingReadyRef = useRef(false);
  const remoteStreamRef = useRef(null);
  const [debugState, setDebugState] = useState(INITIAL_DEBUG_STATE);
  const [viewerState, setViewerState] = useState("idle");
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
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
        setViewerState("viewing");
      }
      if (["failed", "disconnected", "closed"].includes(peerConnection.connectionState)) {
        setViewerState("error");
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
    peerConnection.ontrack = (event) => {
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }

      const [stream] = event.streams;
      const trackSource = stream?.getTracks?.() ?? [event.track];
      trackSource.forEach((track) => {
        if (!remoteStreamRef.current.getTracks().some((existingTrack) => existingTrack.id === track.id)) {
          remoteStreamRef.current.addTrack(track);
        }
      });

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.play().catch(() => {});
      }

      setHasRemoteStream(true);
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

  async function connectViewer(sessionOverride = session) {
    if (!sessionOverride?.id || !sessionOverride.webRtcConfig?.iceServers) {
      throw new Error("An approved session with WebRTC config is required");
    }

    setError("");
    cleanup({ keepState: true });
    setViewerState("connecting");

    try {
      const socket = createAuthenticatedSocket(accessToken);
      socketRef.current = socket;
      isCleaningUpRef.current = false;
      hasAnsweredRef.current = false;
      isSignalingReadyRef.current = false;
      remoteStreamRef.current = new MediaStream();

      const peerConnection = createPeerConnection(sessionOverride.webRtcConfig.iceServers);
      peerConnectionRef.current = peerConnection;
      bindPeerConnectionEvents(peerConnection, socket, sessionOverride.id);

      async function answerOffer(offer) {
        if (
          !offer?.sdp ||
          hasAnsweredRef.current ||
          peerConnection.signalingState !== "stable"
        ) {
          return;
        }

        await peerConnection.setRemoteDescription(offer);
        await flushRemoteCandidates();
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        refreshDebugState();

        await new Promise((resolve, reject) => {
          socket.emit(
            "signal:answer",
            {
              sessionId: sessionOverride.id,
              sdp: answer.sdp
            },
            (response) => {
              if (!response?.ok) {
                reject(new Error(response?.error ?? "Failed to send SDP answer"));
                return;
              }

              resolve();
            }
          );
        });
        hasAnsweredRef.current = true;
      }

      socket.on("signal:offer", async ({ offer }) => {
        await answerOffer(offer);
      });

      socket.on("signal:ice-candidate", async ({ candidate }) => {
        if (!candidate?.candidate) {
          return;
        }

        await addOrQueueRemoteCandidate(candidate.candidate);
      });

      socket.on("session:ended", () => {
        setViewerState("ended");
        cleanup({ keepState: true });
      });

      await connectSocket(socket);

      const joinResponse = await new Promise((resolve, reject) => {
        socket.emit("session:join", { sessionId: sessionOverride.id }, (response) => {
          if (!response?.ok) {
            reject(new Error(response?.error ?? "Failed to join viewer session"));
            return;
          }

          resolve(response);
        });
      });
      isSignalingReadyRef.current = true;

      if (joinResponse.session.offer?.sdp) {
        await answerOffer(joinResponse.session.offer);
      }

      const bufferedCandidates = joinResponse.session.sourceIceCandidates ?? [];
      for (const entry of bufferedCandidates) {
        if (entry?.candidate) {
          await addOrQueueRemoteCandidate(entry.candidate);
        }
      }

      refreshDebugState();
      setError("");
    } catch (viewerError) {
      setError(viewerError.message ?? "Failed to connect to stream");
      setViewerState("error");
      cleanup();
      throw viewerError;
    }
  }

  function cleanup(options = {}) {
    isCleaningUpRef.current = true;
    isSignalingReadyRef.current = false;
    socketRef.current?.disconnect();
    socketRef.current = null;

    safelyClosePeerConnection(peerConnectionRef.current);
    peerConnectionRef.current = null;
    pendingRemoteCandidatesRef.current = [];
    hasAnsweredRef.current = false;
    remoteStreamRef.current = null;
    setHasRemoteStream(false);

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setDebugState(INITIAL_DEBUG_STATE);
    if (!options.keepState) {
      setViewerState("idle");
    }
  }

  return {
    debugState,
    viewerState,
    error,
    hasRemoteStream,
    connectViewer,
    disconnectViewer() {
      cleanup();
      setViewerState("ended");
    }
  };
}
