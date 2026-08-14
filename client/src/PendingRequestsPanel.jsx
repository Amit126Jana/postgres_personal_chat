import { useEffect, useState } from "react";

function initials(name) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

export default function PendingRequestsPanel({ serverUrl, token, mediaSrc, onClose, onAccepted, pushToast }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const resolveMedia = mediaSrc || ((url) => url);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className="page-panel pending-requests-panel">
      <div className="page-panel-head">
        <h2>Pending Requests</h2>
        {onClose && (
          <button type="button" className="icon-btn" onClick={onClose} title="Close">
            ✕
          </button>
        )}
      </div>

      {error && <div className="settings-hint" style={{ padding: "0 16px" }}>{error}</div>}

      {items === null ? (
        <div className="empty-state">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No pending chat requests.</div>
      ) : (
        <div className="request-list">
          {items.map((r) => (
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
                {r.requesterTagline && <span className="request-tagline">{r.requesterTagline}</span>}
              </div>
              <div className="request-actions">
                <button
                  type="button"
                  className="request-btn accept"
                  disabled={busyId === r.id}
                  onClick={() => respond(r.id, "accept")}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="request-btn reject"
                  disabled={busyId === r.id}
                  onClick={() => respond(r.id, "reject")}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="request-btn block"
                  disabled={busyId === r.id}
                  onClick={() => respond(r.id, "block")}
                >
                  Block
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
