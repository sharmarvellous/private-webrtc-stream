import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, authenticatedFetch } from "../api/httpClient.js";
import { sessionApi } from "../api/sessionApi.js";
import { videoApi } from "../api/videoApi.js";
import { ConnectionDebugPanel } from "../components/ConnectionDebugPanel.jsx";
import { SessionCard } from "../components/SessionCard.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { VideoPanel } from "../components/VideoPanel.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAsyncTask } from "../hooks/useAsyncTask.js";
import { useSourceStreaming } from "../hooks/useSourceStreaming.js";

export function SourcePage() {
  const { accessToken, user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [hiddenSessionIds, setHiddenSessionIds] = useState([]);
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [approvedViewerId, setApprovedViewerId] = useState("");
  const [selectedSession, setSelectedSession] = useState(null);
  const [pageError, setPageError] = useState("");
  const [videoReady, setVideoReady] = useState(false);
  const [videoLoadState, setVideoLoadState] = useState("idle");
  const [sourceInputMode, setSourceInputMode] = useState("browser-tab");
  const [inviteCopyState, setInviteCopyState] = useState("idle");
  const [sessionCopyState, setSessionCopyState] = useState("idle");
  const sourceVideoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const objectUrlRef = useRef(null);
  const loadTask = useAsyncTask();
  const createTask = useAsyncTask();
  const approveTask = useAsyncTask();
  const endTask = useAsyncTask();

  const {
    captureMode,
    debugState,
    publishState,
    error: publishError,
    startPublishing,
    stopPublishing
  } = useSourceStreaming({
    accessToken,
    session: selectedSession,
    sourceVideoRef,
    previewVideoRef
  });

  useEffect(() => {
    loadDashboard();
  }, [accessToken]);

  useEffect(() => {
    setVideoReady(false);
    setVideoLoadState("idle");
    revokeLoadedVideo();
  }, [selectedVideoId]);

  useEffect(() => {
    return () => {
      revokeLoadedVideo();
    };
  }, []);

  useEffect(() => {
    if (!selectedSession?.id) {
      return;
    }

    const intervalId = window.setInterval(() => {
      refreshSessions(selectedSession.id).catch(() => {});
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedSession?.id]);

  function revokeLoadedVideo() {
    if (!objectUrlRef.current) {
      return;
    }

    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }

  function sortSessionsNewestFirst(items) {
    return [...items].sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      return rightTime - leftTime;
    });
  }

  const visibleSessions = sortSessionsNewestFirst(sessions).filter(
    (session) => !hiddenSessionIds.includes(session.id)
  );

  async function loadDashboard() {
    setPageError("");
    try {
      const [videoResult, sessionResult] = await loadTask.run(() =>
        Promise.all([videoApi.listVideos(accessToken), sessionApi.listSessions(accessToken)])
      );
      setVideos(videoResult.videos);
      setSessions(sortSessionsNewestFirst(sessionResult.sessions));
      setSelectedVideoId((current) => current || videoResult.videos[0]?.id || "");
    } catch (error) {
      setPageError(error.message ?? "Failed to load source dashboard");
    }
  }

  async function refreshSessions(selectedId) {
    const sessionResult = await sessionApi.listSessions(accessToken);
    const sortedSessions = sortSessionsNewestFirst(sessionResult.sessions);
    setSessions(sortedSessions);

    if (!selectedId) {
      return;
    }

    const match = sortedSessions.find((entry) => entry.id === selectedId) ?? null;
    setSelectedSession(match);
  }

  async function handleCreateSession(event) {
    event.preventDefault();

    await createTask.run(async () => {
      const result = await sessionApi.createSession(accessToken, {
        videoId: selectedVideoId,
        approvedViewerId: approvedViewerId || undefined
      });
      setHiddenSessionIds((current) => current.filter((sessionId) => sessionId !== result.session.id));
      setSelectedSession(result.session);
      setApprovedViewerId("");
      await refreshSessions(result.session.id);
    });
  }

  async function handleApproveViewer(sessionId, viewerId) {
    await approveTask.run(async () => {
      const result = await sessionApi.approveViewer(accessToken, sessionId, viewerId);
      setSelectedSession(result.session);
      await refreshSessions(sessionId);
    });
  }

  async function handleEndSession(sessionId) {
    await endTask.run(async () => {
      await sessionApi.endSession(accessToken, sessionId, "ended_by_source_from_dashboard");
      if (selectedSession?.id === sessionId) {
        await stopPublishing({ notifyServer: false });
        setSelectedSession(null);
      }
      await refreshSessions();
    });
  }

  const selectedVideo = videos.find((video) => video.id === selectedVideoId) ?? null;
  const selectedVideoUrl = selectedVideo
    ? `${API_BASE_URL.replace(/\/api$/, "")}${selectedVideo.sourceUrl}`
    : "";
  const viewerBaseUrl = (import.meta.env.VITE_VIEWER_APP_BASE_URL ?? "").trim();
  const viewerInviteUrl = selectedSession
    ? viewerBaseUrl
      ? `${viewerBaseUrl.replace(/\/$/, "")}/viewer?sessionId=${selectedSession.id}`
      : ""
    : "";

  async function handleLoadProtectedVideo() {
    if (!selectedVideoUrl || !sourceVideoRef.current) {
      return;
    }

    setPageError("");
    setVideoLoadState("loading");
    setVideoReady(false);

    try {
      revokeLoadedVideo();
      const response = await authenticatedFetch(selectedVideoUrl, accessToken);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;
      sourceVideoRef.current.src = objectUrl;
      await sourceVideoRef.current.play();
      setVideoLoadState("loaded");
    } catch (error) {
      setVideoLoadState("error");
      setPageError(error.message ?? "Failed to load protected video");
    }
  }

  async function handleStartPublishing() {
    setPageError("");
    await startPublishing({ captureMode: sourceInputMode });
  }

  async function handleCopyInviteLink() {
    if (!viewerInviteUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(viewerInviteUrl);
      setInviteCopyState("copied");
      window.setTimeout(() => setInviteCopyState("idle"), 1800);
    } catch {
      setInviteCopyState("error");
    }
  }

  async function handleCopySessionId() {
    if (!selectedSession?.id) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedSession.id);
      setSessionCopyState("copied");
      window.setTimeout(() => setSessionCopyState("idle"), 1800);
    } catch {
      setSessionCopyState("error");
    }
  }

  function handleSelectSession(session) {
    setSelectedSession(session);
  }

  function handleHideSession(sessionId) {
    setHiddenSessionIds((current) => [...new Set([...current, sessionId])]);
    if (selectedSession?.id === sessionId) {
      const nextSelected = visibleSessions.find((session) => session.id !== sessionId) ?? null;
      setSelectedSession(nextSelected);
    }
  }

  function handleHideOlderSessions() {
    const keepIds = new Set(
      sessions
        .filter((session, index) => index === 0 || session.id === selectedSession?.id)
        .map((session) => session.id)
    );
    setHiddenSessionIds((current) => [
      ...new Set([
        ...current,
        ...sessions.filter((session) => !keepIds.has(session.id)).map((session) => session.id)
      ])
    ]);
  }

  function handleShowHiddenSessions() {
    setHiddenSessionIds([]);
  }

  return (
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Source Role</p>
            <h2>Broadcast protected video as a private peer stream</h2>
          </div>
          <StatusBadge tone="success">{user.displayName}</StatusBadge>
        </div>
        <p className="muted">
          Keep the protected source media playing locally, then publish its captured media tracks
          through WebRTC. Chrome-based browsers are recommended for both
          <code> captureStream()</code> and browser-tab capture.
        </p>
        <p className="muted">
          Use protected-video capture for first-party hosted assets. Use browser-tab capture for
          authorized web playback where direct video-element capture is unavailable. You can also
          pick a specific window/app or the full screen from the source device.
        </p>
        <form className="form-grid" onSubmit={handleCreateSession}>
          <label>
            Protected video
            <select
              value={selectedVideoId}
              onChange={(event) => setSelectedVideoId(event.target.value)}
              required
            >
              {videos.map((video) => (
                <option key={video.id} value={video.id}>
                  {video.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Approved viewer ID
            <input
              value={approvedViewerId}
              onChange={(event) => setApprovedViewerId(event.target.value)}
              placeholder="Optional allowlisted viewer user ID"
            />
          </label>
          <button type="submit" disabled={!selectedVideoId || createTask.isLoading}>
            {createTask.isLoading ? "Creating..." : "Start private session"}
          </button>
        </form>
        {createTask.error ? <p className="form-error">{createTask.error}</p> : null}
        {pageError ? <p className="form-error">{pageError}</p> : null}
      </section>

      <VideoPanel
        title="Protected source video"
        videoRef={sourceVideoRef}
        muted
        controls
        onLoadedData={() => setVideoReady(true)}
        onError={() => setVideoReady(false)}
        posterText={
          videoReady
            ? ""
            : "Attach a protected MP4 on the backend to enable real capture. The player wiring is ready."
        }
      />

      <section className="panel">
        <div className="panel-header">
          <h3>Playback and publishing controls</h3>
          <StatusBadge tone={publishState === "publishing" ? "success" : "warning"}>
            {publishState}
          </StatusBadge>
        </div>
        <p className="muted">
          Active publish target:{" "}
          <strong>{selectedSession?.id ?? "No session selected yet"}</strong>
        </p>
        {selectedSession ? (
          <div className="detail-list">
            <p>
              <span className="label">Viewer session ID</span>
              <code>{selectedSession.id}</code>
            </p>
            {viewerInviteUrl ? (
              <p>
                <span className="label">Viewer invite link</span>
                <code>{viewerInviteUrl}</code>
              </p>
            ) : null}
            <div className="button-row">
              <button type="button" className="secondary-button" onClick={handleCopySessionId}>
                {sessionCopyState === "copied" ? "Session ID copied" : "Copy session ID"}
              </button>
              {viewerInviteUrl ? (
              <button type="button" className="secondary-button" onClick={handleCopyInviteLink}>
                {inviteCopyState === "copied" ? "Invite copied" : "Copy viewer invite"}
              </button>
              ) : null}
            </div>
            {!viewerInviteUrl ? (
              <p className="muted">
                The viewer machine should run its own local app and paste this session ID into the
                remote viewer console.
              </p>
            ) : null}
          </div>
        ) : null}
        <label>
          Source input mode
          <select
            value={sourceInputMode}
            onChange={(event) => setSourceInputMode(event.target.value)}
          >
            <option value="browser-tab">Shared browser tab</option>
            <option value="window">Specific app or window</option>
            <option value="screen">Entire screen</option>
            <option value="video-element">Protected backend video</option>
          </select>
        </label>
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            disabled={!selectedVideoUrl || sourceInputMode !== "video-element"}
            onClick={handleLoadProtectedVideo}
          >
            {videoLoadState === "loading" ? "Loading video..." : "Load protected video"}
          </button>
          <button
            type="button"
            disabled={
              !selectedSession ||
              publishState === "publishing" ||
              (sourceInputMode === "video-element" && !videoReady)
            }
            onClick={handleStartPublishing}
          >
            {sourceInputMode === "browser-tab"
              ? selectedSession
                ? `Share tab to ${selectedSession.id.slice(0, 8)}...`
                : "Share browser tab"
              : sourceInputMode === "window"
                ? selectedSession
                  ? `Share window to ${selectedSession.id.slice(0, 8)}...`
                  : "Share app or window"
                : sourceInputMode === "screen"
                  ? selectedSession
                    ? `Share screen to ${selectedSession.id.slice(0, 8)}...`
                    : "Share entire screen"
                  : selectedSession
                    ? `Publish to ${selectedSession.id.slice(0, 8)}...`
                    : "Publish protected video"}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={publishState !== "publishing"}
            onClick={stopPublishing}
          >
            Stop publishing
          </button>
        </div>
        <p className="muted">
          Use a session from the list below as the active signaling target before publishing.
          Display capture opens the browser picker and depends on you choosing the tab, app window,
          or screen you are authorized to transmit.
        </p>
        <p className="muted">
          Fastest operational flow: create the session with a known viewer user ID in the
          allowlist field, send the invite link, then start tab sharing. The viewer side will
          request and connect automatically.
        </p>
        {publishError ? <p className="form-error">{publishError}</p> : null}
        {sourceInputMode === "video-element" && videoLoadState === "error" ? (
          <p className="form-error">
            Protected video loading failed. The source media request must succeed before publishing.
          </p>
        ) : null}
        {sourceInputMode !== "video-element" ? (
          <p className="muted">
            Current publish source:{" "}
            <strong>
              {captureMode === "browser-tab"
                ? "browser tab"
                : captureMode === "window"
                  ? "app or window"
                  : captureMode === "screen"
                    ? "entire screen"
                    : "display capture"}
            </strong>
          </p>
        ) : null}
      </section>

      <VideoPanel
        title="Captured local preview"
        videoRef={previewVideoRef}
        muted
        controls={false}
        posterText="WebRTC capture preview appears here after publishing starts."
      />

      <ConnectionDebugPanel title="Source peer connection" debugState={debugState} />

      <section className="panel span-two">
        <div className="panel-header">
          <h3>Source sessions</h3>
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={handleHideOlderSessions}>
              Hide older
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleShowHiddenSessions}
              disabled={hiddenSessionIds.length === 0}
            >
              Show hidden
            </button>
            <button type="button" className="secondary-button" onClick={loadDashboard}>
              Refresh
            </button>
          </div>
        </div>
        {loadTask.error ? <p className="form-error">{loadTask.error}</p> : null}
        <p className="muted">
          Newest sessions appear first. Hide older ones to keep the working area clean.
        </p>
        <div className="stack-list">
          {visibleSessions.length === 0 ? (
            <p className="muted">No sessions created yet.</p>
          ) : (
            visibleSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={{
                  ...session,
                  isSelected: selectedSession?.id === session.id
                }}
                actions={
                  <>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleSelectSession(session)}
                      disabled={selectedSession?.id === session.id}
                    >
                      {selectedSession?.id === session.id ? "Selected for publish" : "Select"}
                    </button>
                    {session.pendingViewerId ? (
                      <button
                        type="button"
                        onClick={() => handleApproveViewer(session.id, session.pendingViewerId)}
                        disabled={approveTask.isLoading}
                      >
                        Approve pending viewer
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleHideSession(session.id)}
                    >
                      Hide
                    </button>
                    <button
                      type="button"
                      className="secondary-button danger-outline"
                      onClick={() => handleEndSession(session.id)}
                      disabled={endTask.isLoading}
                    >
                      End session
                    </button>
                  </>
                }
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
