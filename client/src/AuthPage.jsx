import { useState } from "react";

const PHONE_REGEX = /^\+?[1-9]\d{9,14}$/;
const NAME_REGEX = /^[A-Za-z\s.'-]+$/;

function validatePhone(value) {
  const trimmed = value.trim();
  const digitsOnly = trimmed.replace(/[\s-]/g, "");
  if (!trimmed) return "Phone number is required.";
  if (!PHONE_REGEX.test(digitsOnly)) return "Enter a valid phone number (10-15 digits, optional +country code).";
  return "";
}

function validateName(value) {
  const trimmed = value.trim();
  if (!trimmed) return "Name is required.";
  if (trimmed.length < 2) return "Name must be at least 2 characters.";
  if (!NAME_REGEX.test(trimmed)) return "Name can only contain letters, spaces, and . ' -";
  return "";
}

function validatePassword(value) {
  if (!value) return "Password is required.";
  if (value.length < 6) return "Password must be at least 6 characters.";
  return "";
}

// Handles both sign-in and account creation against the REST auth endpoints, then
// hands the resulting { token, user } up to App once the server confirms the credentials.
export default function AuthPage({ serverUrl, onAuthenticated, initialError }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [phoneNumber, setPhoneNumber] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(initialError || "");

  function switchMode(next) {
    setMode(next);
    setError("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const phoneErr = validatePhone(phoneNumber);
    if (phoneErr) return setError(phoneErr);

    if (mode === "register") {
      const nameErr = validateName(username);
      if (nameErr) return setError(nameErr);
    }

    const passErr = validatePassword(password);
    if (passErr) return setError(passErr);

    if (mode === "register" && password !== confirmPassword) {
      return setError("Passwords do not match.");
    }

    setSubmitting(true);
    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body =
        mode === "register"
          ? { phoneNumber: phoneNumber.trim(), username: username.trim(), password }
          : { phoneNumber: phoneNumber.trim(), password };

      const res = await fetch(`${serverUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      onAuthenticated(data.token, data.user);
    } catch (err) {
      console.error("Auth request failed", err);
      setError("Could not reach the server. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-mark">
          <img src="/logo.png" alt="" className="gate-logo" />
          MakeFriends
        </div>
        <h1>{mode === "login" ? "Welcome back." : "Make new friends, today."}</h1>
        <p className="gate-sub">
          {mode === "login"
            ? "Log in to pick up your chats where you left off."
            : "Create an account — private chats, groups, calls, and media, all live."}
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={"auth-tab" + (mode === "login" ? " active" : "")}
            onClick={() => switchMode("login")}
          >
            Log in
          </button>
          <button
            type="button"
            className={"auth-tab" + (mode === "register" ? " active" : "")}
            onClick={() => switchMode("register")}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="gate-form" noValidate>
          <input
            autoFocus
            type="tel"
            inputMode="tel"
            maxLength={20}
            placeholder="phone number (e.g. +919876543210)"
            value={phoneNumber}
            onChange={(e) => {
              setPhoneNumber(e.target.value);
              if (error) setError("");
            }}
            required
          />

          {mode === "register" && (
            <input
              type="text"
              maxLength={24}
              placeholder="your name"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError("");
              }}
              required
            />
          )}

          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              maxLength={72}
              placeholder="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
            >
              {showPassword ? "hide" : "show"}
            </button>
          </div>

          {mode === "register" && (
            <input
              type={showPassword ? "text" : "password"}
              maxLength={72}
              placeholder="confirm password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (error) setError("");
              }}
              required
            />
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "login" ? "Log in →" : "Create account →"}
          </button>
        </form>

        {error && <div className="gate-error">{error}</div>}

        <p className="auth-switch">
          {mode === "login" ? (
            <>
              New to MakeFriends?{" "}
              <button type="button" onClick={() => switchMode("register")}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => switchMode("login")}>
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
