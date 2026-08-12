import { useEffect, useState } from "react";

/**
 * Right-side "Group Info" panel — mirrors the provided mockup.
 * Shown when the person taps the group header / Info in the ⋮ menu.
 */
export default function GroupInfoPanel({
  conv, // conversation object: { id, name, avatarUrl, members, myIsAdmin, createdAt }
  myUserId,
  mediaCount,
  onClose,
  onOpenAvatar,
  onPickAvatar,
  onRename,
  onAudioCall,
  onVideoCall,
  onOpenMember,
  onDeleteGroup,
  onLeaveGroup,
  uploading,
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(conv?.name || "");
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setNameDraft(conv?.name || "");
    try {
      const mutedIds = JSON.parse(localStorage.getItem("mf_muted_convs") || "[]");
      setMuted(mutedIds.includes(conv?.id));
    } catch {
      setMuted(false);
    }
  }, [conv?.id, conv?.name]);

  if (!conv) return null;

  const onlineCount = conv.members?.filter((m) => m.online).length || 0;

  function saveNameEdit() {
    const trimmed = nameDraft.trim();
    setEditingName(false);
    if (trimmed && trimmed !== conv.name) onRename(trimmed);
  }

  function toggleMute() {
    let mutedIds = [];
    try {
      mutedIds = JSON.parse(localStorage.getItem("mf_muted_convs") || "[]");
    } catch {
      mutedIds = [];
    }
    const next = muted ? mutedIds.filter((id) => id !== conv.id) : [...mutedIds, conv.id];
    localStorage.setItem("mf_muted_convs", JSON.stringify(next));
    setMuted(!muted);
  }

  return (
    <div className="info-panel-backdrop" onClick={onClose}>
      <div className="info-panel" onClick={(e) => e.stopPropagation()}>
        <div className="info-panel-header">
          <button type="button" className="info-panel-back" onClick={onClose} aria-label="Back">
            ←
          </button>
          <h3>Group Info</h3>
          <button type="button" className="info-panel-close" onClick={onClose} aria-label="Close">
            <svg className="icon" width="16" height="16"><use href="#close-icon" /></svg>
          </button>
        </div>

        <div className="info-panel-hero">
          <div
            className="info-panel-avatar info-panel-avatar-group"
            onClick={() => conv.avatarUrl && onOpenAvatar(conv.avatarUrl)}
            title="View group photo"
          >
            {conv.avatarUrl ? <img src={conv.avatarUrl} alt="" /> : <span>👥</span>}
            {uploading && <span className="room-avatar-spinner" />}
          </div>
          {conv.myIsAdmin && (
            <button type="button" className="info-panel-avatar-edit" title="Change group photo" onClick={onPickAvatar}>
              <svg className="icon" width="13" height="13"><use href="#camera-icon" /></svg>
            </button>
          )}

          {editingName ? (
            <input
              className="info-panel-name-input"
              value={nameDraft}
              autoFocus
              maxLength={80}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveNameEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveNameEdit();
                if (e.key === "Escape") {
                  setNameDraft(conv.name || "");
                  setEditingName(false);
                }
              }}
            />
          ) : (
            <div className="info-panel-name">
              {conv.name}
              {conv.myIsAdmin && (
                <button type="button" className="info-panel-edit-btn" onClick={() => setEditingName(true)} title="Rename group">
                  <svg className="icon" width="14" height="14"><use href="#edit-pencil-icon" /></svg>
                </button>
              )}
            </div>
          )}
          <div className="info-panel-status">
            {conv.members?.length || 0} members · <span className="status-online">{onlineCount} online</span>
          </div>
        </div>

        <div className="info-panel-actions">
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
          <div className="info-panel-section-title-row">
            <div className="info-panel-section-title">Media, Links & Files</div>
            <span className="info-panel-count">{mediaCount ?? "…"}</span>
          </div>
        </div>

        <div className="info-panel-section">
          <div className="info-panel-row info-panel-row-toggle">
            <span className="info-panel-row-icon"><svg className="icon" width="16" height="16"><use href="#bell-icon" /></svg></span>
            <div style={{ flex: 1 }}>
              <div className="info-panel-row-label">Notifications</div>
              <div className="info-panel-row-sub">Mute this group's notifications</div>
            </div>
            <button
              type="button"
              className={"info-panel-switch" + (muted ? "" : " on")}
              onClick={toggleMute}
              aria-pressed={!muted}
              title={muted ? "Unmute" : "Mute"}
            >
              <span className="info-panel-switch-knob" />
            </button>
          </div>
        </div>

        <div className="info-panel-section">
          <div className="info-panel-section-title-row">
            <div className="info-panel-section-title">Members ({conv.members?.length || 0})</div>
            <span className="info-panel-count">{onlineCount} online</span>
          </div>
          <div className="info-panel-members">
            {(conv.members || []).map((m) => (
              <div key={m.id} className="info-panel-member-row" onClick={() => m.id !== myUserId && onOpenMember(m)}>
                <span className="avatar info-panel-member-avatar">
                  {m.avatarUrl ? <img src={m.avatarUrl} alt="" /> : (m.username || "?").slice(0, 2).toUpperCase()}
                </span>
                <div className="info-panel-member-text">
                  <div className="info-panel-member-name">
                    {m.username}
                    {m.id === myUserId && <span className="info-panel-you-tag"> (You)</span>}
                  </div>
                  {m.online && <div className="info-panel-row-sub status-online">Online</div>}
                </div>
                {m.isAdmin && <span className="info-panel-admin-tag">Admin</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="info-panel-footer-actions">
          <button type="button" className="info-panel-danger-btn" onClick={onLeaveGroup}>
            <svg className="icon" width="16" height="16"><use href="#exit-icon" /></svg>
            Leave Group
          </button>
          {conv.myIsAdmin && (
            <button type="button" className="info-panel-danger-btn info-panel-danger-btn-solid" onClick={onDeleteGroup}>
              <svg className="icon" width="16" height="16"><use href="#delete-trash-icon" /></svg>
              Delete Group
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
