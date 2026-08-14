import { useEffect, useRef, useState } from "react";

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

// Best-effort conversion to E.164 for Firebase (which requires a leading "+" and
// country code). If the person already typed a "+", trust it as-is; a bare 10-digit
// number is assumed to be Indian (matches this app's userbase) — anything else is
// passed through with a "+" prefix and left for Firebase to reject if it's invalid.
function toE164(value) {
  const digits = value.trim().replace(/[\s-]/g, "");
  if (digits.startsWith("+")) return digits;
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  return `+${digits}`;
}

// --- "Remember this device" for OTP: skip re-sending an OTP for 7 days on this
// browser once the person opts in on a successful verification. This never bypasses
// the server — it just replays the same app token/user we already got back from
// /api/auth/otp, the same way logging in normally does.
const TRUSTED_KEY = "mf_trusted_otp";
const TRUSTED_DAYS = 7;

function readTrustedSession() {
  try {
    const raw = localStorage.getItem(TRUSTED_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.phone || !data?.token || !data?.user || !data?.expiresAt) return null;
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(TRUSTED_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function writeTrustedSession(phone, token, user) {
  localStorage.setItem(
    TRUSTED_KEY,
    JSON.stringify({ phone, token, user, expiresAt: Date.now() + TRUSTED_DAYS * 24 * 60 * 60 * 1000 }),
  );
}

function clearTrustedSession() {
  localStorage.removeItem(TRUSTED_KEY);
}

// Handles both sign-in and account creation against the REST auth endpoints, then
// hands the resulting { token, user } up to App once the server confirms the credentials.
export default function AuthPage({ serverUrl, onAuthenticated, initialError }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [useOtp, setUseOtp] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(initialError || "");

  // --- OTP flow state ---
  const [otpStep, setOtpStep] = useState("phone"); // "phone" | "code" | "name"
  const [otpCode, setOtpCode] = useState("");
  const [otpName, setOtpName] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);

  const trusted = useOtp ? readTrustedSession() : null;
  const trustedMatchesTyped = trusted && toE164(phoneNumber || trusted.phone) === trusted.phone;

  useEffect(() => {
    // Pre-fill the phone field with a still-trusted number so "skip OTP" works
    // without retyping it.
    if (useOtp && otpStep === "phone" && !phoneNumber) {
      const remembered = readTrustedSession();
      if (remembered) setPhoneNumber(remembered.phone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useOtp]);

  function resetOtpFlow() {
    setOtpStep("phone");
    setOtpCode("");
    setOtpName("");
  }

  function toggleOtp(next) {
    setUseOtp(next);
    setError("");
    resetOtpFlow();
  }

  async function sendOtp(e) {
    e.preventDefault();
    setError("");
    const phoneErr = validatePhone(phoneNumber);
    if (phoneErr) return setError(phoneErr);

    // Already verified this number on this device within the last 7 days — skip
    // sending a new OTP and just resume that session.
    const remembered = readTrustedSession();
    if (remembered && remembered.phone === toE164(phoneNumber)) {
      onAuthenticated(remembered.token, remembered.user);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${serverUrl}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: toE164(phoneNumber) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send the OTP. Please try again.");
        return;
      }
      setOtpStep("code");
    } catch (err) {
      console.error("Send OTP failed", err);
      setError("Could not reach the server. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(otpCode.trim())) return setError("Enter the 6-digit code.");

    setSubmitting(true);
    try {
      const res = await fetch(`${serverUrl}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: toE164(phoneNumber), code: otpCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      if (data.needsUsername) {
        setOtpStep("name");
        return;
      }
      if (rememberDevice) writeTrustedSession(toE164(phoneNumber), data.token, data.user);
      onAuthenticated(data.token, data.user);
    } catch (err) {
      console.error("Verify OTP failed", err);
      setError("That code didn't work — check it and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function finishOtpSignup(e) {
    e.preventDefault();
    setError("");
    const nameErr = validateName(otpName);
    if (nameErr) return setError(nameErr);

    setSubmitting(true);
    try {
      const res = await fetch(`${serverUrl}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: toE164(phoneNumber), code: otpCode.trim(), username: otpName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      if (rememberDevice) writeTrustedSession(toE164(phoneNumber), data.token, data.user);
      onAuthenticated(data.token, data.user);
    } catch (err) {
      console.error("Finish OTP signup failed", err);
      setError("Could not reach the server. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError("");
    setPassword("");
    setConfirmPassword("");
    resetOtpFlow();
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

        <form onSubmit={handleSubmit} className="gate-form" noValidate style={{ display: useOtp ? "none" : "flex" }}>
          <input
            autoFocus={!useOtp}
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

        {useOtp && otpStep === "phone" && (
          <form onSubmit={sendOtp} className="gate-form" noValidate>
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
            <label className="gate-checkbox">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
              />
              Remember this device — skip OTP for 7 days
            </label>
            <button type="submit" disabled={submitting}>
              {submitting
                ? "Sending…"
                : trustedMatchesTyped
                  ? "Continue — no OTP needed →"
                  : "Send OTP →"}
            </button>
            {trustedMatchesTyped && (
              <button
                type="button"
                className="auth-switch"
                onClick={() => {
                  clearTrustedSession();
                  setError("");
                }}
              >
                Not you? Forget this device
              </button>
            )}
          </form>
        )}

        {useOtp && otpStep === "code" && (
          <form onSubmit={verifyOtp} className="gate-form" noValidate>
            <p className="gate-sub" style={{ margin: "-4px 0 0" }}>
              Enter the 6-digit code sent to {toE164(phoneNumber)}.
            </p>
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              value={otpCode}
              onChange={(e) => {
                setOtpCode(e.target.value.replace(/\D/g, ""));
                if (error) setError("");
              }}
              required
            />
            <button type="submit" disabled={submitting}>
              {submitting ? "Verifying…" : "Verify & continue →"}
            </button>
            <button type="button" className="auth-switch" onClick={() => setOtpStep("phone")}>
              Wrong number? Go back
            </button>
          </form>
        )}

        {useOtp && otpStep === "name" && (
          <form onSubmit={finishOtpSignup} className="gate-form" noValidate>
            <p className="gate-sub" style={{ margin: "-4px 0 0" }}>
              Number verified — what should we call you?
            </p>
            <input
              autoFocus
              type="text"
              maxLength={24}
              placeholder="your name"
              value={otpName}
              onChange={(e) => {
                setOtpName(e.target.value);
                if (error) setError("");
              }}
              required
            />
            <button type="submit" disabled={submitting}>
              {submitting ? "Please wait…" : "Create account →"}
            </button>
          </form>
        )}

        {/* Invisible reCAPTCHA anchor for Firebase phone auth — renders nothing visible. */}

        {error && <div className="gate-error">{error}</div>}

        <p className="auth-switch">
          <button type="button" onClick={() => toggleOtp(!useOtp)}>
            {useOtp ? "Use phone number & password instead" : "Use OTP instead"}
          </button>
        </p>

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