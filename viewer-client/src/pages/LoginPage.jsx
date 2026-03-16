import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    navigate(user.role === "source" ? "/source" : "/viewer", { replace: true });
  }, [isAuthenticated, navigate, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await login(form);
      const destination =
        location.state?.from ??
        (result.user.role === "source" ? "/source" : "/viewer");
      navigate(destination, { replace: true });
    } catch (submitError) {
      setError(submitError.message ?? "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="login-layout">
      <div className="panel login-panel">
        <p className="eyebrow">Authenticated Access</p>
        <h2>Sign in to your private stream workspace</h2>
        <p className="muted">
          This MVP stores the access token in local storage for development simplicity. Switch to
          secure HTTP-only cookies before production hardening.
        </p>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="source@example.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="Enter your password"
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Login"}
          </button>
        </form>
        <div className="credential-panel">
          <h3>Seeded demo accounts</h3>
          <p>
            Source: <code>source@example.com</code> / <code>SourcePass123!</code>
          </p>
          <p>
            Viewer: <code>viewer@example.com</code> / <code>ViewerPass123!</code>
          </p>
        </div>
      </div>
    </section>
  );
}
