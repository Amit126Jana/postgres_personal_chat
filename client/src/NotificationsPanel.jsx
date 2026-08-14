import { useEffect, useState } from "react";

function initials(name) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function describe(n) {
  switch (n.type) {
    case "chat_request":
      return `${n.fromUsername || "Someone"} sent you a chat request`;
    case "chat_request_accepted":
      return `${n.fromUsername || "Someone"} accepted your chat request`;
    default:
      return n.type;
  }
}

export default function NotificationsPanel({ serverUrl, token, mediaSrc, onClose, onOpenRequests }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const resolveMedia = mediaSrc || ((url) => url);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setError("");
    try {
      const res = await fetch(`${serverUrl}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setError("Couldn't load notifications.");
      setItems([]);
    }
  }

  async function markAllRead() {
    try {
      await fetch(`${serverUrl}/api/notifications/read-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems((prev) => (prev || []).map((n) => ({ ...n, read: true })));
    } catch {
      /* best effort */
    }
  }

  async function markOneRead(id) {
    setItems((prev) => (prev || []).map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await fetch(`${serverUrl}/api/notifications/${id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* best effort */
    }
  }

  return (
    <div className="page-panel notifications-panel">
      <div className="page-panel-head">
        <h2>Notifications</h2>
        <div className="page-panel-head-actions">
          <button type="button" className="text-btn" onClick={markAllRead}>
            Mark all read
          </button>
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} title="Close">
              ✕
            </button>
          )}
        </div>
      </div>

      {error && <div className="settings-hint" style={{ padding: "0 16px" }}>{error}</div>}

      {items === null ? (
        <div className="empty-state">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">You're all caught up — no notifications yet.</div>
      ) : (
        <div className="notification-list">
          {items.map((n) => (
            <div
              key={n.id}
              className={"notification-row" + (n.read ? "" : " unread")}
              onClick={() => {
                if (!n.read) markOneRead(n.id);
                if (n.type === "chat_request" && onOpenRequests) onOpenRequests();
              }}
            >
              <div className="avatar avatar-sm">
                {n.fromAvatarUrl ? (
                  <img src={resolveMedia(n.fromAvatarUrl)} alt="" />
                ) : (
                  <span>{initials(n.fromUsername)}</span>
                )}
              </div>
              <div className="notification-body">
                <span className="notification-text">{describe(n)}</span>
                <span className="notification-time">{timeAgo(n.createdAt)}</span>
              </div>
              {!n.read && <span className="notification-dot" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
