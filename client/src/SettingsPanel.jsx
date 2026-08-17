import { useEffect, useState } from "react";

export const THEME_COLORS = [
  { id: "green", hex: "#22c55e" },
  { id: "pink", hex: "#ec4899" },
  { id: "blue", hex: "#38bdf8" },
  { id: "orange", hex: "#f97316" },
  { id: "violet", hex: "#a855f7" },
];

// The app's own logo/icon gradient — used as the default when someone picks
// "Gradient" without having set custom stops yet.
export const LOGO_GRADIENT = ["#7c3aed", "#4f7dff"];

// Theme color is stored server-side as a single VARCHAR string. We encode the
// three possible shapes into that one string so no schema/API changes are
// needed beyond widening the column:
//   preset id      -> "violet"
//   custom solid   -> "#a1b2c3"
//   custom gradient -> "grad:#a1b2c3,#d4e5f6"
export function resolveThemeColor(value) {
  if (typeof value === "string" && value.startsWith("grad:")) {
    const [from, to] = value.slice(5).split(",");
    return { mode: "gradient", from: from || LOGO_GRADIENT[0], to: to || LOGO_GRADIENT[1] };
  }
  const preset = THEME_COLORS.find((t) => t.id === value);
  if (preset) return { mode: "solid", hex: preset.hex };
  if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
    return { mode: "solid", hex: value };
  }
  return { mode: "solid", hex: THEME_COLORS[0].hex };
}

export function encodeThemeColor(mode, a, b) {
  if (mode === "gradient") return `grad:${a},${b}`;
  return a;
}

