import { useEffect, useRef, useState } from "react";
import { GAME_LIST } from "./GamesMenu.jsx";

function _useLocalState(initial) {
  return useState(initial);
}

function gameLabel(type) {
  return GAME_LIST.find((g) => g.type === type)?.label || type;
}

// ---------- Tic Tac Toe ----------
function TicTacToe({ state, myIndex, onMove }) {
  const isMyTurn = state.turn === myIndex && state.status === "active";
  const mark = (v) => (v === 0 ? "❌" : v === 1 ? "⭕" : "");
  return (
    <div style={{ textAlign: "center" }}>
      <p className="game-status-line">
        {state.status === "active"
          ? isMyTurn
            ? "Your turn"
            : "Waiting for opponent…"
          : state.status === "draw"
            ? "It's a draw!"
            : state.winner === myIndex
              ? "You won! 🎉"
              : "You lost this round."}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 64px)",
          gridTemplateRows: "repeat(3, 64px)",
          gap: "6px",
          justifyContent: "center",
          margin: "12px auto",
        }}
      >
        {state.board.map((cell, i) => (
          <button
            key={i}
            type="button"
            disabled={!isMyTurn || cell !== null}
            onClick={() => onMove({ index: i })}
            style={{
              fontSize: "26px",
              borderRadius: "10px",
              border: "1px solid var(--line)",
              background: "var(--surface-2)",
              cursor: isMyTurn && cell === null ? "pointer" : "default",
            }}
          >
            {mark(cell)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Word Guess ----------
function WordGuess({ state, myIndex, onMove }) {
  const isMyTurn = state.turn === myIndex && state.status === "active";
  const [letter, setLetterInput] = _useLocalState("");
  const display = state.word
    .split("")
    .map((ch) => (state.guessed.includes(ch) ? ch : "_"))
    .join(" ");
  return (
    <div style={{ textAlign: "center" }}>
      <p className="game-status-line">
        {state.status === "won"
          ? "You guessed it together! 🎉"
          : state.status === "draw"
            ? `Out of lives — the word was ${state.word}`
            : isMyTurn
              ? "Your turn — guess a letter"
              : "Waiting for opponent's guess…"}
      </p>
      <div style={{ fontSize: "28px", letterSpacing: "6px", margin: "14px 0" }}>{display}</div>
      <div style={{ marginBottom: "10px" }}>❤️ Lives left: {state.livesLeft}</div>
      {state.wrong.length > 0 && (
        <div style={{ marginBottom: "10px", color: "var(--text-muted)" }}>
          Wrong guesses: {state.wrong.join(", ")}
        </div>
      )}
      {state.status === "active" && (
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <input
            maxLength={1}
            value={letter}
            disabled={!isMyTurn}
            onChange={(e) => setLetterInput(e.target.value.replace(/[^a-zA-Z]/g, ""))}
            style={{ width: "48px", textAlign: "center", fontSize: "18px" }}
          />
          <button
            type="button"
            disabled={!isMyTurn || !letter}
            onClick={() => {
              onMove({ letter });
              setLetterInput("");
            }}
          >
            Guess
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Truth or Dare ----------
function TruthOrDare({ state, myIndex, onMove }) {
  const isMyTurn = state.turn === myIndex && state.status === "active";
  return (
    <div style={{ textAlign: "center" }}>
      <p className="game-status-line">
        Round {state.round}/10 · {state.status === "draw" ? "Game complete!" : isMyTurn ? "Your turn" : "Opponent's turn"}
      </p>
      {state.status === "active" && state.awaitingChoice && (
        isMyTurn ? (
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", margin: "16px 0" }}>
            <button type="button" onClick={() => onMove({ choice: "truth" })}>
              🗣️ Truth
            </button>
            <button type="button" onClick={() => onMove({ choice: "dare" })}>
              🔥 Dare
            </button>
          </div>
        ) : (
          <p>Waiting for them to choose truth or dare…</p>
        )
      )}
      {state.status === "active" && !state.awaitingChoice && (
        <div style={{ margin: "16px 0" }}>
          <div
            style={{
              padding: "14px",
              borderRadius: "12px",
              background: "var(--surface-2)",
              fontWeight: 600,
              marginBottom: "12px",
            }}
          >
            {state.choice === "truth" ? "🗣️ Truth: " : "🔥 Dare: "}
            {state.prompt}
          </div>
          {isMyTurn && (
            <button type="button" onClick={() => onMove({ action: "done" })}>
              Done — next round
            </button>
          )}
          {!isMyTurn && <p>Waiting for them to finish…</p>}
        </div>
      )}
      {state.status === "draw" && <p>Thanks for playing! 🎉</p>}
    </div>
  );
}

// ---------- Mini Quiz ----------
function MiniQuiz({ state, myIndex, onMove }) {
  const current = state.questions[state.currentIndex];
  const alreadyAnswered = state.answeredThisRound?.[myIndex] !== undefined;
  return (
    <div style={{ textAlign: "center" }}>
      <p className="game-status-line">
        Question {Math.min(state.currentIndex + 1, state.questions.length)}/{state.questions.length} · Score {state.scores[myIndex]} - {state.scores[1 - myIndex]}
      </p>
      {state.status === "active" && current && (
        <>
          <div style={{ fontWeight: 600, margin: "14px 0" }}>{current.q}</div>
          <div style={{ display: "grid", gap: "8px" }}>
            {current.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                disabled={alreadyAnswered}
                onClick={() => onMove({ choice: i })}
                style={{
                  padding: "10px",
                  borderRadius: "10px",
                  border: "1px solid var(--line)",
                  background: alreadyAnswered && state.lastResult?.picks?.[myIndex] === i ? "var(--signal)" : "var(--surface-2)",
                  color: alreadyAnswered && state.lastResult?.picks?.[myIndex] === i ? "#fff" : "inherit",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
          {alreadyAnswered && <p style={{ marginTop: "10px" }}>Waiting for the other player…</p>}
        </>
      )}
      {state.status === "won" && (
        <p style={{ fontSize: "18px", fontWeight: 700 }}>
          {state.winner === "both" ? "It's a tie! 🤝" : state.winner === myIndex ? "You win! 🏆" : "You lost this round."}
        </p>
      )}
    </div>
  );
}

// ---------- Chess ----------
const CHESS_GLYPH = {
  w: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" },
  b: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" },
};
function Chess({ state, myIndex, onMove }) {
  const [selected, setSelected] = _useLocalState(null);
  const myColor = myIndex === 0 ? "w" : "b";
  const isMyTurn = state.turn === myIndex && state.status === "active";
  // flip board for black so each player sees their own pieces at the bottom
  const rows = myColor === "w" ? [...Array(8).keys()] : [...Array(8).keys()].reverse();
  const cols = myColor === "w" ? [...Array(8).keys()] : [...Array(8).keys()].reverse();

  function handleClick(r, c) {
    if (!isMyTurn) return;
    const cell = state.board[r][c];
    if (selected) {
      onMove({ from: selected, to: [r, c] });
      setSelected(null);
    } else if (cell && cell.color === myColor) {
      setSelected([r, c]);
    }
  }

  return (
    <div style={{ textAlign: "center" }}>
      <p className="game-status-line">
        {state.status === "won"
          ? state.winner === myIndex
            ? "Checkmate captured — you won! 🎉"
            : "Your king was captured — you lost."
          : isMyTurn
            ? "Your turn"
            : "Waiting for opponent…"}
      </p>
      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>
        Simplified rules: standard piece movement, no check/checkmate detection — capture the king to win.
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(8, 36px)",
          gridTemplateRows: "repeat(8, 36px)",
          margin: "0 auto",
          width: "fit-content",
          border: "1px solid var(--line)",
        }}
      >
        {rows.map((r) =>
          cols.map((c) => {
            const cell = state.board[r][c];
            const dark = (r + c) % 2 === 1;
            const isSelected = selected && selected[0] === r && selected[1] === c;
            return (
              <div
                key={`${r}-${c}`}
                onClick={() => handleClick(r, c)}
                style={{
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  background: isSelected ? "var(--signal)" : dark ? "#7a6350" : "#eadfce",
                  cursor: isMyTurn ? "pointer" : "default",
                }}
              >
                {cell ? CHESS_GLYPH[cell.color][cell.piece] : ""}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

// ---------- Ludo ----------
// Classic 15x15 cross-shaped board geometry. Ring path has 52 cells; player 0 (red) starts
// at ring index 0, player 1 (yellow) starts at ring index 26 — opposite corners, same as a
// real Ludo board. Coordinates are [row, col] on a 15x15 grid, cell size 24px (viewBox 360x360).
const CELL = 24;
const LUDO_RING_PATH = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
  [6, 0],
];
const LUDO_HOME_PATH = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]], // player 0 (red) run-in to center
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]], // player 1 (yellow) run-in to center
];
const LUDO_BASE_SLOTS = [
  [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]], // player 0 base (top-left)
  [[10.5, 10.5], [10.5, 12.5], [12.5, 10.5], [12.5, 12.5]], // player 1 base (bottom-right)
];
const LUDO_COLORS = ["#e0483e", "#f2b705"]; // red, yellow
const LUDO_COLOR_NAMES = ["Red", "Yellow"];

function ludoCellCenter([r, c]) {
  return [c * CELL + CELL / 2, r * CELL + CELL / 2];
}
function ludoTokenCoords(playerIndex, pos) {
  if (pos === -1) return null; // caller falls back to base slot
  if (pos >= 100) {
    const stretchIdx = pos - 100; // 0..5, 5 means fully home
    if (stretchIdx >= LUDO_HOME_PATH[playerIndex].length) return null; // home/finished — off board
    return ludoCellCenter(LUDO_HOME_PATH[playerIndex][stretchIdx]);
  }
  const start = playerIndex === 0 ? 0 : 26;
  const ringIdx = (start + pos) % 52;
  return ludoCellCenter(LUDO_RING_PATH[ringIdx]);
}

function LudoBoard({ state, myIndex, isMyTurn, onMove }) {
  const size = 15 * CELL;
  const canMoveToken = isMyTurn && state.dice !== null;

  // Base quadrant squares
  const bases = [
    { x: 0, y: 0, color: LUDO_COLORS[0] },
    { x: 9 * CELL, y: 9 * CELL, color: LUDO_COLORS[1] },
  ];

  const tokenNodes = [];
  [0, 1].forEach((playerIndex) => {
    state.tokens[playerIndex].forEach((pos, i) => {
      let cx, cy;
      if (pos === -1) {
        const [r, c] = LUDO_BASE_SLOTS[playerIndex][i];
        [cx, cy] = [c * CELL, r * CELL];
      } else {
        const coords = ludoTokenCoords(playerIndex, pos);
        if (!coords) return; // finished/home — hide from board
        [cx, cy] = coords;
      }
      const mine = playerIndex === myIndex;
      tokenNodes.push(
        <g
          key={`${playerIndex}-${i}`}
          onClick={() => mine && canMoveToken && onMove({ action: "move", tokenIndex: i })}
          style={{ cursor: mine && canMoveToken ? "pointer" : "default" }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={mine ? 8.5 : 7.5}
            fill={LUDO_COLORS[playerIndex]}
            stroke={mine && canMoveToken ? "#fff" : "rgba(0,0,0,0.35)"}
            strokeWidth={mine && canMoveToken ? 2.5 : 1}
          />
          <circle cx={cx} cy={cy} r={3} fill="rgba(255,255,255,0.75)" />
        </g>,
      );
    });
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: "block", margin: "0 auto", background: "#f4f1ea", borderRadius: "10px" }}>
      {/* base quadrants */}
      {bases.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={6 * CELL} height={6 * CELL} fill={b.color} opacity={0.18} rx={10} />
      ))}
      {/* ring path cells */}
      {LUDO_RING_PATH.map(([r, c], i) => {
        const isStart = i === 0 || i === 26;
        return (
          <rect
            key={`ring-${i}`}
            x={c * CELL}
            y={r * CELL}
            width={CELL}
            height={CELL}
            fill={isStart ? LUDO_COLORS[i === 0 ? 0 : 1] : "#fff"}
            fillOpacity={isStart ? 0.55 : 1}
            stroke="#d8d2c4"
            strokeWidth={1}
          />
        );
      })}
      {/* home-stretch cells */}
      {LUDO_HOME_PATH.map((path, playerIndex) =>
        path.map(([r, c], i) => (
          <rect
            key={`home-${playerIndex}-${i}`}
            x={c * CELL}
            y={r * CELL}
            width={CELL}
            height={CELL}
            fill={LUDO_COLORS[playerIndex]}
            fillOpacity={0.45}
            stroke="#d8d2c4"
            strokeWidth={1}
          />
        )),
      )}
      {/* center home triangle */}
      <rect x={6 * CELL} y={6 * CELL} width={3 * CELL} height={3 * CELL} fill="#fff" stroke="#d8d2c4" />
      <text x={7.5 * CELL} y={7.5 * CELL + 5} textAnchor="middle" fontSize="16">🏠</text>
      {tokenNodes}
    </svg>
  );
}

function Ludo({ state, myIndex, onMove }) {
  const isMyTurn = state.turn === myIndex && state.status === "active";
  const myColor = LUDO_COLOR_NAMES[myIndex];
  return (
    <div style={{ textAlign: "center" }}>
      <p className="game-status-line">
        {state.status === "won"
          ? state.forfeitedBy !== undefined
            ? state.winner === myIndex
              ? "Opponent exited — you win! 🎉"
              : "You exited the game."
            : state.winner === myIndex
              ? "All tokens home — you won! 🎉"
              : "Opponent got all tokens home first."
          : isMyTurn
            ? "Your turn — roll and move"
            : "Waiting for opponent…"}
      </p>
      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
        You're playing <b style={{ color: LUDO_COLORS[myIndex] }}>{myColor}</b>. Roll a 6 to leave base; land on an opponent's token to send it back.
      </div>
      {state.status === "active" && (
        <div style={{ fontSize: "22px", margin: "8px 0", display: "flex", gap: "12px", alignItems: "center", justifyContent: "center" }}>
          <span>🎲 {state.dice ?? "—"}</span>
          {isMyTurn && state.dice === null && (
            <button type="button" onClick={() => onMove({ action: "roll" })}>
              Roll dice
            </button>
          )}
          {isMyTurn && state.dice !== null && (
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Tap a highlighted token to move it</span>
          )}
        </div>
      )}
      <LudoBoard state={state} myIndex={myIndex} isMyTurn={isMyTurn} onMove={onMove} />
    </div>
  );
}

// ---------- UNO ----------
const UNO_COLOR_HEX = { red: "#d9433e", yellow: "#e8b400", green: "#3ba24a", blue: "#2c6fd1", wild: "#2b2b2b" };
const UNO_VALUE_LABEL = { skip: "🚫", reverse: "🔁", draw2: "+2", wild: "★", draw4: "+4" };

function UnoCard({ card, size = "normal", onClick, disabled }) {
  const bg = UNO_COLOR_HEX[card.color] || "#444";
  const label = UNO_VALUE_LABEL[card.value] || card.value;
  const dims = size === "small" ? { width: 34, height: 48, fontSize: 14 } : { width: 46, height: 66, fontSize: 20 };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...dims,
        borderRadius: "8px",
        border: "2px solid #fff",
        background: bg,
        color: "#fff",
        fontWeight: 800,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

function Uno({ state, myIndex, onMove }) {
  const isMyTurn = state.turn === myIndex && state.status === "active";
  const top = state.discard[state.discard.length - 1];
  const awaitingMyColorChoice = state.pendingChoice === myIndex;
  const activeColor = state.chosenColor || top.color;

  if (state.status === "won") {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "18px", fontWeight: 700 }}>
          {state.winner === myIndex ? "You played your last card — you win! 🎉" : "Opponent went out — you lost this round."}
        </p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center" }}>
      <p className="game-status-line">
        {isMyTurn ? (awaitingMyColorChoice ? "Pick a color" : "Your turn") : "Waiting for opponent…"}
      </p>
      <div style={{ display: "flex", gap: "16px", justifyContent: "center", alignItems: "center", margin: "10px 0" }}>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>Opponent</div>
          <div style={{ fontSize: "13px" }}>🂠 × {state.opponentCount}</div>
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>Top of pile</div>
          <UnoCard card={{ ...top, color: activeColor === top.color ? top.color : activeColor }} disabled />
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>Draw pile</div>
          <div style={{ fontSize: "13px" }}>🂠 × {state.drawPileCount}</div>
        </div>
      </div>

      {awaitingMyColorChoice && (
        <div style={{ display: "flex", gap: "8px", justifyContent: "center", margin: "12px 0" }}>
          {["red", "yellow", "green", "blue"].map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onMove({ chooseColor: color })}
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: UNO_COLOR_HEX[color], border: "2px solid #fff", cursor: "pointer",
              }}
              aria-label={color}
            />
          ))}
        </div>
      )}

      {!awaitingMyColorChoice && (
        <>
          <div
            style={{
              display: "flex", gap: "6px", justifyContent: "flex-start", overflowX: "auto",
              padding: "10px 4px", margin: "8px 0", maxWidth: "100%",
            }}
          >
            {state.myHand.map((card, i) => (
              <UnoCard
                key={i}
                card={card}
                onClick={() => onMove({ cardIndex: i })}
                disabled={!isMyTurn}
              />
            ))}
          </div>
          {isMyTurn && (
            <button type="button" onClick={() => onMove({ action: "draw" })}>
              🂠 Draw a card
            </button>
          )}
        </>
      )}
    </div>
  );
}

const BOARD_COMPONENTS = {
  ttt: TicTacToe,
  wordguess: WordGuess,
  truthdare: TruthOrDare,
  quiz: MiniQuiz,
  chess: Chess,
  ludo: Ludo,
  uno: Uno,
};

function initials(name) {
  return (name || "?").slice(0, 2).toUpperCase();
}

// Brief 3-2-1 "Let's Play!" beat shown once, right when a session flips from
// pending → active, before the actual board takes over.
function useJustStarted(status) {
  const [showing, setShowing] = useState(false);
  const [count, setCount] = useState(3);
  const prevStatus = useRef(status);

  useEffect(() => {
    if (prevStatus.current === "pending" && status === "active") {
      setShowing(true);
      setCount(3);
    }
    prevStatus.current = status;
  }, [status]);

  useEffect(() => {
    if (!showing) return;
    if (count <= 0) {
      const t = setTimeout(() => setShowing(false), 250);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [showing, count]);

  return { showing, count };
}

export default function GameOverlay({
  session,
  myUserId,
  members = [],
  onMove,
  onAccept,
  onDecline,
  onCancel,
  onRematch,
  onForfeit,
  onClose,
  onViewHistory,
}) {
  const { showing: justStarted, count } = useJustStarted(session?.status);
  if (!session) return null;
  const myIndex = session.players.indexOf(myUserId);
  const isInvitee = session.players[1] === myUserId;
  const Board = BOARD_COMPONENTS[session.type];
  const opponentId = session.players.find((id) => id !== myUserId);
  const opponent = members.find((m) => m.id === opponentId) || null;

  function handleExit() {
    if (window.confirm("Exit this game? It will count as a loss (forfeit) for you.")) {
      onForfeit(session);
    }
  }

  // --- Sender view: invite just sent, waiting for the other player to accept ---
  if (session.status === "pending" && !isInvitee) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="game-invite-card game-invite-sent" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
          <div className="game-invite-icon-badge">🎮</div>
          <h3 className="game-invite-title">{gameLabel(session.type)}</h3>
          <div className="game-invite-waiting-line">
            <span className="game-invite-spinner" />
            Waiting for opponent…
          </div>
          <div className="game-invite-sub">
            Invite sent to <b>{opponent?.username || "the other player"}</b>
          </div>
          <div className="game-invite-board-ghost" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} />
            ))}
          </div>
          <button type="button" className="game-invite-cancel-btn" onClick={onCancel}>
            <span aria-hidden="true">⊗</span> Cancel Invite
          </button>
        </div>
      </div>
    );
  }

  // --- Receiver view: invite just arrived ---
  if (session.status === "pending" && isInvitee) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="game-invite-card game-invite-received" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
          <div className="game-invite-icon-badge game-invite-icon-badge-green">🎮</div>
          <h3 className="game-invite-title">{gameLabel(session.type)}</h3>
          <div className="game-invite-from-line">
            <b>{opponent?.username || "Someone"}</b> invited you to play
          </div>
          <div className="game-invite-opponent-row">
            <span className="avatar game-invite-avatar">
              {opponent?.avatarUrl ? <img src={opponent.avatarUrl} alt="" /> : initials(opponent?.username)}
            </span>
            <div className="game-invite-opponent-text">
              <div>Let's play {gameLabel(session.type)}!</div>
              <div className="game-invite-opponent-sub">Are you in?</div>
            </div>
          </div>
          <div className="game-invite-actions">
            <button type="button" className="game-invite-decline-btn" onClick={onDecline}>
              <span aria-hidden="true">⊗</span> Decline
            </button>
            <button type="button" className="game-invite-accept-btn" onClick={onAccept}>
              <span aria-hidden="true">✓</span> Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Both sides: brief "Let's Play!" countdown once the invite is accepted ---
  if (justStarted) {
    return (
      <div className="modal-backdrop">
        <div className="game-countdown-card">
          <div className="game-countdown-trophy">🏆</div>
          <h3 className="game-countdown-title">Let's Play!</h3>
          <div className="game-invite-from-line">
            <b>{opponent?.username || "Your opponent"}</b> has joined the game
          </div>
          <div className="game-invite-opponent-row">
            <span className="avatar game-invite-avatar">
              {opponent?.avatarUrl ? <img src={opponent.avatarUrl} alt="" /> : initials(opponent?.username)}
            </span>
            <div className="game-invite-opponent-text">
              <div>{opponent?.username || "Opponent"}</div>
              <div className="game-invite-opponent-sub status-online">● Online</div>
            </div>
          </div>
          <div className="game-countdown-sub">The game will start automatically…</div>
          <div className="game-countdown-number">{Math.max(count, 0)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px" }}>
        <button type="button" className="modal-close" onClick={onClose}>
          ✕
        </button>
        <h3 style={{ margin: "0 0 14px" }}>🎮 {gameLabel(session.type)}</h3>

        {session.status === "declined" && <p style={{ textAlign: "center" }}>Invite was declined.</p>}
        {session.status === "cancelled" && <p style={{ textAlign: "center" }}>Invite was cancelled.</p>}

        {(session.status === "active" || session.status === "finished") && Board && session.state && (
          <Board state={session.state} myIndex={myIndex} onMove={onMove} />
        )}

        {session.status === "active" && (
          <div style={{ textAlign: "center", marginTop: "16px" }}>
            <button
              type="button"
              onClick={handleExit}
              style={{ background: "var(--danger, #d9534f)", color: "#fff", border: "none" }}
            >
              🚪 Exit game
            </button>
          </div>
        )}

        {session.status === "finished" && (
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "16px", flexWrap: "wrap" }}>
            <button type="button" onClick={() => onRematch(session)}>
              🔁 Rematch
            </button>
            {onViewHistory && (
              <button type="button" onClick={() => onViewHistory(session.conversationId)}>
                📜 Past results
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}