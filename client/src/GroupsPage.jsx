import { useState } from "react";

export default function GroupsPage({ groups, onOpenGroup, onNewGroup, mediaSrc }) {
  const [query, setQuery] = useState("");
  const filtered = groups.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="groups-page">
      <div className="panel-header">
        <h2>Groups</h2>
        <button type="button" onClick={onNewGroup} title="New group" aria-label="New group">
          <svg className="icon" width="16" height="16"><use href="#plus-icon" /></svg>
        </button>
      </div>

      <div className="panel-search">
        <svg className="icon" width="16" height="16"><use href="#search-icon" /></svg>
        <input
          placeholder="Search groups..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="list-page-body">
        {filtered.length === 0 && (
          <div className="list-page-empty">
            {groups.length === 0 ? "No groups yet — start one." : "No groups match your search."}
          </div>
        )}
        {filtered.map((g) => (
          <div key={g.id} className="group-row" onClick={() => onOpenGroup(g.id)}>
            <span className="avatar">
              {g.avatarUrl ? <img src={mediaSrc ? mediaSrc(g.avatarUrl) : g.avatarUrl} alt="" /> : "👥"}
            </span>
            <div>
              <div className="group-row-name">{g.name}</div>
              <div className="group-row-sub">{g.members?.length || 0} members</div>
            </div>
            <span className="group-badge">group</span>
          </div>
        ))}
      </div>
    </div>
  );
}