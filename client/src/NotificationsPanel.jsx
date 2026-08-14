import { useEffect, useMemo, useRef, useState } from "react";

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
    case "group_added":
      return `${n.fromUsername || "Someone"} added you to the group "${n.data?.groupName || "a group"}"`;
    case "mention":
      return `${n.fromUsername || "Someone"} mentioned you`;
    case "system":
      return n.data?.message || "MakeFriends update";
    default:
      return n.type;
  }
}

// Buckets every notification type into one of the four tabs so the filter is
// real (not decorative) even though the server currently only emits the
// chat_request* types — new types added later slot in automatically.
function categoryOf(n) {
  if (n.type === "chat_request" || n.type === "chat_request_accepted") return "requests";
  if (n.type === "mention") return "mentions";
  if (n.type === "message") return "messages";
  return "system";
}

function iconFor(n) {
  const cat = categoryOf(n);
  if (cat === "requests") return { symbol: "chat-icon", cls: "type-requests" };
  if (cat === "mentions") return { symbol: "mention-icon", cls: "type-mentions" };
  if (n.type === "group_added") return { symbol: "groups-icon", cls: "type-groups" };
  if (n.data?.trophy) return { symbol: "trophy-icon", cls: "type-trophy" };
  if (cat === "system") return { symbol: "megaphone-icon", cls: "type-system" };
  return { symbol: "chat-icon", cls: "type-requests" };
}

const TABS = [
  { key: "all", label: "All", icon: null },
  { key: "messages", label: "Messages", icon: "chat-icon" },
  { key: "requests", label: "Requests", icon: "contacts-icon" },
  { key: "mentions", label: "Mentions", icon: "mention-icon" },
  { key: "system", label: "System", icon: "settings-icon" },
];

export default function NotificationsPanel({
  serverUrl,
  token,
  mediaSrc,
  onClose,
  onOpenRequests,
  onOpenSettings,
  onUnreadChange,
}) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const resolveMedia = mediaSrc || ((url) => url);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onDocClick(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
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
      if (typeof data.unread === "number") onUnreadChange?.(data.unread);
    } catch {
      setError("Couldn't load notifications.");
      setItems([]);
    }
  }

  async function markAllRead() {
    setItems((prev) => (prev || []).map((n) => ({ ...n, read: true })));
    onUnreadChange?.(0);
    try {
      await fetch(`${serverUrl}/api/notifications/read-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* best effort */
    }
  }

  async function markOneRead(id) {
    setItems((prev) => (prev || []).map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      const res = await fetch(`${serverUrl}/api/notifications/${id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.unread === "number") onUnreadChange?.(data.unread);
    } catch {
      /* best effort */
    }
  }

  const counts = useMemo(() => {
    const c = { all: 0, messages: 0, requests: 0, mentions: 0, system: 0 };
    for (const n of items || []) {
      c.all += 1;
      c[categoryOf(n)] += 1;
    }
    return c;
  }, [items]);

  const visible = useMemo(() => {
    return (items || [])
      .filter((n) => (tab === "all" ? true : categoryOf(n) === tab))
      .filter((n) => (unreadOnly ? !n.read : true));
  }, [items, tab, unreadOnly]);

  const unreadTotal = (items || []).filter((n) => !n.read).length;

  return (
    <div className="page-panel notifications-panel">
      <button type="button" className="mobile-back-btn" onClick={onClose} aria-label="Back">
        ←
      </button>

      <div className="page-panel-card">
        <div className="page-panel-head">
          <div className="page-panel-head-title">
            <h2>Notifications</h2>
            <p>Stay updated with your latest activity</p>
          </div>
          <div className="page-panel-head-actions">
            <button type="button" className="text-btn" onClick={markAllRead} disabled={unreadTotal === 0}>
              Mark all read
            </button>
            <div className="filter-menu" ref={filterRef}>
              <button
                type="button"
                className={"icon-btn" + (unreadOnly ? " active" : "")}
                onClick={() => setFilterOpen((v) => !v)}
                title="Filter"
                aria-label="Filter notifications"
              >
                <svg className="icon" width="16" height="16">
                  <use href="#filter-icon" />
                </svg>
              </button>
              {filterOpen && (
                <div className="filter-dropdown">
                  <button
                    type="button"
                    className={"filter-option" + (!unreadOnly ? " selected" : "")}
                    onClick={() => {
                      setUnreadOnly(false);
                      setFilterOpen(false);
                    }}
                  >
                    All notifications
                  </button>
                  <button
                    type="button"
                    className={"filter-option" + (unreadOnly ? " selected" : "")}
                    onClick={() => {
                      setUnreadOnly(true);
                      setFilterOpen(false);
                    }}
                  >
                    Unread only
                  </button>
                </div>
              )}
            </div>
            {onOpenSettings && (
              <button type="button" className="icon-btn" onClick={onOpenSettings} title="Settings">
                <svg className="icon" width="16" height="16">
                  <use href="#settings-icon" />
                </svg>
              </button>
            )}
            {onClose && (
              <button type="button" className="icon-btn desktop-only-btn" onClick={onClose} title="Close">
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="notif-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={"notif-tab" + (tab === t.key ? " active" : "")}
              onClick={() => setTab(t.key)}
            >
              {t.icon && (
                <svg className="icon" width="14" height="14">
                  <use href={`#${t.icon}`} />
                </svg>
              )}
              {t.label}
              {counts[t.key] > 0 && t.key !== "all" && <span className="notif-tab-count">{counts[t.key]}</span>}
            </button>
          ))}
        </div>

        {error && (
          <div className="settings-hint" style={{ padding: "0 24px" }}>
            {error}
          </div>
        )}

        {items === null ? (
          <div className="empty-state">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            {unreadOnly
              ? "No unread notifications here."
              : tab === "all"
              ? "You're all caught up — no notifications yet."
              : `No ${TABS.find((t) => t.key === tab)?.label.toLowerCase()} notifications yet.`}
          </div>
        ) : (
          <div className="notification-list">
            {visible.map((n) => {
              const icon = iconFor(n);
              return (
                <div
                  key={n.id}
                  className={"notification-row" + (n.read ? "" : " unread")}
                  onClick={() => {
                    if (!n.read) markOneRead(n.id);
                    if ((n.type === "chat_request" || n.type === "chat_request_accepted") && onOpenRequests)
                      onOpenRequests();
                  }}
                >
                  <div className="avatar avatar-sm">
                    {n.fromAvatarUrl ? (
                      <img src={resolveMedia(n.fromAvatarUrl)} alt="" />
                    ) : (
                      <span>{initials(n.fromUsername)}</span>
                    )}
                  </div>
                  <span className={"notif-type-badge " + icon.cls}>
                    <svg className="icon" width="13" height="13">
                      <use href={`#${icon.symbol}`} />
                    </svg>
                  </span>
                  <div className="notification-body">
                    <span className="notification-text">{describe(n)}</span>
                    <span className="notification-time">{timeAgo(n.createdAt)}</span>
                  </div>
                  {!n.read && <span className="notification-dot" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
