import { useEffect, useState } from "react";

export default function NewChatModal({ serverUrl, token, myUserId, onStartDirect, onStartGroup, onClose, initialMode }) {
  const [mode, setMode] = useState(initialMode === "group" ? "group" : "direct"); // "direct" | "group"
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

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

  function toggleSelected(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleCreateGroup(e) {
    e.preventDefault();
    if (!groupName.trim() || selectedIds.length === 0) return;
    onStartGroup(groupName.trim(), selectedIds);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-tabs">
          <button
            type="button"
            className={"modal-tab" + (mode === "direct" ? " active" : "")}
            onClick={() => setMode("direct")}
          >
            Private chat
          </button>
          <button
            type="button"
            className={"modal-tab" + (mode === "group" ? " active" : "")}
            onClick={() => setMode("group")}
          >
            New group
          </button>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>

        {loading ? (
          <div className="modal-empty">Loading people…</div>
        ) : users.length === 0 ? (
          <div className="modal-empty">Nobody else has logged in yet.</div>
        ) : mode === "direct" ? (
          <ul className="modal-user-list">
            {users.map((u) => (
              <li key={u.id} className="modal-user-row" onClick={() => onStartDirect(u.id)}>
                <span className="avatar">{u.username.slice(0, 2).toUpperCase()}</span>
                <span>{u.username}</span>
              </li>
            ))}
          </ul>
        ) : (
          <form className="modal-group-form" onSubmit={handleCreateGroup}>
            <input
              placeholder="Group name"
              maxLength={80}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              autoFocus
            />
            <div className="modal-user-list scrollable">
              {users.map((u) => (
                <label key={u.id} className="modal-user-row modal-user-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(u.id)}
                    onChange={() => toggleSelected(u.id)}
                  />
                  <span className="avatar">{u.username.slice(0, 2).toUpperCase()}</span>
                  <span>{u.username}</span>
                </label>
              ))}
            </div>
            <button type="submit" disabled={!groupName.trim() || selectedIds.length === 0}>
              Create group ({selectedIds.length} selected)
            </button>
          </form>
        )}
      </div>
    </div>
  );
}