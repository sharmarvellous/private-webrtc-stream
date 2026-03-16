import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { sessionApi } from "../api/sessionApi.js";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export function SessionPage() {
  const { sessionId } = useParams();
  const { accessToken } = useAuth();
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    sessionApi
      .getSession(accessToken, sessionId)
      .then((result) => {
        if (isMounted) {
          setSession(result.session);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.message ?? "Failed to load session");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [accessToken, sessionId]);

  if (error) {
    return <section className="panel form-error">{error}</section>;
  }

  if (!session) {
    return <section className="panel">Loading session details...</section>;
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Session Detail</p>
          <h2>{session.id}</h2>
        </div>
        <StatusBadge tone={session.status === "active" ? "success" : "warning"}>
          {session.status}
        </StatusBadge>
      </div>
      <div className="detail-grid">
        <p>
          <span className="label">Source owner</span>
          {session.sourceOwnerId}
        </p>
        <p>
          <span className="label">Approved viewer</span>
          {session.approvedViewerId ?? "Not approved yet"}
        </p>
        <p>
          <span className="label">Video</span>
          {session.videoId}
        </p>
        <p>
          <span className="label">Expires</span>
          {new Date(session.expiresAt).toLocaleString()}
        </p>
        <p>
          <span className="label">Last offer</span>
          {session.lastOfferAt ? new Date(session.lastOfferAt).toLocaleString() : "None"}
        </p>
        <p>
          <span className="label">Last answer</span>
          {session.lastAnswerAt ? new Date(session.lastAnswerAt).toLocaleString() : "None"}
        </p>
      </div>
    </section>
  );
}
