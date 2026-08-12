import { useEffect, useState } from "react";

/**
 * Right-side "Group Info" panel — mirrors the provided mockup.
 * Shown when the person taps the group header / Info in the ⋮ menu.
 */
export default function GroupInfoPanel({
  conv, // conversation object: { id, name, avatarUrl, members, myIsAdmin, myIsOfficer, createdAt }
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
  serverUrl,
  token,
  onAddMember,
  onRemoveMember,
  onSetRole,
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(conv?.name || "");
  const [muted, setMuted] = useState(false);
  const [openMemberMenuFor, setOpenMemberMenuFor] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    setNameDraft(conv?.name || "");
    try {
      const mutedIds = JSON.parse(localStorage.getItem("mf_muted_convs") || "[]");
      setMuted(mutedIds.includes(conv?.id));
    } catch {
      setMuted(false);
    }
  }, [conv?.id, conv?.name]);

  useEffect(() => {
    if (!showAddMember || !serverUrl) return;
    let cancelled = false;
    fetch(`${serverUrl}/api/users`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((list) => {
        if (!cancelled && Array.isArray(list)) setAllUsers(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showAddMember, serverUrl, token]);

  if (!conv) return null;

  // Can this person manage members (add/remove regular members, rename, change photo)?
  // Officers can do everything an admin can here, except grant/revoke admin or officer
  // status, and except removing an admin or another officer.
  const myRole = conv.myIsAdmin ? "admin" : conv.myIsOfficer ? "officer" : "member";
  const canManageMembers = myRole === "admin" || myRole === "officer";

  const onlineCount = conv.members?.filter((m) => m.online).length || 0;
  const memberIds = new Set((conv.members || []).map((m) => m.id));
  const addableUsers = allUsers.filter((u) => !memberIds.has(u.id));

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

  function roleLabel(m) {
    if (m.isAdmin) return "Admin";
    if (m.isOfficer) return "Officer";
    return null;
  }

  // What can *I* do to member `m`, given my own role?
  function memberActions(m) {
    if (m.id === myUserId) return [];
    const actions = [];
    const targetRole = m.isAdmin ? "admin" : m.isOfficer ? "officer" : "member";

    const canRemove =
      myRole === "admin" ? true : myRole === "officer" ? targetRole === "member" : false;
    if (canRemove) actions.push({ key: "remove", label: "Remove from group" });

    // Only admins can grant/revoke admin or officer status.
    if (myRole === "admin") {
      if (targetRole !== "officer") actions.push({ key: "makeOfficer", label: "Make officer" });
      if (targetRole !== "admin") actions.push({ key: "makeAdmin", label: "Make admin" });
      if (targetRole !== "member") actions.push({ key: "makeMember", label: "Remove role (make member)" });
    }
    return actions;
  }

  function runMemberAction(m, key) {
    setOpenMemberMenuFor(null);
    if (key === "remove") onRemoveMember(m.id);
    else if (key === "makeOfficer") onSetRole(m.id, "officer");
    else if (key === "makeAdmin") onSetRole(m.id, "admin");
    else if (key === "makeMember") onSetRole(m.id, "member");
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
          {canManageMembers && (
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
              {canManageMembers && (
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
            {(conv.members || []).map((m) => {
              const actions = memberActions(m);
              return (
                <div key={m.id} className="info-panel-member-row" style={{ position: "relative" }}>
                  <span
                    className="avatar info-panel-member-avatar"
                    onClick={() => m.id !== myUserId && onOpenMember(m)}
                  >
                    {m.avatarUrl ? <img src={m.avatarUrl} alt="" /> : (m.username || "?").slice(0, 2).toUpperCase()}
                  </span>
                  <div
                    className="info-panel-member-text"
                    onClick={() => m.id !== myUserId && onOpenMember(m)}
                  >
                    <div className="info-panel-member-name">
                      {m.username}
                      {m.id === myUserId && <span className="info-panel-you-tag"> (You)</span>}
                    </div>
                    {m.online && <div className="info-panel-row-sub status-online">Online</div>}
                  </div>
                  {roleLabel(m) && (
                    <span className={"info-panel-admin-tag" + (m.isOfficer ? " info-panel-officer-tag" : "")}>
                      {roleLabel(m)}
                    </span>
                  )}
                  {actions.length > 0 && (
                    <button
                      type="button"
                      className="info-panel-member-menu-btn"
                      title="Member options"
                      onClick={() => setOpenMemberMenuFor(openMemberMenuFor === m.id ? null : m.id)}
                    >
                      ⋮
                    </button>
                  )}
                  {openMemberMenuFor === m.id && (
                    <div className="info-panel-member-menu" onClick={(e) => e.stopPropagation()}>
                      {actions.map((a) => (
                        <button
                          key={a.key}
                          type="button"
                          className={a.key === "remove" ? "danger" : ""}
                          onClick={() => runMemberAction(m, a.key)}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {canManageMembers && (
            <div className="info-panel-add-member">
              {!showAddMember ? (
                <button type="button" className="info-panel-add-member-btn" onClick={() => setShowAddMember(true)}>
                  + Add Member
                </button>
              ) : (
                <div className="info-panel-add-member-picker">
                  <div className="info-panel-add-member-picker-header">
                    <span>Add someone</span>
                    <button type="button" onClick={() => setShowAddMember(false)}>✕</button>
                  </div>
                  {addableUsers.length === 0 ? (
                    <div className="info-panel-row-sub">No one else to add.</div>
                  ) : (
                    addableUsers.map((u) => (
                      <div
                        key={u.id}
                        className="info-panel-member-row info-panel-add-member-row"
                        onClick={() => {
                          onAddMember(u.id);
                          setShowAddMember(false);
                        }}
                      >
                        <span className="avatar info-panel-member-avatar">
                          {u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : (u.username || "?").slice(0, 2).toUpperCase()}
                        </span>
                        <div className="info-panel-member-text">
                          <div className="info-panel-member-name">{u.username}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
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