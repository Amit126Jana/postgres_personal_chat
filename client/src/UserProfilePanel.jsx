import { useState } from "react";

/**
 * Right-side "User Profile" panel for a direct chat — mirrors the provided mockup.
 * Shown when the person taps the chat header / Info in the ⋮ menu on a 1:1 chat.
 */
export default function UserProfilePanel({
  user, // { id, username, avatarUrl, phoneNumber, tagline, online }
  mediaCount,
  onClose,
  onOpenAvatar,
  onMessage,
  onAudioCall,
  onVideoCall,
  onBlock,
  onRemoveFriend,
  serverUrl,
  token,
}) {
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function handleBlock() {
    if (!window.confirm(`Block ${user.username}? They won't be able to message or call you.`)) return;
    setBusy(true);
    try {
      await onBlock(user.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="info-panel-backdrop" onClick={onClose}>
      <div className="info-panel" onClick={(e) => e.stopPropagation()}>
        <div className="info-panel-header">
          <button type="button" className="info-panel-back" onClick={onClose} aria-label="Back">
            ←
          </button>
          <h3>User Profile</h3>
          <button type="button" className="info-panel-close" onClick={onClose} aria-label="Close">
            <svg className="icon" width="16" height="16"><use href="#close-icon" /></svg>
          </button>
        </div>

        <div className="info-panel-hero">
          <div
            className="info-panel-avatar"
            onClick={() => user.avatarUrl && onOpenAvatar(user.avatarUrl)}
            title="View photo"
          >
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{(user.username || "?").slice(0, 2).toUpperCase()}</span>}
          </div>
          <div className="info-panel-name">{user.username}</div>
          <div className={"info-panel-status" + (user.online ? " online" : "")}>
            <span className="pulse-dot" /> {user.online ? "Online" : "Offline"}
          </div>
          {user.tagline && <p className="info-panel-tagline">&ldquo;{user.tagline}&rdquo;</p>}
        </div>

        <div className="info-panel-actions">
          <button type="button" onClick={onMessage}>
            <svg className="icon" width="18" height="18"><use href="#chat-icon" /></svg>
            Message
          </button>
          <button type="button" onClick={onAudioCall}>
            <svg className="icon" width="18" height="18"><use href="#phone-icon" /></svg>
            Audio Call
          </button>
          <button type="button" onClick={onVideoCall}>
            <svg className="icon" width="18" height="18"><use href="#video-call-icon" /></svg>
            Video Call
          </button>
        </div>

        <div className="info-panel-section">
          <div className="info-panel-section-title">About</div>
          <div className="info-panel-row">
            <span className="info-panel-row-icon"><svg className="icon" width="16" height="16"><use href="#profile-icon" /></svg></span>
            <div>
              <div className="info-panel-row-label">Username</div>
              <div className="info-panel-row-value">@{(user.username || "").toLowerCase().replace(/\s+/g, "")}</div>
            </div>
          </div>
          {user.phoneNumber && (
            <div className="info-panel-row">
              <span className="info-panel-row-icon"><svg className="icon" width="16" height="16"><use href="#phone-icon" /></svg></span>
              <div>
                <div className="info-panel-row-label">Phone</div>
                <div className="info-panel-row-value">{user.phoneNumber}</div>
              </div>
            </div>
          )}
          <div className="info-panel-row">
            <span className="info-panel-row-icon"><svg className="icon" width="16" height="16"><use href="#info-icon" /></svg></span>
            <div>
              <div className="info-panel-row-label">Status</div>
              <div className={"info-panel-row-value" + (user.online ? " status-online" : "")}>
                {user.online ? "Online" : "Offline"}
              </div>
            </div>
          </div>
        </div>

        <div className="info-panel-section">
          <div className="info-panel-section-title-row">
            <div className="info-panel-section-title">Shared Media</div>
            <span className="info-panel-count">{mediaCount ?? "…"}</span>
          </div>
          <p className="settings-hint" style={{ margin: "0 0 4px" }}>
            {mediaCount === 0
              ? "No media shared yet."
              : `${mediaCount ?? "…"} photo, video, and file message${mediaCount === 1 ? "" : "s"} shared in this chat.`}
          </p>
        </div>

        <div className="info-panel-section">
          <button type="button" className="info-panel-list-btn" onClick={handleBlock} disabled={busy}>
            <span className="info-panel-row-icon danger"><svg className="icon" width="16" height="16"><use href="#ban-icon" /></svg></span>
            <div>
              <div className="info-panel-row-label danger">Block User</div>
              <div className="info-panel-row-sub">You won't receive messages from them</div>
            </div>
          </button>
        </div>

        {onRemoveFriend && (
          <button type="button" className="info-panel-danger-btn" onClick={onRemoveFriend}>
            <svg className="icon" width="16" height="16"><use href="#delete-trash-icon" /></svg>
            Remove Friend
          </button>
        )}
      </div>
    </div>
  );
}
