import { useEffect, useMemo, useState } from "react";

function initials(name) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

function avatarSrc(serverUrl, url) {
  if (!url) return null;
  return url.startsWith("http") ? url : `${serverUrl}${url}`;
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

const PAGE_SIZES = [10, 25, 50];

// Admin-only: lists every registered account and how it's currently connected
// (online/offline, transport, IP, session count). Deliberately shows nothing
// about conversations or message content — that stays private.
// `onLogout`/`adminEmail` are optional — when embedded inside the chat app they're
// omitted and the panel just renders as a normal in-app section.
export default function AdminPage({ serverUrl, token, adminEmail, onLogout, mediaSrc, standalone = false }) {
  const [users, setUsers] = useState(null);
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | online | offline | suspended
  const [sortBy, setSortBy] = useState("active"); // active | name | newest
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const resolveAvatar = mediaSrc || ((url) => avatarSrc(serverUrl, url));

  async function runAction(userId, path, method = "POST") {
    setActionError("");
    setBusyId(userId);
    try {
      const res = await fetch(`${serverUrl}/api/admin/users/${userId}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        if (onLogout) onLogout("Your admin session expired. Please log in again.");
        else setActionError("You don't have admin access.");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Action failed");
      await load();
    } catch (err) {
      setActionError(err.message || "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  function handleSuspend(u) {
    runAction(u.id, "/suspend");
  }

  function handleApprove(u) {
    runAction(u.id, "/approve");
  }

  function handleDelete(u) {
    if (!window.confirm(`Permanently delete ${u.username}'s account? This can't be undone.`)) return;
    runAction(u.id, "", "DELETE");
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${serverUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        if (onLogout) onLogout("Your admin session expired. Please log in again.");
        else setError("You don't have admin access.");
        return;
      }
      if (!res.ok) throw new Error("Failed to load users");
      setUsers(await res.json());

      const groupsRes = await fetch(`${serverUrl}/api/admin/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (groupsRes.ok) setGroups(await groupsRes.json());
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

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, sortBy, pageSize]);

  const allUsers = users || [];
  const onlineCount = allUsers.filter((u) => u.online).length;
  const suspendedCount = allUsers.filter((u) => u.status === "suspended").length;
  const activeSessions = allUsers.reduce((sum, u) => sum + (u.sessionCount || 0), 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = allUsers.filter((u) => {
      const matchesQuery = !q || u.username.toLowerCase().includes(q) || u.phoneNumber.includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "online" && u.online) ||
        (statusFilter === "offline" && !u.online && u.status !== "suspended") ||
        (statusFilter === "suspended" && u.status === "suspended");
      return matchesQuery && matchesStatus;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.username.localeCompare(b.username);
      if (sortBy === "newest") return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      // "active": online users first, then by most-recent last-seen
      if (a.online !== b.online) return a.online ? -1 : 1;
      return new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0);
    });
    return list;
  }, [allUsers, query, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className={"admin-page adminx" + (standalone ? " admin-page-standalone" : "")}>
      <div className="adminx-header">
        <div>
          <h2 className="adminx-title">
            <span className="adminx-title-dim">Admin</span> / Users
          </h2>
          <div className="adminx-subtitle">Manage and monitor all registered users</div>
        </div>
        <div className="adminx-header-actions">
          {adminEmail && <span className="admin-topbar-email">{adminEmail}</span>}
          <button type="button" className="adminx-refresh-btn" onClick={load} disabled={loading}>
            <svg className="icon" width="15" height="15"><use href="#refresh-icon" /></svg>
            Refresh
          </button>
          {onLogout && (
            <button type="button" onClick={() => onLogout()} className="admin-logout-btn">
              Log out
            </button>
          )}
        </div>
      </div>

      {users && (
        <div className="adminx-stats">
          <div className="adminx-stat-card adminx-stat-purple">
            <span className="adminx-stat-icon">
              <svg className="icon" width="20" height="20"><use href="#contacts-icon" /></svg>
            </span>
            <div className="adminx-stat-label">Total Users</div>
            <div className="adminx-stat-num">{allUsers.length}</div>
            <div className="adminx-stat-sub">All registered users</div>
          </div>
          <div className="adminx-stat-card adminx-stat-green">
            <span className="adminx-stat-icon">
              <svg className="icon" width="20" height="20"><use href="#admin-icon" /></svg>
            </span>
            <div className="adminx-stat-label">Online Now</div>
            <div className="adminx-stat-num">{onlineCount}</div>
            <div className="adminx-stat-sub">Active right now</div>
          </div>
          <div className="adminx-stat-card adminx-stat-blue">
            <span className="adminx-stat-icon">
              <svg className="icon" width="20" height="20"><use href="#laptop-icon" /></svg>
            </span>
            <div className="adminx-stat-label">Active Sessions</div>
            <div className="adminx-stat-num">{activeSessions}</div>
            <div className="adminx-stat-sub">Across all users</div>
          </div>
          <div className="adminx-stat-card adminx-stat-orange">
            <span className="adminx-stat-icon">
              <svg className="icon" width="20" height="20"><use href="#shield-icon" /></svg>
            </span>
            <div className="adminx-stat-label">Suspended</div>
            <div className="adminx-stat-num">{suspendedCount}</div>
            <div className="adminx-stat-sub">Suspended accounts</div>
          </div>
          <div className="adminx-stat-card adminx-stat-purple">
            <span className="adminx-stat-icon">
              <svg className="icon" width="20" height="20"><use href="#groups-icon" /></svg>
            </span>
            <div className="adminx-stat-label">Total Groups</div>
            <div className="adminx-stat-num">{groups ? groups.length : "—"}</div>
            <div className="adminx-stat-sub">All group chats</div>
          </div>
        </div>
      )}

      <div className="adminx-toolbar">
        <div className="panel-search adminx-search">
          <svg className="icon" width="16" height="16"><use href="#search-icon" /></svg>
          <input
            placeholder="Search by name or phone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="adminx-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="suspended">Suspended</option>
        </select>
        <label className="adminx-sort">
          Sort by
          <select className="adminx-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="active">Recently Active</option>
            <option value="name">Name</option>
            <option value="newest">Newest</option>
          </select>
        </label>
      </div>

      {users && (
        <div className="admin-summary">
          {filtered.length} user{filtered.length === 1 ? "" : "s"} total
          {statusFilter === "all" && query.trim() === "" ? "" : ` (of ${allUsers.length})`}
          {" · "}
          <span className="adminx-online-dot-label">{onlineCount} online now</span>
        </div>
      )}

      <div className="list-page-body adminx-body">
        {actionError && <div className="list-page-empty admin-error">{actionError}</div>}
        {error && <div className="list-page-empty admin-error">{error}</div>}
        {!error && loading && !users && <div className="list-page-empty">Loading users…</div>}
        {!error && users && filtered.length === 0 && (
          <div className="list-page-empty">No users match your search.</div>
        )}

        {!error && users && filtered.length > 0 && (
          <div className="adminx-table">
            <div className="adminx-row adminx-row-head">
              <span>User</span>
              <span>Status</span>
              <span>Last Active</span>
              <span>Sessions</span>
              <span className="adminx-col-actions">Actions</span>
            </div>

            {pageRows.map((u) => (
              <div key={u.id} className="adminx-row">
                <div className="adminx-user-cell">
                  <span className="avatar admin-avatar adminx-avatar">
                    {u.avatarUrl ? <img src={resolveAvatar(u.avatarUrl)} alt="" /> : initials(u.username)}
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
                </div>

                <div className="adminx-status-cell">
                  {u.status === "suspended" ? (
                    <span className="admin-status-pill admin-status-suspended">Suspended</span>
                  ) : u.online ? (
                    <span className="admin-status-pill admin-status-online">Online</span>
                  ) : (
                    <span className="admin-status-pill admin-status-offline">Offline</span>
                  )}
                  <div className="adminx-status-meta">
                    {u.sessionCount} session{u.sessionCount === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="adminx-lastactive-cell">
                  <div>{u.online ? "Active now" : timeAgo(u.lastSeen)}</div>
                  {u.sessions[0]?.ip && <div className="adminx-lastactive-sub">via {u.sessions[0].ip}</div>}
                </div>

                <div className="adminx-sessions-cell">
                  <svg className="icon" width="15" height="15"><use href="#laptop-icon" /></svg>
                  {u.sessionCount}
                </div>

                <div className="adminx-actions-cell">
                  {u.status === "suspended" ? (
                    <button
                      type="button"
                      className="adminx-icon-btn adminx-icon-approve"
                      title="Approve account"
                      disabled={busyId === u.id}
                      onClick={() => handleApprove(u)}
                    >
                      <svg className="icon" width="15" height="15"><use href="#shield-icon" /></svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="adminx-icon-btn adminx-icon-suspend"
                      title="Suspend account"
                      disabled={busyId === u.id}
                      onClick={() => handleSuspend(u)}
                    >
                      <svg className="icon" width="15" height="15"><use href="#ban-icon" /></svg>
                    </button>
                  )}
                  <button
                    type="button"
                    className="adminx-icon-btn adminx-icon-delete"
                    title="Delete account"
                    disabled={busyId === u.id}
                    onClick={() => handleDelete(u)}
                  >
                    <svg className="icon" width="15" height="15"><use href="#delete-trash-icon" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {users && filtered.length > 0 && (
        <div className="adminx-footer">
          <label className="adminx-sort">
            <select
              className="adminx-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
          </label>
          <div className="adminx-pagination">
            <button
              type="button"
              className="adminx-page-btn"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>
            <span className="adminx-page-current">{safePage}</span>
            <button
              type="button"
              className="adminx-page-btn"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              ›
            </button>
          </div>
          <div className="adminx-page-of">
            Page {safePage} of {totalPages}
          </div>
        </div>
      )}

      <div className="adminx-header" style={{ marginTop: 32 }}>
        <div>
          <h2 className="adminx-title">
            <span className="adminx-title-dim">Admin</span> / Groups
          </h2>
          <div className="adminx-subtitle">All group chats currently on the platform</div>
        </div>
      </div>

      {groups && (
        <div className="admin-summary">
          {groups.length} group{groups.length === 1 ? "" : "s"} total
        </div>
      )}

      <div className="list-page-body adminx-body">
        {!error && groups === null && <div className="list-page-empty">Loading groups…</div>}
        {!error && groups && groups.length === 0 && (
          <div className="list-page-empty">No groups yet.</div>
        )}

        {!error && groups && groups.length > 0 && (
          <div className="adminx-table">
            <div className="adminx-row adminx-row-head">
              <span>Group</span>
              <span>Created By</span>
              <span>Members</span>
              <span>Created</span>
            </div>

            {groups.map((g) => (
              <div key={g.id} className="adminx-row">
                <div className="adminx-user-cell">
                  <span className="avatar admin-avatar adminx-avatar">
                    {g.avatarUrl ? <img src={resolveAvatar(g.avatarUrl)} alt="" /> : initials(g.name)}
                  </span>
                  <div className="admin-row-main">
                    <div className="admin-row-name">{g.name || "Unnamed group"}</div>
                  </div>
                </div>
                <div className="adminx-status-cell">{g.createdBy || "—"}</div>
                <div className="adminx-sessions-cell">
                  <svg className="icon" width="15" height="15"><use href="#groups-icon" /></svg>
                  {g.memberCount}
                </div>
                <div className="adminx-lastactive-cell">
                  <div>{timeAgo(g.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}