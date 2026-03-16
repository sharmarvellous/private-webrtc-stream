import { StatusBadge } from "./StatusBadge.jsx";

export function ConnectionDebugPanel({ title, debugState }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
        <StatusBadge tone={debugState.connectionState === "connected" ? "success" : "neutral"}>
          {debugState.connectionState || "idle"}
        </StatusBadge>
      </div>
      <div className="debug-grid">
        <p>
          <span className="label">ICE gathering</span>
          {debugState.iceGatheringState || "new"}
        </p>
        <p>
          <span className="label">ICE connection</span>
          {debugState.iceConnectionState || "new"}
        </p>
        <p>
          <span className="label">Peer connection</span>
          {debugState.connectionState || "new"}
        </p>
        <p>
          <span className="label">Signaling</span>
          {debugState.signalingState || "stable"}
        </p>
      </div>
    </section>
  );
}
