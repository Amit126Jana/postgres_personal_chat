const GAME_LIST = [
  { type: "ttt", label: "Tic Tac Toe", icon: "❌⭕" },
  { type: "wordguess", label: "Word Guess", icon: "🔤" },
  { type: "truthdare", label: "Truth or Dare", icon: "🎲" },
  { type: "quiz", label: "Mini Quiz", icon: "❓" },
  { type: "chess", label: "Chess", icon: "♟️" },
  { type: "ludo", label: "Ludo", icon: "🟢" },
  { type: "uno", label: "UNO", icon: "🃏" },
];

export default function GamesMenu({ onPick, onClose, onViewHistory }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          ✕
        </button>
        <h3 style={{ margin: "0 0 14px" }}>Play a game together</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          {GAME_LIST.map((g) => (
            <button
              key={g.type}
              type="button"
              onClick={() => onPick(g.type)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                padding: "16px 8px",
                borderRadius: "12px",
                border: "1px solid var(--line)",
                background: "var(--surface-2)",
                color: "var(--text)",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: "24px" }}>{g.icon}</span>
              {g.label}
            </button>
          ))}
        </div>
        {onViewHistory && (
          <button
            type="button"
            onClick={onViewHistory}
            style={{ width: "100%", marginTop: "14px", padding: "10px", borderRadius: "10px" }}
          >
            📜 View past results
          </button>
        )}
      </div>
    </div>
  );
}

export { GAME_LIST };
