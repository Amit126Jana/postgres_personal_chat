export default function ProfilePage({ profile, connected, onClose }) {
  const { username, phoneNumber, avatarUrl, tagline } = profile;

  return (
    <div className="profile-page">
      <div className="settings-header">
        <h2>My Profile</h2>
        <button type="button" className="settings-close" onClick={onClose} aria-label="Close profile">
          <svg className="icon" width="14" height="14"><use href="#close-icon" /></svg>
        </button>
      </div>

      <div className="settings-banner" />

      <div className="profile-avatar-wrap">
        <div className="profile-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" />
          ) : (
            <span>{(username || "?").trim().slice(0, 2).toUpperCase()}</span>
          )}
        </div>
      </div>

      <div className="profile-identity">
        <div className="profile-name">{username || "—"}</div>
        <div className="profile-status">
          <span className={"pulse-dot" + (connected ? "" : " off")} />
          {connected ? "Active" : "Offline"}
        </div>
      </div>

      {tagline && <p className="profile-quote">“{tagline}”</p>}

      <div className="about-card">
        <div className="about-card-title">
          <svg className="icon" width="15" height="15"><use href="#profile-icon" /></svg>
          About
        </div>
        <div className="about-row">
          <span className="about-row-label">Name</span>
          <span className="about-row-value">{username || "—"}</span>
        </div>
        <div className="about-row">
          <span className="about-row-label">Phone</span>
          <span className="about-row-value">{phoneNumber || "—"}</span>
        </div>
        <div className="about-row">
          <span className="about-row-label">Status</span>
          <span className="about-row-value">{connected ? "Active" : "Offline"}</span>
        </div>
      </div>
    </div>
  );
}
