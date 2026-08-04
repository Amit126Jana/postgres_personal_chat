export default function PollCard({ poll, myUserId, onVote, onClose }) {
  if (!poll) {
    return <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Loading poll…</div>;
  }

  const total = poll.counts.reduce((a, b) => a + b, 0);
  const isCreator = poll.createdBy === myUserId;

  return (
    <div
      style={{
        minWidth: "240px",
        maxWidth: "280px",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "14px",
        padding: "14px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "26px",
            height: "26px",
            borderRadius: "8px",
            background: "rgba(var(--signal-rgb), 0.15)",
            fontSize: "14px",
            flexShrink: 0,
          }}
        >
          📊
        </div>
        <div style={{ fontWeight: 700, fontSize: "14px", lineHeight: 1.3 }}>
          {poll.question}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {poll.options.map((opt, i) => {
          const voters = poll.votersByOption[i] || [];
          const count = voters.length;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const iVoted = voters.some((v) => v.userId === myUserId);
          const voterNames = voters.map((v) => v.username).join(", ");
          return (
            <button
              key={i}
              type="button"
              disabled={poll.closed}
              title={voterNames}
              onClick={() => onVote(poll.id, i)}
              style={{
                position: "relative",
                textAlign: "left",
                padding: "9px 12px",
                borderRadius: "10px",
                border: iVoted
                  ? "1px solid var(--signal)"
                  : "1px solid var(--line)",
                background: "var(--surface-2)",
                overflow: "hidden",
                cursor: poll.closed ? "default" : "pointer",
                transition: "border-color 0.15s ease, transform 0.1s ease",
              }}
              onMouseEnter={(e) => {
                if (!poll.closed) e.currentTarget.style.borderColor = "var(--signal)";
              }}
              onMouseLeave={(e) => {
                if (!iVoted) e.currentTarget.style.borderColor = "var(--line)";
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${pct}%`,
                  background: iVoted
                    ? "rgba(var(--signal-rgb), 0.25)"
                    : "rgba(127,127,127,0.14)",
                  transition: "width 0.3s ease",
                  zIndex: 0,
                }}
              />
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "13px",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontWeight: iVoted ? 600 : 500,
                    color: iVoted ? "var(--signal)" : "inherit",
                  }}
                >
                  {iVoted ? "✓ " : ""}
                  {opt}
                </span>
                <span
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "12px",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {pct}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div
        style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          marginTop: "10px",
          paddingTop: "10px",
          borderTop: "1px solid var(--line)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span>
          {poll.totalVoters} vote{poll.totalVoters === 1 ? "" : "s"}
          {poll.allowMultiple ? " · multiple choice" : ""}
          {poll.closed ? " · closed" : ""}
        </span>
        {isCreator && !poll.closed && (
          <button
            type="button"
            onClick={() => onClose(poll.id)}
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: "999px",
              border: "1px solid var(--line)",
              background: "var(--surface-2)",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            Close poll
          </button>
        )}
      </div>
    </div>
  );
}