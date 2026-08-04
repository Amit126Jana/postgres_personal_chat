import { useState } from "react";

export default function PollComposer({ onCreate, onClose }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);

  function updateOption(i, value) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }

  function addOption() {
    setOptions((prev) => (prev.length < 8 ? [...prev, ""] : prev));
  }

  function removeOption(i) {
    setOptions((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  const canSubmit = question.trim().length > 0 && cleanOptions.length >= 2;

  function handleSubmit() {
    if (!canSubmit) return;
    onCreate({ question: question.trim(), options: cleanOptions, allowMultiple });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px" }}>
        <button type="button" className="modal-close" onClick={onClose}>
          ✕
        </button>
        <h3 style={{ margin: "0 0 14px" }}>📊 Create a poll</h3>

        <div className="poll-form" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            type="text"
            placeholder="Ask a question…"
            value={question}
            maxLength={300}
            onChange={(e) => setQuestion(e.target.value)}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {options.map((opt, i) => (
              <div key={i} className="poll-option-row">
                <input
                  type="text"
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  maxLength={100}
                  onChange={(e) => updateOption(i, e.target.value)}
                  style={{ flex: 1 }}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    className="poll-option-remove"
                    onClick={() => removeOption(i)}
                    title="Remove option"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {options.length < 8 && (
            <button type="button" className="poll-add-option" onClick={addOption}>
              + Add option
            </button>
          )}

          <label className="poll-multi-label">
            <input
              type="checkbox"
              checked={allowMultiple}
              onChange={(e) => setAllowMultiple(e.target.checked)}
            />
            Allow selecting multiple options
          </label>

          <button type="button" className="poll-submit" disabled={!canSubmit} onClick={handleSubmit}>
            Create poll
          </button>
        </div>
      </div>
    </div>
  );
}