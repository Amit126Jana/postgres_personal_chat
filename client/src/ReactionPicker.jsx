import { useEffect, useLayoutEffect, useRef, useState } from "react";
import EmojiPickerReact, { Theme } from "emoji-picker-react";

const BASE_WIDTH = 336;
const BASE_HEIGHT = 400;
const VIEWPORT_MARGIN = 12;
const MAX_RECORD_SECONDS = 12;

// Curated "sticker" set — bigger, expressive reactions beyond the standard emoji picker.
// (Real animated stickers/GIF search need a licensed asset library or a GIF-search API key;
// this static set covers the common reaction cases without an external dependency.)
const STICKERS = [
  "🎉🎊", "😂💀", "🔥🔥", "❤️‍🔥", "👏👏👏", "😭💯", "🤯", "🥳",
  "😍", "🙌", "💯", "😱", "🤡", "😴", "🫡", "🤝",
  "👀", "😤", "🎯", "🚀", "🥹", "😮‍💨", "🤌", "✨",
];

export default function ReactionPicker({ onSelect, onClose, anchorClass = "", uploadFile, mediaSrc }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const [size, setSize] = useState({ width: BASE_WIDTH, height: BASE_HEIGHT });
  const [tab, setTab] = useState("emoji");

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    function reposition() {
      const el = ref.current;
      if (!el || !el.parentElement) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(BASE_WIDTH, vw - VIEWPORT_MARGIN * 2);
      const height = Math.min(BASE_HEIGHT, vh - VIEWPORT_MARGIN * 2);
      setSize({ width, height });
      const anchor = el.parentElement.getBoundingClientRect();
      const alignRight = anchorClass.includes("mine");
      let top = anchor.top - height - 8;
      if (top < VIEWPORT_MARGIN) {
        const below = anchor.bottom + 8;
        top = below + height <= vh - VIEWPORT_MARGIN || below < anchor.top ? below : top;
      }
      top = Math.min(Math.max(top, VIEWPORT_MARGIN), vh - VIEWPORT_MARGIN - height);
      let left = alignRight ? anchor.right - width : anchor.left;
      left = Math.min(Math.max(left, VIEWPORT_MARGIN), vw - VIEWPORT_MARGIN - width);
      setPos({ top, left });
    }
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorClass]);

  const wrapStyle = pos
    ? { position: "fixed", top: pos.top, left: pos.left, bottom: "auto", right: "auto" }
    : { visibility: "hidden" };

  return (
    <div className={"emoji-picker-wrap " + anchorClass} ref={ref} style={wrapStyle}>
      <div style={{ width: size.width, background: "var(--surface)", borderRadius: "10px", overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--line)" }}>
          {[
            { key: "emoji", label: "😊" },
            { key: "sticker", label: "🎊 Stickers" },
            { key: "voice", label: "🎙 Voice" },
            { key: "video", label: "🎥 Video" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                flex: 1,
                padding: "8px 4px",
                fontSize: "12px",
                fontWeight: tab === t.key ? 700 : 500,
                background: tab === t.key ? "var(--surface-2)" : "transparent",
                border: "none",
                borderBottom: tab === t.key ? "2px solid var(--signal)" : "2px solid transparent",
                cursor: "pointer",
                color: "var(--text)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "emoji" && (
          <EmojiPickerReact
            onEmojiClick={(emojiData) => onSelect(`emoji:${emojiData.emoji}`)}
            theme={Theme.DARK}
            autoFocusSearch={false}
            width={size.width}
            height={size.height - 40}
            previewConfig={{ showPreview: false }}
            searchDisabled={false}
          />
        )}

        {tab === "sticker" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "6px",
              padding: "10px",
              height: size.height - 40,
              overflowY: "auto",
            }}
          >
            {STICKERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSelect(`sticker:${s}`)}
                style={{
                  fontSize: "22px",
                  padding: "10px 4px",
                  borderRadius: "10px",
                  border: "1px solid var(--line)",
                  background: "var(--surface-2)",
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {tab === "voice" && (
          <MediaReactionRecorder
            kind="voice"
            height={size.height - 40}
            uploadFile={uploadFile}
            mediaSrc={mediaSrc}
            onSelect={onSelect}
          />
        )}

        {tab === "video" && (
          <MediaReactionRecorder
            kind="video"
            height={size.height - 40}
            uploadFile={uploadFile}
            mediaSrc={mediaSrc}
            onSelect={onSelect}
          />
        )}
      </div>
    </div>
  );
}

// Shared recorder for both voice-only and video reactions. Records a short clip via
// MediaRecorder, previews it, and on confirm uploads it through the existing
// /api/upload endpoint before firing onSelect with a "voice:<url>" or "video:<url>" key.
function MediaReactionRecorder({ kind, height, uploadFile, mediaSrc, onSelect }) {
  const [status, setStatus] = useState("idle"); // idle | recording | preview | uploading | error
  const [seconds, setSeconds] = useState(0);
  const [blobUrl, setBlobUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const videoPreviewRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    setErrorMsg("");
    try {
      const constraints = kind === "video" ? { audio: true, video: { width: 240, height: 180 } } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (kind === "video" && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.muted = true;
        videoPreviewRef.current.play().catch(() => {});
      }
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: kind === "video" ? "video/webm" : "audio/webm" });
        setBlobUrl(URL.createObjectURL(blob));
        setStatus("preview");
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_RECORD_SECONDS) {
            recorder.stop();
            clearInterval(timerRef.current);
            return MAX_RECORD_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      setErrorMsg(
        kind === "video"
          ? "Couldn't access camera/mic — check browser permissions."
          : "Couldn't access mic — check browser permissions.",
      );
      setStatus("error");
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    recorderRef.current?.stop();
  }

  function retake() {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);
    setStatus("idle");
    setSeconds(0);
  }

  async function confirmSend() {
    setStatus("uploading");
    try {
      const blob = await fetch(blobUrl).then((r) => r.blob());
      const file = new File([blob], `reaction-${kind}-${Date.now()}.webm`, {
        type: kind === "video" ? "video/webm" : "audio/webm",
      });
      const { mediaUrl } = await uploadFile(file);
      onSelect(`${kind}:${mediaUrl}`);
    } catch (err) {
      setErrorMsg("Upload failed — try again.");
      setStatus("preview");
    }
  }

  return (
    <div
      style={{
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        padding: "12px",
        textAlign: "center",
      }}
    >
      {status === "idle" && (
        <>
          <div style={{ fontSize: "32px" }}>{kind === "video" ? "🎥" : "🎙️"}</div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
            Record a short {kind} reaction (up to {MAX_RECORD_SECONDS}s)
          </p>
          <button type="button" onClick={startRecording}>
            ● Start recording
          </button>
        </>
      )}

      {status === "recording" && (
        <>
          {kind === "video" && (
            <video ref={videoPreviewRef} style={{ width: 160, borderRadius: 8, background: "#000" }} />
          )}
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--danger, #d9534f)" }}>
            ● Recording… {seconds}s / {MAX_RECORD_SECONDS}s
          </div>
          <button type="button" onClick={stopRecording}>
            ■ Stop
          </button>
        </>
      )}

      {status === "preview" && blobUrl && (
        <>
          {kind === "video" ? (
            <video src={blobUrl} controls style={{ width: 160, borderRadius: 8 }} />
          ) : (
            <audio src={blobUrl} controls />
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={retake}>
              Retake
            </button>
            <button type="button" onClick={confirmSend}>
              Send reaction
            </button>
          </div>
        </>
      )}

      {status === "uploading" && <p style={{ fontSize: "12px" }}>Uploading…</p>}

      {status === "error" && (
        <>
          <p style={{ fontSize: "12px", color: "var(--danger, #d9534f)" }}>{errorMsg}</p>
          <button type="button" onClick={() => setStatus("idle")}>
            Try again
          </button>
        </>
      )}
    </div>
  );
}