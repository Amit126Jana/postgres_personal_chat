import { useEffect, useState } from "react";

function initials(name) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

function timeAgo(ts) {
  if (!ts) return "never";
  const diffMs = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Admin-only: lists every registered account and how it's currently connected
// (online/offline, transport, IP, session count). Deliberately shows nothing
// about conversations or message content — that stays private.
export default function AdminPage({ serverUrl, token, mediaSrc }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${serverUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) {
        setError("Your account doesn't have admin access.");
        setUsers([]);
        return;
      }
      if (!res.ok) throw new Error("Failed to load users");
      setUsers(await res.json());
    } catch (err) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000); // keep online status live
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl, token]);

  const filtered = (users || []).filter(
    (u) =>
      u.username.toLowerCase().includes(query.trim().toLowerCase()) ||
      u.phoneNumber.includes(query.trim())
  );
  const onlineCount = (users || []).filter((u) => u.online).length;

  return (
    <div className="admin-page">
      <div className="panel-header">
        <h2>Admin — Users</h2>
        <button type="button" onClick={load} title="Refresh" aria-label="Refresh">
          <svg className="icon" width="16" height="16">
            <use href="#refresh-icon" />
          </svg>
        </button>
      </div>

      <div className="panel-search">
        <svg className="icon" width="16" height="16">
          <use href="#search-icon" />
        </svg>
        <input
          placeholder="Search by name or phone..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {users && (
        <div className="admin-summary">
          {users.length} users total · {onlineCount} online now
        </div>
      )}

      <div className="list-page-body">
        {error && <div className="list-page-empty admin-error">{error}</div>}
        {!error && loading && !users && <div className="list-page-empty">Loading users…</div>}
        {!error && users && filtered.length === 0 && (
          <div className="list-page-empty">No users match your search.</div>
        )}
        {!error &&
          filtered.map((u) => (
            <div key={u.id} className="admin-row">
              <span className="avatar admin-avatar">
                {u.avatarUrl ? (
                  <img src={mediaSrc ? mediaSrc(u.avatarUrl) : u.avatarUrl} alt="" />
                ) : (
                  initials(u.username)
                )}
                <span className={"admin-dot" + (u.online ? " admin-dot-online" : "")} />
              </span>
              <div className="admin-row-main">
                <div className="admin-row-name">
                  {u.username}
                  {u.isAdmin && <span className="admin-badge">Admin</span>}
                </div>
                <div className="admin-row-sub">{u.phoneNumber}</div>
                {u.tagline && <div className="admin-row-tagline">{u.tagline}</div>}
              </div>
              <div className="admin-row-status">
                {u.online ? (
                  <>
                    <span className="admin-status-pill admin-status-online">
                      Online · {u.sessionCount} session{u.sessionCount > 1 ? "s" : ""}
                    </span>
                    {u.sessions[0] && (
                      <div className="admin-row-meta">
                        via {u.sessions[0].transport || "unknown"}
                        {u.sessions[0].ip ? ` · ${u.sessions[0].ip}` : ""}
                        {u.sessions[0].connectedAt
                          ? ` · connected ${timeAgo(u.sessions[0].connectedAt)}`
                          : ""}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <span className="admin-status-pill admin-status-offline">Offline</span>
                    <div className="admin-row-meta">last seen {timeAgo(u.lastSeen)}</div>
                  </>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
