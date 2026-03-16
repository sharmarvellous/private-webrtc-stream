import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { APP_MODES, appMode } from "../config/appMode.js";

export function AppShell({ children }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const appTitle =
    appMode === APP_MODES.SOURCE
      ? "Authenticated Source Console"
      : appMode === APP_MODES.VIEWER
        ? "Authenticated Viewer Console"
        : "Authenticated WebRTC Console";

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Private Ultra-Low-Latency Streaming MVP</p>
          <h1>{appTitle}</h1>
        </div>
        <nav className="app-nav">
          {user ? (
            <>
              {user.role === "source" && appMode !== APP_MODES.VIEWER ? (
                <Link className={location.pathname.startsWith("/source") ? "active" : ""} to="/source">
                  Source
                </Link>
              ) : null}
              {user.role === "viewer" && appMode !== APP_MODES.SOURCE ? (
                <Link className={location.pathname.startsWith("/viewer") ? "active" : ""} to="/viewer">
                  Viewer
                </Link>
              ) : null}
              <button type="button" className="secondary-button" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <Link className={location.pathname === "/login" ? "active" : ""} to="/login">
              Login
            </Link>
          )}
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
