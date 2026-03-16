import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { APP_MODES, appMode } from "./config/appMode.js";
import { LoginPage } from "./pages/LoginPage.jsx";
import { SourcePage } from "./pages/SourcePage.jsx";
import { ViewerPage } from "./pages/ViewerPage.jsx";
import { SessionPage } from "./pages/SessionPage.jsx";
import { useAuth } from "./context/AuthContext.jsx";

function RoleHomeRedirect() {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <div className="panel">Restoring your authenticated session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (appMode === APP_MODES.SOURCE) {
    return <Navigate to="/source" replace />;
  }

  if (appMode === APP_MODES.VIEWER) {
    return <Navigate to="/viewer" replace />;
  }

  return <Navigate to={user.role === "source" ? "/source" : "/viewer"} replace />;
}

export default function App() {
  const sourceRouteEnabled = appMode !== APP_MODES.VIEWER;
  const viewerRouteEnabled = appMode !== APP_MODES.SOURCE;

  return (
    <AppShell>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {sourceRouteEnabled ? (
          <Route
            path="/source"
            element={
              <ProtectedRoute role="source">
                <SourcePage />
              </ProtectedRoute>
            }
          />
        ) : null}
        {viewerRouteEnabled ? (
          <Route
            path="/viewer"
            element={
              <ProtectedRoute role="viewer">
                <ViewerPage />
              </ProtectedRoute>
            }
          />
        ) : null}
        <Route
          path="/sessions/:sessionId"
          element={
            <ProtectedRoute>
              <SessionPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<RoleHomeRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