// A settings-page row that opens into an inline panel when clicked — used for
// Privacy & Security / Account entries that aren't a plain on/off toggle.
function ActionRow({ icon, danger, title, sub, onClick, right, expanded, children }) {
  return (
    <div className={"settings-action-wrap" + (expanded ? " open" : "")}>
      <button
        type="button"
        className={"settings-action-row" + (danger ? " danger" : "")}
        onClick={onClick}
      >
        <span className="settings-action-icon">
          <svg className="icon" width="16" height="16"><use href={`#${icon}`} /></svg>
        </span>
        <span className="settings-action-main">
          <span className="settings-action-title">{title}</span>
          {sub && <span className="settings-action-sub">{sub}</span>}
        </span>
        {right !== undefined ? (
          right
        ) : (
          <svg className="icon settings-action-chevron" width="16" height="16">
            <use href="#chevron-right-icon" />
          </svg>
        )}
      </button>
      {expanded && children && <div className="settings-action-body">{children}</div>}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <label className={"settings-switch" + (disabled ? " disabled" : "")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />
      <span className="settings-switch-track"><span className="settings-switch-thumb" /></span>
    </label>
  );
}

function initials(name) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

export default function SettingsPanel({
  profile, // { username, phoneNumber, avatarUrl, coverUrl, tagline, themeColor, showOnline }
  connected,
  uploading,
  darkMode,
  onToggleDarkMode,
  onUploadAvatar,
  onUploadCover,
  onSave,
  onLogout,
  onDeleteAccount,
  onClose,
  serverUrl,
  token,
  mediaSrc,
}) {
  const [name, setName] = useState(profile.username || "");
  const [tagline, setTagline] = useState(profile.tagline || "");

  const initialResolved = resolveThemeColor(profile.themeColor);
  const [colorMode, setColorMode] = useState(initialResolved.mode); // "solid" | "gradient"
  const [solidHex, setSolidHex] = useState(
    initialResolved.mode === "solid" ? initialResolved.hex : THEME_COLORS[0].hex,
  );
  const [gradFrom, setGradFrom] = useState(
    initialResolved.mode === "gradient" ? initialResolved.from : LOGO_GRADIENT[0],
  );
  const [gradTo, setGradTo] = useState(
    initialResolved.mode === "gradient" ? initialResolved.to : LOGO_GRADIENT[1],
  );
  const [activePresetId, setActivePresetId] = useState(
    initialResolved.mode === "solid"
      ? THEME_COLORS.find((t) => t.hex.toLowerCase() === initialResolved.hex.toLowerCase())?.id || "custom"
      : null,
  );

  const [themeMode, setThemeMode] = useState(
    () => localStorage.getItem("mf_theme_mode") === "system" ? "system" : darkMode ? "dark" : "light",
  );
  const [showOnline, setShowOnline] = useState(profile.showOnline !== false);
  const [isPrivate, setIsPrivate] = useState(!!profile.isPrivate);
  const [privateSaving, setPrivateSaving] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState("everyone");
  const [nameError, setNameError] = useState(""); 
  const [saved, setSaved] = useState(false);

  const [openPanel, setOpenPanel] = useState(null); // which ActionRow is expanded
  const [blocked, setBlocked] = useState(null);
  const [blockedError, setBlockedError] = useState("");
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const resolveMedia = mediaSrc || ((url) => url);

  const themeColor =
    colorMode === "gradient" ? encodeThemeColor("gradient", gradFrom, gradTo) : solidHex;

  useEffect(() => {
    if (openPanel === "blocked" && blocked === null) loadBlocked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPanel]);

  async function loadBlocked() {
    setBlockedError("");
    try {
      const res = await fetch(`${serverUrl}/api/blocked`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Could not load blocked users");
      setBlocked(await res.json());
    } catch (err) {
      setBlockedError(err.message || "Could not load blocked users");
      setBlocked([]);
    }
  }

  async function handlePrivateProfileToggle(e) {
    const next = e.target.checked;
    setIsPrivate(next);
    setPrivateSaving(true);
    try {
      const res = await fetch(`${serverUrl}/api/account/privacy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isPrivate: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setIsPrivate(!next); // revert on failure
    } finally {
      setPrivateSaving(false);
    }
  }

  async function handleUnblock(userId) {
    try {
      await fetch(`${serverUrl}/api/blocked/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setBlocked((prev) => (prev || []).filter((u) => u.id !== userId));
    } catch {
      setBlockedError("Couldn't unblock — please try again.");
    }
  }

  async function handleChangePassword() {
    setPwError("");
    if (pwNew.length < 6) return setPwError("New password must be at least 6 characters.");
    if (pwNew !== pwConfirm) return setPwError("New passwords don't match.");
    setPwBusy(true);
    try {
      const res = await fetch(`${serverUrl}/api/account/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not change password");
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2000);
    } catch (err) {
      setPwError(err.message || "Could not change password");
    } finally {
      setPwBusy(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm.trim().toUpperCase() !== "DELETE") return;
    setDeleteBusy(true);
    try {
      await onDeleteAccount();
    } finally {
      setDeleteBusy(false);
    }
  }

  function handleThemeMode(mode) {
    setThemeMode(mode);
    if (mode === "system") {
      localStorage.setItem("mf_theme_mode", "system");
      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      if (prefersDark !== darkMode) onToggleDarkMode();
    } else {
      localStorage.setItem("mf_theme_mode", mode);
      if ((mode === "dark") !== darkMode) onToggleDarkMode();
    }
  }

  function handleSave() {
    const trimmed = name.trim();
    if (trimmed.length < 2 || !/^[A-Za-z\s.'-]+$/.test(trimmed)) {
      setNameError("Name must be 2+ letters, spaces, . ' - only.");
      return;
    }
    setNameError("");
    onSave({ username: trimmed, tagline, themeColor, showOnline });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggle(panel) {
    setOpenPanel((p) => (p === panel ? null : panel));
  }

  return (
    <div className="settings-panel settings-panel-redesign">
      <div className="settings-header">
        <h2>Settings</h2>
        <button type="button" className="settings-close" onClick={onClose} aria-label="Close settings">
          <svg className="icon" width="14" height="14"><use href="#close-icon" /></svg>
        </button>
      </div>

      <div className="settings-hero">
        <div
          className="settings-hero-cover"
          style={profile.coverUrl ? { backgroundImage: `url(${resolveMedia(profile.coverUrl)})` } : undefined}
        />
        <label className="settings-hero-cover-btn">
          <svg className="icon" width="14" height="14"><use href="#image-icon" /></svg>
          Change Cover
          <input
            type="file"
            accept="image/*"
            className="hidden-file-input"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onUploadCover(file);
            }}
          />
        </label>

        <div className="settings-hero-identity">
          <div className="settings-hero-avatar">
            <div className="settings-hero-avatar-inner">
              {profile.avatarUrl ? (
                <img src={resolveMedia(profile.avatarUrl)} alt="Profile" />
              ) : (
                <span>{initials(name)}</span>
              )}
            </div>
            <label className="settings-hero-avatar-edit" title="Change profile picture">
              <svg className="icon" width="13" height="13"><use href="#camera-icon" /></svg>
              <input
                type="file"
                accept="image/*"
                className="hidden-file-input"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) onUploadAvatar(file);
                }}
              />
            </label>
          </div>
          <div className="settings-hero-text">
            <div className="settings-hero-name">{profile.username}</div>
            <div className="settings-hero-status">
              <span className={"pulse-dot" + (connected ? "" : " off")} /> {connected ? "Active" : "Offline"}
            </div>
          </div>
        </div>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-card-head">
            <span className="settings-card-icon"><svg className="icon" width="15" height="15"><use href="#profile-icon" /></svg></span>
            <h3>Personal Information</h3>
          </div>

          <input
            className="settings-input"
            value={name}
            maxLength={24}
            placeholder="Your name"
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError("");
            }}
          />
          {nameError && <div className="settings-error">{nameError}</div>}

          <input
            className="settings-input"
            value={profile.phoneNumber || ""}
            disabled
            title="Phone number can't be changed"
          />

          <input
            className="settings-input"
            value={tagline}
            maxLength={140}
            placeholder="Add a tagline / status (e.g. Busy, Available after 6pm)"
            onChange={(e) => setTagline(e.target.value)}
          />
          <div className="settings-char-count">{tagline.length} / 140</div>
        </div>

        <div className="settings-card">
          <div className="settings-card-head">
            <span className="settings-card-icon"><svg className="icon" width="15" height="15"><use href="#settings-icon" /></svg></span>
            <h3>Appearance</h3>
          </div>

          <label className="settings-label">Theme Mode</label>
          <div className="theme-mode-row theme-mode-row-3">
            <button
              type="button"
              className={"theme-mode-btn" + (themeMode === "light" ? " active" : "")}
              onClick={() => handleThemeMode("light")}
            >
              <svg className="icon" width="14" height="14"><use href="#sun-icon" /></svg>
              Light
            </button>
            <button
              type="button"
              className={"theme-mode-btn" + (themeMode === "dark" ? " active" : "")}
              onClick={() => handleThemeMode("dark")}
            >
              <svg className="icon" width="14" height="14"><use href="#moon-icon" /></svg>
              Dark
            </button>
            <button
              type="button"
              className={"theme-mode-btn" + (themeMode === "system" ? " active" : "")}
              onClick={() => handleThemeMode("system")}
            >
              <svg className="icon" width="14" height="14"><use href="#laptop-icon" /></svg>
              System
            </button>
          </div>

          <label className="settings-label">Accent Color</label>
          <div className="settings-theme-row">
            {THEME_COLORS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={"theme-swatch" + (colorMode === "solid" && activePresetId === t.id ? " active" : "")}
                style={{ background: t.hex }}
                title={t.id}
                onClick={() => {
                  setColorMode("solid");
                  setSolidHex(t.hex);
                  setActivePresetId(t.id);
                }}
              >
                {colorMode === "solid" && activePresetId === t.id && "✓"}
              </button>
            ))}
            <label
              className={"theme-swatch theme-swatch-custom" + (colorMode === "solid" && activePresetId === "custom" ? " active" : "")}
              title="Custom color"
            >
              {colorMode === "solid" && activePresetId === "custom" ? "✓" : "+"}
              <input
                type="color"
                value={solidHex}
                onChange={(e) => {
                  setColorMode("solid");
                  setSolidHex(e.target.value);
                  setActivePresetId("custom");
                }}
              />
            </label>
          </div>

          <div className="theme-gradient-row">
            <label className="theme-gradient-stop">
              From
              <input
                type="color"
                value={gradFrom}
                onChange={(e) => {
                  setColorMode("gradient");
                  setGradFrom(e.target.value);
                }}
              />
            </label>
            <label className="theme-gradient-stop">
              To
              <input
                type="color"
                value={gradTo}
                onChange={(e) => {
                  setColorMode("gradient");
                  setGradTo(e.target.value);
                }}
              />
            </label>
          </div>

          <label className="settings-label">Gradient Preview</label>
          <button
            type="button"
            className={"theme-gradient-preview theme-gradient-preview-btn" + (colorMode === "gradient" ? " active" : "")}
            style={{ background: `linear-gradient(90deg, ${gradFrom}, ${gradTo})` }}
            onClick={() => setColorMode("gradient")}
            title="Use this gradient"
          />
        </div>

        <div className="settings-card">
          <div className="settings-card-head">
            <span className="settings-card-icon"><svg className="icon" width="15" height="15"><use href="#shield-icon" /></svg></span>
            <h3>Privacy &amp; Security</h3>
          </div>

          <ActionRow
            icon="contacts-icon"
            title="Who can see my profile"
            sub={profileVisibility === "everyone" ? "Everyone" : "Contacts only"}
            expanded={openPanel === "visibility"}
            onClick={() => toggle("visibility")}
          >
            <div className="settings-radio-row">
              <label>
                <input
                  type="radio"
                  checked={profileVisibility === "everyone"}
                  onChange={() => setProfileVisibility("everyone")}
                />
                Everyone
              </label>
              <label>
                <input
                  type="radio"
                  checked={profileVisibility === "contacts"}
                  onChange={() => setProfileVisibility("contacts")}
                />
                My contacts only
              </label>
            </div>
          </ActionRow>

          <div className="settings-action-wrap">
            <div className="settings-action-row settings-action-row-static">
              <span className="settings-action-icon">
                <svg className="icon" width="16" height="16"><use href="#shield-icon" /></svg>
              </span>
              <span className="settings-action-main">
                <span className="settings-action-title">Private Profile</span>
                <span className="settings-action-sub">
                  Others must send a chat request before messaging you. Your profile stays visible either way.
                </span>
              </span>
              <ToggleSwitch checked={isPrivate} onChange={handlePrivateProfileToggle} disabled={privateSaving} />
            </div>
          </div>

          <ActionRow
            icon="eye-icon"
            title="Last seen & online"
            sub={showOnline ? "Everyone" : "Hidden"}
            expanded={openPanel === "lastseen"}
            onClick={() => toggle("lastseen")}
          >
            <label className="settings-toggle-row settings-toggle-row-flush">
              <span>Show my online status to others</span>
              <ToggleSwitch checked={showOnline} onChange={(e) => setShowOnline(e.target.checked)} />
            </label>
            <p className="settings-hint">
              When off, other people will see you as offline even while connected.
            </p>
          </ActionRow>

          <div className="settings-action-wrap">
            <div className="settings-action-row settings-action-row-static">
              <span className="settings-action-icon">
                <svg className="icon" width="16" height="16"><use href="#info-icon" /></svg>
              </span>
              <span className="settings-action-main">
                <span className="settings-action-title">Read receipts</span>
                <span className="settings-action-sub">Let others see when you've read their messages</span>
              </span>
              <ToggleSwitch checked={readReceipts} onChange={(e) => setReadReceipts(e.target.checked)} />
            </div>
          </div>

          <ActionRow
            icon="ban-icon"
            title="Blocked users"
            sub={blocked ? `${blocked.length} blocked` : "Manage users you've blocked"}
            expanded={openPanel === "blocked"}
            onClick={() => toggle("blocked")}
          >
            {blockedError && <div className="settings-error">{blockedError}</div>}
            {blocked === null && !blockedError && (
              <p className="settings-hint">Loading…</p>
            )}
            {blocked && blocked.length === 0 && (
              <p className="settings-hint">You haven't blocked anyone.</p>
            )}
            {blocked && blocked.length > 0 && (
              <div className="settings-blocked-list">
                {blocked.map((u) => (
                  <div key={u.id} className="settings-blocked-row">
                    <span className="settings-blocked-avatar">
                      {u.avatarUrl ? (
                        <img src={resolveMedia(u.avatarUrl)} alt="" />
                      ) : (
                        (u.username || "?").slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <span className="settings-blocked-info">
                      <span className="settings-blocked-name">{u.username}</span>
                      {u.phoneNumber && <span className="settings-blocked-phone">{u.phoneNumber}</span>}
                    </span>
                    <button type="button" className="settings-mini-btn" onClick={() => handleUnblock(u.id)}>
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ActionRow>
        </div>

        <div className="settings-card">
          <div className="settings-card-head">
            <span className="settings-card-icon"><svg className="icon" width="15" height="15"><use href="#lock-icon" /></svg></span>
            <h3>Account</h3>
          </div>

          <ActionRow
            icon="lock-icon"
            title="Change Password"
            sub="Update your account password"
            expanded={openPanel === "password"}
            onClick={() => toggle("password")}
          >
            <input
              type="password"
              className="settings-input"
              placeholder="Current password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
            />
            <input
              type="password"
              className="settings-input"
              placeholder="New password (min. 6 characters)"
              value={pwNew}
              onChange={(e) => setPwNew(e.target.value)}
            />
            <input
              type="password"
              className="settings-input"
              placeholder="Confirm new password"
              value={pwConfirm}
              onChange={(e) => setPwConfirm(e.target.value)}
            />
            {pwError && <div className="settings-error">{pwError}</div>}
            <button type="button" className="settings-mini-btn settings-mini-btn-solid" disabled={pwBusy} onClick={handleChangePassword}>
              {pwBusy ? "Saving…" : pwSaved ? "Saved ✓" : "Update password"}
            </button>
          </ActionRow>

          <ActionRow
            icon="bell-icon"
            title="Notifications"
            sub="Manage your notification preferences"
            expanded={openPanel === "notifications"}
            onClick={() => toggle("notifications")}
          >
            <p className="settings-hint">
              Push notifications follow your browser permission. Open your browser's site settings for this app to change them.
            </p>
          </ActionRow>

          <ActionRow
            icon="laptop-icon"
            title="Devices"
            sub="Manage your connected devices"
            expanded={openPanel === "devices"}
            onClick={() => toggle("devices")}
          >
            <p className="settings-hint">
              You're currently signed in on this device. Logging out below ends this session.
            </p>
          </ActionRow>

          <ActionRow
            icon="delete-trash-icon"
            danger
            title="Delete Account"
            sub="Permanently delete your account"
            expanded={openPanel === "delete"}
            onClick={() => toggle("delete")}
          >
            <p className="settings-hint">
              This permanently deletes your account, messages, and conversations. This can't be undone.
              Type <strong>DELETE</strong> to confirm.
            </p>
            <input
              className="settings-input"
              placeholder="Type DELETE to confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
            <button
              type="button"
              className="settings-mini-btn settings-mini-btn-danger"
              disabled={deleteConfirm.trim().toUpperCase() !== "DELETE" || deleteBusy}
              onClick={handleDeleteAccount}
            >
              {deleteBusy ? "Deleting…" : "Permanently delete my account"}
            </button>
          </ActionRow>
        </div>
      </div>

      <div className="settings-actions settings-actions-redesign">
        <button type="button" className="settings-save-btn" onClick={handleSave}>
          <svg className="icon" width="15" height="15"><use href="#edit-pencil-icon" /></svg>
          {saved ? "Saved ✓" : "Save Changes"}
        </button>
        <button type="button" className="settings-logout-btn" onClick={onLogout}>
          <svg className="icon" width="16" height="16"><use href="#logout-icon" /></svg>
          Log out
        </button>
      </div>
    </div>
  );
}