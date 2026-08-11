import { useEffect, useRef, useState } from "react";

const BADGE_DEFS = [
  {
    id: "chat-starter",
    icon: "chat-icon",
    title: "Chat Starter",
    sub: (n) => `Start ${n} conversations`,
    goal: 10,
    metric: "chats",
  },
  {
    id: "social-butterfly",
    icon: "contacts-icon",
    title: "Social Butterfly",
    sub: (n) => `Add ${n} friends`,
    goal: 25,
    metric: "friends",
  },
  {
    id: "group-explorer",
    icon: "groups-icon",
    title: "Group Explorer",
    sub: (n) => `Join ${n} groups`,
    goal: 10,
    metric: "groups",
  },
  {
    id: "game-lover",
    icon: "video-call-icon",
    title: "Game Lover",
    sub: (n) => `Play ${n} games`,
    goal: 5,
    metric: "games",
  },
  {
    id: "active-member",
    icon: "profile-icon",
    title: "Active Member",
    sub: () => "Online right now",
    goal: 1,
    metric: "activeNow",
  },
];

export default function ProfilePage({
  profile,
  connected,
  stats,
  uploading,
  onUploadAvatar,
  onUploadCover,
  onSave,
  onClose,
}) {
  const { username, phoneNumber, avatarUrl, coverUrl, tagline } = profile;
  const { chats = 0, friends = 0, groups = 0, games = 0 } = stats || {};

  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(username || "");
  const [taglineInput, setTaglineInput] = useState(tagline || "");
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (!editing) {
      setNameInput(username || "");
      setTaglineInput(tagline || "");
    }
  }, [username, tagline, editing]);

  function startEdit() {
    setNameInput(username || "");
    setTaglineInput(tagline || "");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function saveEdit() {
    const trimmedName = nameInput.trim();
    if (!trimmedName) return;
    onSave({
      username: trimmedName,
      tagline: taglineInput.trim(),
    });
    setEditing(false);
  }

  function pickAvatar() {
    avatarInputRef.current?.click();
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (file && onUploadAvatar) onUploadAvatar(file);
    e.target.value = "";
  }

  const metricValues = { chats, friends, groups, games, activeNow: connected ? 1 : 0 };
  const earnedBadges = BADGE_DEFS.filter((b) => metricValues[b.metric] >= b.goal);
  const inProgressBadges = BADGE_DEFS.filter((b) => metricValues[b.metric] < b.goal);
  const badgesToShow = [...earnedBadges, ...inProgressBadges].slice(0, 5);

  return (
    <div className="profile-page mfp">
      <div className="settings-header">
        <h2>My Profile</h2>
        <button type="button" className="settings-close" onClick={onClose} aria-label="Close profile">
          <svg className="icon" width="14" height="14"><use href="#close-icon" /></svg>
        </button>
      </div>

      <div
        className="mfp-hero"
      >
        <div
          className="mfp-hero-bg"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
        />
        {!editing && (
          <button type="button" className="mfp-edit-btn" onClick={startEdit}>
            <svg className="icon" width="14" height="14"><use href="#edit-pencil-icon" /></svg>
            Edit Profile
          </button>
        )}
        {onUploadCover && (
          <button
            type="button"
            className="mfp-cover-btn"
            title="Change cover"
            onClick={() => document.getElementById("mfp-cover-input")?.click()}
          >
            <svg className="icon" width="13" height="13"><use href="#camera-icon" /></svg>
          </button>
        )}
        {onUploadCover && (
          <input
            id="mfp-cover-input"
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadCover(file);
              e.target.value = "";
            }}
          />
        )}

        <div className="profile-avatar-wrap mfp-avatar-wrap">
          <div className="profile-avatar mfp-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" />
            ) : (
              <span>{(username || "?").trim().slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <button
            type="button"
            className="settings-avatar-edit mfp-avatar-edit"
            title="Change photo"
            onClick={pickAvatar}
            disabled={uploading}
          >
            <svg className="icon" width="14" height="14"><use href="#camera-icon" /></svg>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleAvatarChange}
          />
        </div>

        <div className="profile-identity mfp-identity">
          {editing ? (
            <input
              className="settings-input mfp-name-input"
              value={nameInput}
              maxLength={40}
              placeholder="Your name"
              onChange={(e) => setNameInput(e.target.value)}
              autoFocus
            />
          ) : (
            <div className="profile-name">{username || "—"}</div>
          )}
          <div className="profile-status mfp-status">
            <span className={"pulse-dot" + (connected ? "" : " off")} />
            {connected ? "Active" : "Offline"}
          </div>
        </div>

        {editing ? (
          <div className="mfp-tagline-edit">
            <input
              className="settings-input"
              value={taglineInput}
              maxLength={120}
              placeholder="Add a status or quote..."
              onChange={(e) => setTaglineInput(e.target.value)}
            />
            <div className="mfp-edit-actions">
              <button type="button" className="mfp-btn-ghost" onClick={cancelEdit}>
                Cancel
              </button>
              <button
                type="button"
                className="mfp-btn-primary"
                onClick={saveEdit}
                disabled={!nameInput.trim()}
              >
                Save changes
              </button>
            </div>
          </div>
        ) : (
          tagline && <p className="profile-quote">“{tagline}”</p>
        )}
      </div>

      <div className="mfp-grid">
        <div className="about-card mfp-about">
          <div className="about-card-title">
            <svg className="icon" width="15" height="15"><use href="#profile-icon" /></svg>
            About Me
          </div>
          <div className="about-row">
            <span className="about-row-label">
              <svg className="icon" width="13" height="13"><use href="#profile-icon" /></svg>
              Full Name
            </span>
            <span className="about-row-value">{username || "—"}</span>
          </div>
          <div className="about-row">
            <span className="about-row-label">
              <svg className="icon" width="13" height="13"><use href="#phone-icon" /></svg>
              Phone
            </span>
            <span className="about-row-value">{phoneNumber || "—"}</span>
          </div>
          <div className="about-row">
            <span className="about-row-label">
              <svg className="icon" width="13" height="13"><use href="#contacts-icon" /></svg>
              Username
            </span>
            <span className="about-row-value">@{(username || "user").toLowerCase().replace(/\s+/g, "")}</span>
          </div>
          <div className="about-row">
            <span className="about-row-label">
              <svg className="icon" width="13" height="13"><use href="#info-icon" /></svg>
              Status
            </span>
            <span className={"mfp-pill" + (connected ? "" : " off")}>
              {connected ? "Active" : "Offline"}
            </span>
          </div>
          <div className="about-row mfp-about-row-wrap">
            <span className="about-row-label">
              <svg className="icon" width="13" height="13"><use href="#info-icon" /></svg>
              About
            </span>
            <span className="about-row-value">{tagline || "No status set yet."}</span>
          </div>
        </div>

        <div className="mfp-activity">
          <div className="about-card-title mfp-activity-title">
            <svg className="icon" width="15" height="15"><use href="#admin-icon" /></svg>
            Activity Overview
          </div>
          <div className="mfp-stat-grid">
            <div className="mfp-stat-card mfp-stat-purple">
              <svg className="icon" width="22" height="22"><use href="#chat-icon" /></svg>
              <div className="mfp-stat-num">{chats}</div>
              <div className="mfp-stat-label">Chats</div>
            </div>
            <div className="mfp-stat-card mfp-stat-pink">
              <svg className="icon" width="22" height="22"><use href="#contacts-icon" /></svg>
              <div className="mfp-stat-num">{friends}</div>
              <div className="mfp-stat-label">Friends</div>
            </div>
            <div className="mfp-stat-card mfp-stat-orange">
              <svg className="icon" width="22" height="22"><use href="#groups-icon" /></svg>
              <div className="mfp-stat-num">{groups}</div>
              <div className="mfp-stat-label">Groups</div>
            </div>
            <div className="mfp-stat-card mfp-stat-blue">
              <svg className="icon" width="22" height="22"><use href="#video-call-icon" /></svg>
              <div className="mfp-stat-num">{games}</div>
              <div className="mfp-stat-label">Games Played</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mfp-badges">
        <div className="about-card-title mfp-badges-title">
          <svg className="icon" width="15" height="15"><use href="#admin-icon" /></svg>
          Badges
        </div>
        <div className="mfp-badge-row">
          {badgesToShow.map((b) => {
            const earned = metricValues[b.metric] >= b.goal;
            return (
              <div key={b.id} className={"mfp-badge" + (earned ? " earned" : "")} title={earned ? "Unlocked" : "Locked"}>
                <div className="mfp-badge-icon">
                  <svg className="icon" width="20" height="20"><use href={`#${b.icon}`} /></svg>
                </div>
                <div className="mfp-badge-name">{b.title}</div>
                <div className="mfp-badge-sub">{b.sub(b.goal)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}