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

function handleOf(name) {
  return "@" + (name || "user").trim().toLowerCase().replace(/\s+/g, "");
}

export default function PendingRequestsPanel({ serverUrl, token, mediaSrc, onClose, onAccepted, pushToast }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [sortOldest, setSortOldest] = useState(false);
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
      const res = await fetch(`${serverUrl}/api/chat-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setItems(await res.json());
    } catch {
      setError("Couldn't load requests.");
      setItems([]);
    }
  }

  async function respond(id, action) {
    setBusyId(id);
    try {
      const res = await fetch(`${serverUrl}/api/chat-requests/${id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setItems((prev) => (prev || []).filter((r) => r.id !== id));
      if (action === "accept") {
        pushToast?.("Request accepted", "You can now chat with each other.");
        onAccepted?.(data.conversationId);
      } else if (action === "reject") {
        pushToast?.("Request declined", "");
      } else if (action === "block") {
        pushToast?.("User blocked", "They can no longer message or request to chat with you.");
      }
    } catch (err) {
      pushToast?.("Couldn't complete action", err.message || "Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  const sorted = useMemo(() => {
    const list = [...(items || [])];
    list.sort((a, b) => {
      const diff = new Date(a.createdAt) - new Date(b.createdAt);
      return sortOldest ? diff : -diff;
    });
    return list;
  }, [items, sortOldest]);

  const count = items?.length || 0;

  return (
    <div className="page-panel pending-requests-panel">
      <button type="button" className="mobile-back-btn" onClick={onClose} aria-label="Back">
        ←
      </button>

      <div className="page-panel-card">
        <div className="page-panel-head">
          <div className="page-panel-head-title">
            <h2>Pending Requests</h2>
            <p>Review and respond to your pending requests</p>
          </div>
          <div className="page-panel-head-actions">
            {count > 0 && (
              <span className="request-count-pill">
                {count} request{count === 1 ? "" : "s"}
              </span>
            )}
            <div className="filter-menu" ref={filterRef}>
              <button
                type="button"
                className={"icon-btn" + (sortOldest ? " active" : "")}
                onClick={() => setFilterOpen((v) => !v)}
                title="Sort"
                aria-label="Sort requests"
              >
                <svg className="icon" width="16" height="16">
                  <use href="#filter-icon" />
                </svg>
              </button>
              {filterOpen && (
                <div className="filter-dropdown">
                  <button
                    type="button"
                    className={"filter-option" + (!sortOldest ? " selected" : "")}
                    onClick={() => {
                      setSortOldest(false);
                      setFilterOpen(false);
                    }}
                  >
                    Newest first
                  </button>
                  <button
                    type="button"
                    className={"filter-option" + (sortOldest ? " selected" : "")}
                    onClick={() => {
                      setSortOldest(true);
                      setFilterOpen(false);
                    }}
                  >
                    Oldest first
                  </button>
                </div>
              )}
            </div>
            {onClose && (
              <button type="button" className="icon-btn desktop-only-btn" onClick={onClose} title="Close">
                ✕
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="settings-hint" style={{ padding: "0 24px" }}>
            {error}
          </div>
        )}

        {items === null ? (
          <div className="empty-state">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="empty-state">No pending chat requests.</div>
        ) : (
          <div className="request-list">
            {sorted.map((r) => (
              <div key={r.id} className="request-row">
                <div className="avatar avatar-sm">
                  {r.requesterAvatarUrl ? (
                    <img src={resolveMedia(r.requesterAvatarUrl)} alt="" />
                  ) : (
                    <span>{initials(r.requesterUsername)}</span>
                  )}
                </div>
                <div className="request-info">
                  <span className="request-name">{r.requesterUsername}</span>
                  <span className="request-handle">{handleOf(r.requesterUsername)}</span>
                  {r.requesterTagline && <span className="request-tagline">{r.requesterTagline}</span>}
                  <span className="request-time">Requested {timeAgo(r.createdAt)}</span>
                </div>
                <div className="request-actions">
                  <button
                    type="button"
                    className="request-btn accept"
                    disabled={busyId === r.id}
                    onClick={() => respond(r.id, "accept")}
                  >
                    <svg className="icon" width="14" height="14">
                      <use href="#check-icon" />
                    </svg>
                    Accept
                  </button>
                  <button
                    type="button"
                    className="request-btn reject"
                    disabled={busyId === r.id}
                    onClick={() => respond(r.id, "reject")}
                  >
                    <svg className="icon" width="14" height="14">
                      <use href="#delete-trash-icon" />
                    </svg>
                    Delete
                  </button>
                  <button
                    type="button"
                    className="request-btn block"
                    disabled={busyId === r.id}
                    onClick={() => respond(r.id, "block")}
                  >
                    <svg className="icon" width="14" height="14">
                      <use href="#ban-icon" />
                    </svg>
                    Block
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
