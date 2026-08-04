import { useEffect, useState } from "react";
import { GAME_LIST } from "./GamesMenu.jsx";

function gameLabel(type) {
  return GAME_LIST.find((g) => g.type === type)?.label || type;
}

function resultLine(entry, myUserId) {
  const iAmPlayer1 = entry.player1Id === myUserId;
  const opponentName = iAmPlayer1 ? entry.player2Username : entry.player1Username;
  if (entry.result === "draw") return { text: `Draw vs ${opponentName}`, tone: "draw" };
  const iWon = entry.winnerId === myUserId;
  if (entry.result === "forfeit") {
    return iWon
      ? { text: `Won (opponent exited) vs ${opponentName}`, tone: "win" }
      : { text: `Lost (you exited) vs ${opponentName}`, tone: "loss" };
  }
  return iWon
    ? { text: `Won vs ${opponentName}`, tone: "win" }
    : { text: `Lost vs ${opponentName}`, tone: "loss" };
}

const TONE_COLOR = {
  win: "#2e9e4f",
  loss: "#d9534f",
  draw: "var(--text-muted)",
};

export default function GameHistory({ serverUrl, token, myUserId, conversationId, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const url = new URL(`${serverUrl}/api/games/history`);
        if (conversationId) url.searchParams.set("conversationId", conversationId);
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Failed to load game history");
        const data = await res.json();
        if (!cancelled) setEntries(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [serverUrl, token, conversationId]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px" }}>
        <button type="button" className="modal-close" onClick={onClose}>
          ✕
        </button>
        <h3 style={{ margin: "0 0 14px" }}>📜 Game history{conversationId ? " — this chat" : ""}</h3>

        {loading && <p style={{ textAlign: "center" }}>Loading…</p>}
        {!loading && error && <p style={{ textAlign: "center", color: "var(--danger, #d9534f)" }}>{error}</p>}
        {!loading && !error && entries.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--text-muted)" }}>No games played yet.</p>
        )}

        {!loading && !error && entries.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "420px", overflowY: "auto" }}>
            {entries.map((entry) => {
              const { text, tone } = resultLine(entry, myUserId);
              return (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: "var(--surface-2)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{gameLabel(entry.gameType)}</div>
                    <div style={{ fontSize: "13px", color: TONE_COLOR[tone] }}>{text}</div>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "right" }}>
                    {new Date(entry.createdAt).toLocaleDateString()}
                    <br />
                    {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
