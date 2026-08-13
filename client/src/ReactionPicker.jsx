import { useEffect, useLayoutEffect, useRef, useState } from "react";
import EmojiPickerReact, { Theme } from "emoji-picker-react";

const BASE_WIDTH = 336;
const BASE_HEIGHT = 440;
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

  const TABS = [
    { key: "emoji", label: "Emoji", icon: "emoji-icon" },
    { key: "sticker", label: "Stickers", icon: "image-icon" },
    { key: "voice", label: "Voice", icon: "mic-icon" },
    { key: "video", label: "Video", icon: "video-call-icon" },
  ];

  return (
    <div className={"emoji-picker-wrap " + anchorClass} ref={ref} style={wrapStyle}>
      <div className="rp-panel" style={{ width: size.width }}>
        <div className="rp-header">
          <span className="rp-header-icon">
            <svg className="icon" width="15" height="15"><use href="#emoji-icon" /></svg>
          </span>
          <span className="rp-header-title">Reactions</span>
          <button type="button" className="rp-header-close" onClick={onClose} aria-label="Close">
            <svg className="icon" width="13" height="13"><use href="#close-icon" /></svg>
          </button>
        </div>

        <div className="rp-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={"rp-tab" + (tab === t.key ? " active" : "")}
            >
              <svg className="icon" width="15" height="15"><use href={`#${t.icon}`} /></svg>
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
            height={size.height - 78}
            previewConfig={{ showPreview: false }}
            searchDisabled={false}
          />
        )}

        {tab === "sticker" && (
          <>
            <div className="rp-section-label">Frequently used</div>
            <div className="rp-sticker-grid" style={{ height: size.height - 100 }}>
              {STICKERS.map((s) => (
                <button key={s} type="button" className="rp-sticker" onClick={() => onSelect(`sticker:${s}`)}>
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "voice" && (
          <MediaReactionRecorder
            kind="voice"
            height={size.height - 78}
            uploadFile={uploadFile}
            mediaSrc={mediaSrc}
            onSelect={onSelect}
          />
        )}

        {tab === "video" && (
          <MediaReactionRecorder
            kind="video"
            height={size.height - 78}
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
    <div className="rp-record" style={{ height }}>
      {status === "idle" && (
        <>
          <div className="rp-record-circle-wrap">
            <span className="rp-record-ring" />
            <button type="button" className="rp-record-btn" onClick={startRecording} aria-label="Start recording">
              <svg className="icon" width="22" height="22">
                <use href={`#${kind === "video" ? "video-call-icon" : "mic-icon"}`} />
              </svg>
            </button>
          </div>
          <p className="rp-record-copy">
            Record a short {kind} reaction (up to {MAX_RECORD_SECONDS}s)
          </p>
          <span className="rp-record-hint">Tap to start recording</span>
        </>
      )}

      {status === "recording" && (
        <>
          {kind === "video" ? (
            <video ref={videoPreviewRef} className="rp-record-preview-media" style={{ height: 120 }} />
          ) : (
            <div className="rp-record-circle-wrap">
              <span className="rp-record-ring live" />
              <span className="rp-record-btn">
                <svg className="icon" width="22" height="22"><use href="#mic-icon" /></svg>
              </span>
            </div>
          )}
          <div className="rp-record-live-label">
            <span className="rp-record-dot" />
            Recording… {seconds}s / {MAX_RECORD_SECONDS}s
          </div>
          <button type="button" className="rp-btn" onClick={stopRecording}>
            ■ Stop
          </button>
        </>
      )}

      {status === "preview" && blobUrl && (
        <>
          {kind === "video" ? (
            <video src={blobUrl} controls className="rp-record-preview-media" />
          ) : (
            <audio src={blobUrl} controls />
          )}
          <div className="rp-record-actions">
            <button type="button" className="rp-btn" onClick={retake}>
              Retake
            </button>
            <button type="button" className="rp-btn rp-btn-primary" onClick={confirmSend}>
              <svg className="icon" width="13" height="13"><use href="#send-icon" /></svg>
              Send reaction
            </button>
          </div>
          {errorMsg && <div className="rp-record-error">{errorMsg}</div>}
        </>
      )}

      {status === "uploading" && <p className="rp-record-copy">Uploading…</p>}

      {status === "error" && (
        <>
          <div className="rp-record-error">{errorMsg}</div>
          <button type="button" className="rp-btn" onClick={() => setStatus("idle")}>
            Try again
          </button>
        </>
      )}
    </div>
  );
}