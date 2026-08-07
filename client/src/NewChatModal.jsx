import { useEffect, useMemo, useState } from "react";

export default function NewChatModal({ serverUrl, token, myUserId, onStartDirect, onStartGroup, onClose, initialMode }) {
  const [mode, setMode] = useState(initialMode === "group" ? "group" : "direct"); // "direct" | "group"
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const MAX_MEMBERS = 100;

  useEffect(() => {
    let cancelled = false;
    fetch(`${serverUrl}/api/users`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((list) => {
        if (cancelled) return;
        // The server returns an error object (not an array) if the token is missing/expired —
        // guard against that instead of crashing on .filter().
        if (!Array.isArray(list)) {
          console.error("Failed to load users:", list?.error || list);
          setUsers([]);
          return;
        }
        setUsers(list.filter((u) => u.id !== myUserId));
      })
      .catch((err) => console.error("Failed to load users", err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [serverUrl, token, myUserId]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.username.toLowerCase().includes(q));
  }, [users, search]);

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_MEMBERS) return prev;
      return [...prev, id];
    });
  }

  function handleCreateGroup(e) {
    e.preventDefault();
    if (!groupName.trim() || selectedIds.length === 0) return;
    onStartGroup(groupName.trim(), selectedIds);
  }

  return (
    <div className="np-backdrop" onClick={onClose}>
      <div className="np-panel" onClick={(e) => e.stopPropagation()}>
        <div className="np-header">
          <div>
            <h2 className="np-title">{mode === "group" ? "New Group" : "New Chat"}</h2>
            <p className="np-subtitle">
              {mode === "group" ? "Create a group and start chatting" : "Start a private conversation"}
            </p>
          </div>
          <button type="button" className="np-close" onClick={onClose} aria-label="Close">
            <svg className="icon" width="16" height="16">
              <use href="#close-icon" />
            </svg>
          </button>
        </div>

        <div className="np-tabs">
          <button
            type="button"
            className={"np-tab" + (mode === "direct" ? " active" : "")}
            onClick={() => setMode("direct")}
          >
            Private chat
          </button>
          <button
            type="button"
            className={"np-tab" + (mode === "group" ? " active" : "")}
            onClick={() => setMode("group")}
          >
            New group
          </button>
        </div>

        <div className="np-body">
          {mode === "group" && (
            <>
              <div className="np-avatar-upload">
                <div className="np-avatar-circle">
                  <svg className="icon" width="28" height="28">
                    <use href="#camera-icon" />
                  </svg>
                </div>
                <span className="np-avatar-plus">+</span>
              </div>

              <label className="np-field-label" htmlFor="np-group-name">
                Group Name
              </label>
              <input
                id="np-group-name"
                className="np-input"
                placeholder="e.g. College Friends"
                maxLength={80}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
              />

              <label className="np-field-label" htmlFor="np-member-search">
                Add Members
              </label>
              <div className="np-search-wrap">
                <input
                  id="np-member-search"
                  className="np-input np-search-input"
                  placeholder="Search friends..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <svg className="icon np-search-icon" width="16" height="16">
                  <use href="#search-icon" />
                </svg>
              </div>
            </>
          )}

          {mode === "direct" && (
            <div className="np-search-wrap np-search-wrap-direct">
              <input
                className="np-input np-search-input"
                placeholder="Search people..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              <svg className="icon np-search-icon" width="16" height="16">
                <use href="#search-icon" />
              </svg>
            </div>
          )}

          {loading ? (
            <div className="np-empty">Loading people…</div>
          ) : filteredUsers.length === 0 ? (
            <div className="np-empty">
              {users.length === 0 ? "Nobody else has logged in yet." : "No matches found."}
            </div>
          ) : mode === "direct" ? (
            <ul className="np-user-list">
              {filteredUsers.map((u) => (
                <li key={u.id} className="np-user-row" onClick={() => onStartDirect(u.id)}>
                  <span className="avatar np-user-avatar">{u.username.slice(0, 2).toUpperCase()}</span>
                  <span className="np-user-info">
                    <span className="np-user-name">{u.username}</span>
                    <span className="np-user-handle">@{u.username.toLowerCase().replace(/\s+/g, "")}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="np-user-list np-user-list-checkable">
              {filteredUsers.map((u) => {
                const checked = selectedIds.includes(u.id);
                return (
                  <li
                    key={u.id}
                    className={"np-user-row" + (checked ? " checked" : "")}
                    onClick={() => toggleSelected(u.id)}
                  >
                    <span className="avatar np-user-avatar">{u.username.slice(0, 2).toUpperCase()}</span>
                    <span className="np-user-info">
                      <span className="np-user-name">{u.username}</span>
                      <span className="np-user-handle">@{u.username.toLowerCase().replace(/\s+/g, "")}</span>
                    </span>
                    <span className={"np-checkbox" + (checked ? " checked" : "")}>
                      {checked && (
                        <svg className="icon" width="12" height="12">
                          <use href="#check-single-icon" />
                        </svg>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {mode === "group" && (
          <form className="np-footer" onSubmit={handleCreateGroup}>
            <div className="np-member-count">
              {selectedIds.length} of {MAX_MEMBERS} members selected
            </div>
            <button type="submit" className="np-submit-btn" disabled={!groupName.trim() || selectedIds.length === 0}>
              Create Group
            </button>
          </form>
        )}
      </div>
    </div>
  );
}