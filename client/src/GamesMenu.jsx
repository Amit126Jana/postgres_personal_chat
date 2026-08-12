const GAME_LIST = [
  { type: "ttt", label: "Tic Tac Toe", icon: "❌⭕", tint: "#ff5470" },
  { type: "wordguess", label: "Word Guess", icon: "🔤", tint: "#7c5cff" },
  { type: "truthdare", label: "Truth or Dare", icon: "🎲", tint: "#ffffff" },
  { type: "quiz", label: "Mini Quiz", icon: "❓", tint: "#ff3b6b" },
  { type: "chess", label: "Chess", icon: "♟️", tint: "#7c5cff" },
  { type: "ludo", label: "Ludo", icon: "🎯", tint: "#e6483c" },
  { type: "uno", label: "UNO", icon: "🃏", tint: "#ff3b6b" },
];

export default function GamesMenu({ onPick, onClose, onViewHistory }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card games-menu-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h3 className="games-menu-title">
          <span className="games-menu-title-icon">🎮</span> Play a game together
        </h3>

        <div className="games-menu-grid">
          {GAME_LIST.map((g) => (
            <button key={g.type} type="button" className="games-menu-tile" onClick={() => onPick(g.type)}>
              <span className="games-menu-tile-icon">{g.icon}</span>
              <span className="games-menu-tile-label">{g.label}</span>
            </button>
          ))}
        </div>

        {onViewHistory && (
          <button type="button" className="games-menu-history-btn" onClick={onViewHistory}>
            <span aria-hidden="true">🕓</span> View past results
          </button>
        )}
      </div>
    </div>
  );
}

export { GAME_LIST };