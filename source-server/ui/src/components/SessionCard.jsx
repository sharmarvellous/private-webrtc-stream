import { Link } from "react-router-dom";
import { StatusBadge } from "./StatusBadge.jsx";

function statusTone(status) {
  if (status === "active") {
    return "success";
  }

  if (status === "waiting" || status === "created") {
    return "warning";
  }

  if (status === "ended" || status === "expired") {
    return "danger";
  }

  return "neutral";
}

export function SessionCard({ session, actions }) {
  return (
    <article className={`session-card ${session.isSelected ? "selected" : ""}`}>
      <div className="session-card-header">
        <div>
          <h3>{session.id}</h3>
          <p className="muted">Video: {session.videoId}</p>
          {session.pendingViewerId ? (
            <p className="muted">Pending viewer: {session.pendingViewerId}</p>
          ) : null}
        </div>
        <div className="session-card-badges">
          {session.isSelected ? <StatusBadge tone="success">selected</StatusBadge> : null}
          <StatusBadge tone={statusTone(session.status)}>{session.status}</StatusBadge>
        </div>
      </div>
      <div className="session-card-grid">
        <p>
          <span className="label">Created</span>
          {new Date(session.createdAt).toLocaleString()}
        </p>
        <p>
          <span className="label">Expires</span>
          {new Date(session.expiresAt).toLocaleString()}
        </p>
        <p>
          <span className="label">Approved viewer</span>
          {session.approvedViewerId ?? "Not assigned"}
        </p>
      </div>
      <div className="session-card-actions">
        <Link className="secondary-button" to={`/sessions/${session.id}`}>
          Open detail
        </Link>
        {actions}
      </div>
    </article>
  );
}
