import { useEffect, useState } from "react";
import AdminPage from "./AdminPage.jsx";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV
    ? "http://localhost:4000"
    : "https://personal-chat-rebx.onrender.com");

const TOKEN_KEY = "mf_admin_token";
const EMAIL_KEY = "mf_admin_email";

// Everything under /admin renders through here. It never touches the regular
// user auth (mf_token), the socket connection, or any conversation data —
// login is a separate email/password pair checked only against the server's
// ADMIN_EMAIL / ADMIN_PASSWORD env vars.
export default function AdminApp() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [adminEmail, setAdminEmail] = useState(() => localStorage.getItem(EMAIL_KEY) || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Admin — MakeFriends";
  }, []);

  function handleLogout(message) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    setToken("");
    setAdminEmail("");
    if (message) setLoginError(message);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoginError(data.error || "Invalid email or password.");
        return;
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(EMAIL_KEY, data.admin?.email || email.trim());
      setToken(data.token);
      setAdminEmail(data.admin?.email || email.trim());
      setPassword("");
    } catch {
      setLoginError("Couldn't reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (token) {
    return (
      <AdminPage
        serverUrl={SERVER_URL}
        token={token}
        adminEmail={adminEmail}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="admin-login-screen">
      <form className="admin-login-card" onSubmit={handleLogin}>
        <div className="admin-login-title">Admin sign in</div>
        <div className="admin-login-sub">MakeFriends user directory</div>

        <label className="admin-login-label" htmlFor="admin-email">
          Email
        </label>
        <input
          id="admin-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@makefriends.com"
          required
        />

        <label className="admin-login-label" htmlFor="admin-password">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••"
          required
        />

        {loginError && <div className="admin-login-error">{loginError}</div>}

        <button type="submit" className="admin-login-btn" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
