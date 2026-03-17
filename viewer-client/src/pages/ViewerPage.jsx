import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { sessionApi } from "../api/sessionApi.js";
import { ConnectionDebugPanel } from "../components/ConnectionDebugPanel.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { VideoPanel } from "../components/VideoPanel.jsx";
import { appMode } from "../config/appMode.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useAsyncTask } from "../hooks/useAsyncTask.js";
import { useViewerStreaming } from "../hooks/useViewerStreaming.js";

export function ViewerPage() {
  const { accessToken, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessionIdInput, setSessionIdInput] = useState("");
  const [requestedSession, setRequestedSession] = useState(null);
  const [joinState, setJoinState] = useState("idle");
  const [isMuted, setIsMuted] = useState(true);
  const [autoFlowEnabled, setAutoFlowEnabled] = useState(true);
  const remoteVideoRef = useRef(null);
  const remotePanelRef = useRef(null);
  const requestTask = useAsyncTask();
  const refreshTask = useAsyncTask();
  const connectTask = useAsyncTask();

  const autoConnectInFlightRef = useRef(false);
  const autoRequestedSessionIdRef = useRef(null);
  const lastAutoConnectKeyRef = useRef(null);
  const {
    debugState,
    viewerState,
    error: viewerError,
    hasRemoteStream,
    connectViewer,
    disconnectViewer
  } =
    useViewerStreaming({
      accessToken,
      session: requestedSession,
      remoteVideoRef
    });

  const statusTone = useMemo(() => {
    if (viewerState === "viewing") {
      return "success";
    }

    if (viewerState === "connecting" || joinState === "pending") {
      return "warning";
    }

    if (viewerState === "error") {
      return "danger";
    }

    return "neutral";
  }, [viewerState, joinState]);

  function normalizeSessionReference(value) {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }

    try {
      const url = new URL(trimmed);
      return url.searchParams.get("sessionId")?.trim() ?? trimmed;
    } catch {
      return trimmed;
    }
  }

  useEffect(() => {
    handleRefresh().catch(() => {});
  }, []);

  useEffect(() => {
    const sessionIdFromQuery = normalizeSessionReference(searchParams.get("sessionId") ?? "");
    if (!sessionIdFromQuery || autoRequestedSessionIdRef.current === sessionIdFromQuery) {
      return;
    }

    autoRequestedSessionIdRef.current = sessionIdFromQuery;
    lastAutoConnectKeyRef.current = null;
    setSessionIdInput(sessionIdFromQuery);
    setJoinState("pending");
    setAutoFlowEnabled(true);
    sessionApi
      .requestViewerAccess(accessToken, sessionIdFromQuery)
      .then(async (result) => {
        setRequestedSession(result.session);
        setJoinState(result.accessState);
        await handleRefresh(result.session.id);
      })
      .catch(() => {});
  }, [accessToken, searchParams]);

  useEffect(() => {
    if (viewerState === "viewing") {
      setJoinState("approved");
    }
    if (viewerState === "ended") {
      setJoinState("ended");
    }
  }, [viewerState]);

  useEffect(() => {
    if (!remoteVideoRef.current) {
      return;
    }

    remoteVideoRef.current.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (
      !autoFlowEnabled ||
      !requestedSession?.id ||
      viewerState !== "idle"
    ) {
      return;
    }

    if (!requestedSession.canView || autoConnectInFlightRef.current) {
      return;
    }

    const autoConnectKey = [
      requestedSession.id,
      requestedSession.status,
      requestedSession.lastOfferAt ?? "no-offer",
      requestedSession.lastAnswerAt ?? "no-answer"
    ].join(":");

    if (lastAutoConnectKeyRef.current === autoConnectKey) {
      return;
    }

    autoConnectInFlightRef.current = true;
    lastAutoConnectKeyRef.current = autoConnectKey;
    connectViewer(requestedSession)
      .catch(() => {})
      .finally(() => {
        autoConnectInFlightRef.current = false;
      });
  }, [autoFlowEnabled, connectViewer, requestedSession, viewerState]);

  useEffect(() => {
    if (!autoFlowEnabled || !requestedSession?.id) {
      return;
    }

    const shouldPoll =
      joinState === "pending" ||
      (viewerState === "idle" && !requestedSession.canView);

    if (!shouldPoll) {
      return;
    }

    const intervalId = window.setInterval(() => {
      handleRefresh(requestedSession.id).catch(() => {});
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoFlowEnabled, joinState, requestedSession?.id, viewerState]);

  async function handleRequestAccess(event) {
    event.preventDefault();

    await requestTask.run(async () => {
      setAutoFlowEnabled(true);
      lastAutoConnectKeyRef.current = null;
      const normalizedSessionId = normalizeSessionReference(sessionIdInput);
      const result = await sessionApi.requestViewerAccess(accessToken, normalizedSessionId);
      setRequestedSession(result.session);
      setJoinState(result.accessState);
      setSearchParams({ sessionId: result.session.id });
      await handleRefresh(result.session.id);
    });
  }

  async function handleConnect() {
    if (!requestedSession) {
      return;
    }

    await connectTask.run(async () => {
      setAutoFlowEnabled(true);
      lastAutoConnectKeyRef.current = null;
      const latest = await sessionApi.getSession(accessToken, requestedSession.id);
      setRequestedSession(latest.session);
      setJoinState(latest.session.canView ? "approved" : "pending");

      if (!latest.session.canView) {
        throw new Error("Viewer is still waiting for source approval");
      }

      await connectViewer(latest.session);
    });
  }

  async function handleRefresh(sessionIdOverride = requestedSession?.id) {
    await refreshTask.run(async () => {
      const result = await sessionApi.listSessions(accessToken);
      if (sessionIdOverride) {
        const updated = result.sessions.find((entry) => entry.id === sessionIdOverride);
        if (updated) {
          setRequestedSession(updated);
          setJoinState(updated.canView ? "approved" : "pending");
          setSessionIdInput(updated.id);
        }
      }
    });
  }

  async function handleToggleMute() {
    if (!remoteVideoRef.current) {
      setIsMuted((current) => !current);
      return;
    }

    const nextMuted = !remoteVideoRef.current.muted;
    remoteVideoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);

    if (!nextMuted) {
      try {
        await remoteVideoRef.current.play();
      } catch {
        setIsMuted(true);
        remoteVideoRef.current.muted = true;
      }
    }
  }

  async function handleFullscreen() {
    const target = remotePanelRef.current ?? remoteVideoRef.current;
    if (!target?.requestFullscreen) {
      return;
    }

    await target.requestFullscreen();
  }

  function handleDisconnect() {
    setAutoFlowEnabled(false);
    lastAutoConnectKeyRef.current = null;
    disconnectViewer();
  }

  return (
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Viewer Role</p>
            <h2>Join an authorized private session</h2>
          </div>
          <StatusBadge tone="success">{user.displayName}</StatusBadge>
        </div>
        <p className="muted">
          Viewer app mode: <strong>{appMode}</strong>. Open this app with a session invite link to
          request access automatically, then it will connect as soon as approval is available.
        </p>
        <form className="form-grid" onSubmit={handleRequestAccess}>
          <label>
            Session ID
            <input
              value={sessionIdInput}
              onChange={(event) => setSessionIdInput(event.target.value)}
              placeholder="Paste the source session ID or full invite link"
              required
            />
          </label>
          <button type="submit" disabled={requestTask.isLoading}>
            {requestTask.isLoading ? "Requesting..." : "Request access"}
          </button>
        </form>
        {requestTask.error ? <p className="form-error">{requestTask.error}</p> : null}
        <div className="button-row">
          <button
            type="button"
            disabled={
              !requestedSession ||
              connectTask.isLoading ||
              viewerState === "connecting" ||
              viewerState === "viewing"
            }
            onClick={handleConnect}
          >
            {viewerState === "viewing"
              ? "Connected"
              : connectTask.isLoading || viewerState === "connecting"
                ? "Connecting..."
                : "Connect now"}
          </button>
          <button type="button" className="secondary-button" onClick={handleRefresh}>
            Refresh authorizations
          </button>
          <button type="button" className="secondary-button" onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
        {refreshTask.isLoading ? <p className="muted">Refreshing session visibility...</p> : null}
        {connectTask.error ? <p className="form-error">{connectTask.error}</p> : null}
      </section>

      <div ref={remotePanelRef}>
        <VideoPanel
          title="Remote stream"
          videoRef={remoteVideoRef}
          muted={isMuted}
          controls
          actions={
            <>
              <button type="button" className="secondary-button" onClick={handleToggleMute}>
                {isMuted ? "Unmute" : "Mute"}
              </button>
              <button type="button" className="secondary-button" onClick={handleFullscreen}>
                Full screen
              </button>
            </>
          }
          posterText="The authorized source stream will appear here."
          showPoster={!hasRemoteStream}
        />
      </div>

      <section className="panel">
        <div className="panel-header">
          <h3>Viewer access state</h3>
          <StatusBadge tone={statusTone}>{viewerState === "idle" ? joinState : viewerState}</StatusBadge>
        </div>
        <p className="muted">
          Access stays blocked until the backend marks you as the approved viewer for the session.
        </p>
        {requestedSession ? (
          <div className="detail-list">
            <p>
              <span className="label">Session</span>
              {requestedSession.id}
            </p>
            <p>
              <span className="label">Can view</span>
              {requestedSession.canView ? "Yes" : "No"}
            </p>
            <p>
              <span className="label">Status</span>
              {requestedSession.status}
            </p>
            <p>
              <span className="label">Connection flow</span>
              {requestedSession.canView
                ? viewerState === "viewing"
                  ? "Connected"
                  : "Approved, waiting for stream or auto-connect"
                : "Waiting for source approval"}
            </p>
          </div>
        ) : null}
        {viewerError ? <p className="form-error">{viewerError}</p> : null}
      </section>

      <ConnectionDebugPanel title="Viewer peer connection" debugState={debugState} />
    </div>
  );
}
