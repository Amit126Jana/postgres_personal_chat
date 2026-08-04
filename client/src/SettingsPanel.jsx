import { useState } from "react";

export const THEME_COLORS = [
  { id: "violet", hex: "#6f5cf5" },
  { id: "blue", hex: "#38bdf8" },
  { id: "purple", hex: "#a855f7" },
  { id: "pink", hex: "#ec4899" },
  { id: "green", hex: "#22c55e" },
  { id: "slate", hex: "#94a3b8" },
];

// The app's own logo/icon gradient — used as the default when someone picks
// "Gradient" without having set custom stops yet.
export const LOGO_GRADIENT = ["#863bff", "#47bfff"];

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

function Collapse({ title, defaultOpen, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={"settings-collapse" + (open ? " open" : "")}>
      <button type="button" className="settings-collapse-head" onClick={() => setOpen((v) => !v)}>
        {title}
        <svg className="icon" width="16" height="16"><use href="#chevron-down-icon" /></svg>
      </button>
      {open && <div className="settings-collapse-body">{children}</div>}
    </div>
  );
}

export default function SettingsPanel({
  profile, // { username, phoneNumber, avatarUrl, tagline, themeColor, showOnline }
  connected,
  uploading,
  darkMode,
  onToggleDarkMode,
  onUploadAvatar,
  onSave,
  onLogout,
  onClose,
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
  // Tracks which preset/custom swatch is highlighted when in solid mode.
  const [activePresetId, setActivePresetId] = useState(
    initialResolved.mode === "solid"
      ? THEME_COLORS.find((t) => t.hex.toLowerCase() === initialResolved.hex.toLowerCase())?.id || "custom"
      : null,
  );

  const [showOnline, setShowOnline] = useState(profile.showOnline !== false);
  const [nameError, setNameError] = useState("");
  const [saved, setSaved] = useState(false);

  const themeColor =
    colorMode === "gradient" ? encodeThemeColor("gradient", gradFrom, gradTo) : solidHex;

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

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Settings</h2>
        <button type="button" className="settings-close" onClick={onClose} aria-label="Close settings">
          <svg className="icon" width="14" height="14"><use href="#close-icon" /></svg>
        </button>
      </div>

      <div className="settings-banner" />

      <div className="settings-avatar-wrap">
        <div className="settings-avatar">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="Profile" />
          ) : (
            <span>{(name || "?").trim().slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <label className="settings-avatar-edit" title="Change profile picture">
          <svg className="icon" width="15" height="15"><use href="#camera-icon" /></svg>
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

      <div className="settings-identity">
        <div className="settings-name">{profile.username}</div>
        <div className="settings-status">
          <span className={"pulse-dot" + (connected ? "" : " off")} /> {connected ? "Active" : "Offline"}
        </div>
      </div>

      <div className="settings-section">
        <label className="settings-label">Personal info</label>
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
      </div>

      <div className="settings-section">
        <label className="settings-label">Choose theme color</label>

        <div className="theme-mode-row">
          <button
            type="button"
            className={"theme-mode-btn" + (colorMode === "solid" ? " active" : "")}
            onClick={() => setColorMode("solid")}
          >
            Solid
          </button>
          <button
            type="button"
            className={"theme-mode-btn" + (colorMode === "gradient" ? " active" : "")}
            onClick={() => setColorMode("gradient")}
          >
            Gradient
          </button>
        </div>

        {colorMode === "solid" ? (
          <div className="settings-theme-row">
            {THEME_COLORS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={"theme-swatch" + (activePresetId === t.id ? " active" : "")}
                style={{ background: t.hex }}
                title={t.id}
                onClick={() => {
                  setSolidHex(t.hex);
                  setActivePresetId(t.id);
                }}
              >
                {activePresetId === t.id && "✓"}
              </button>
            ))}
            {/* Custom color picker — opens the native OS color wheel */}
            <label
              className={"theme-swatch theme-swatch-custom" + (activePresetId === "custom" ? " active" : "")}
              title="Custom color"
            >
              {activePresetId === "custom" ? "✓" : "+"}
              <input
                type="color"
                value={solidHex}
                onChange={(e) => {
                  setSolidHex(e.target.value);
                  setActivePresetId("custom");
                }}
              />
            </label>
          </div>
        ) : (
          <div className="theme-gradient-row">
            <label className="theme-gradient-stop">
              From
              <input type="color" value={gradFrom} onChange={(e) => setGradFrom(e.target.value)} />
            </label>
            <div
              className="theme-gradient-preview"
              style={{ background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})` }}
            />
            <label className="theme-gradient-stop">
              To
              <input type="color" value={gradTo} onChange={(e) => setGradTo(e.target.value)} />
            </label>
          </div>
        )}
      </div>

      <div className="settings-section">
        <label className="settings-label">Appearance</label>
        <label className="settings-toggle-row">
          <span>
            <svg className="icon" width="14" height="14" style={{ marginRight: 6 }}>
              <use href={darkMode ? "#moon-icon" : "#sun-icon"} />
            </svg>
            Dark mode
          </span>
          <input type="checkbox" checked={darkMode} onChange={onToggleDarkMode} />
        </label>
      </div>

      <Collapse title="Privacy">
        <label className="settings-toggle-row">
          <span>Show my online status to others</span>
          <input
            type="checkbox"
            checked={showOnline}
            onChange={(e) => setShowOnline(e.target.checked)}
          />
        </label>
        <p style={{ margin: 0, fontSize: 12.5 }}>
          When off, other people will see you as offline even while connected.
        </p>
      </Collapse>

      <Collapse title="Security">
        <p style={{ margin: 0, fontSize: 12.5 }}>
          Your account is tied to your phone number. Two-factor verification isn't enabled yet.
        </p>
      </Collapse>

      <div className="settings-actions">
        <button type="button" className="settings-save-btn" onClick={handleSave}>
          {saved ? "Saved ✓" : "Save changes"}
        </button>
        <button type="button" className="settings-logout-btn" onClick={onLogout}>
          <svg className="icon" width="16" height="16"><use href="#logout-icon" /></svg>
          Log out
        </button>
      </div>
    </div>
  );
}
