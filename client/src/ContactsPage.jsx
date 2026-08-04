import { useState } from "react";

export default function ContactsPage({ contacts, onOpenContact, onCall, onNewChat, mediaSrc }) {
  const [query, setQuery] = useState("");

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const grouped = filtered
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .reduce((acc, c) => {
      const letter = (c.name[0] || "#").toUpperCase();
      (acc[letter] ||= []).push(c);
      return acc;
    }, {});

  const letters = Object.keys(grouped).sort();

  return (
    <div className="contacts-page">
      <div className="panel-header">
        <h2>Contacts</h2>
        <button type="button" onClick={onNewChat} title="Start a chat" aria-label="Start a chat">
          <svg className="icon" width="16" height="16"><use href="#plus-icon" /></svg>
        </button>
      </div>

      <div className="panel-search">
        <svg className="icon" width="16" height="16"><use href="#search-icon" /></svg>
        <input
          placeholder="Search users..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="list-page-body">
        {letters.length === 0 && (
          <div className="list-page-empty">
            {contacts.length === 0 ? "No conversations yet — start one." : "No contacts match your search."}
          </div>
        )}
        {letters.map((letter) => (
          <div key={letter}>
            <div className="contact-letter">{letter}</div>
            {grouped[letter].map((c) => (
              <div key={c.id} className="contact-row" onClick={() => onOpenContact(c.id)}>
                <span className="avatar">
                  {c.avatarUrl ? (
                    <img src={mediaSrc ? mediaSrc(c.avatarUrl) : c.avatarUrl} alt="" />
                  ) : (
                    c.name.trim().slice(0, 2).toUpperCase()
                  )}
                </span>
                <div>
                  <div className="contact-row-name">{c.name}</div>
                  {c.online && <div className="contact-row-sub">Active now</div>}
                </div>
                {c.otherId && (
                  <button
                    type="button"
                    className="contact-menu-btn"
                    title={`Call ${c.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCall(c.otherId, c.name);
                    }}
                  >
                    <svg className="icon" width="16" height="16"><use href="#phone-icon" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}