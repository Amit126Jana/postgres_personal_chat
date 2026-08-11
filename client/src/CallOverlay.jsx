import { useEffect, useRef, useState } from "react";

function initials(name) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

function useElapsed(startedAt) {
  const [now, setNow] = useState(null);
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt || !now) return null;
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

export default function CallOverlay({
  callState, // "calling" | "ringing" | "connecting" | "active"
  callType, // "audio" | "video"
  peerUsername,
  peerAvatarUrl,
  localStream,
  remoteStream,
  micOn,
  camOn,
  speakerOn,
  callStartedAt,
  onAccept,
  onDecline,
  onEnd,
  onToggleMic,
  onToggleCam,
  onToggleSpeaker,
  onSwitchCamera,
}) {
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const [showKeypad, setShowKeypad] = useState(false);

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = localStream || null;
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = remoteStream || null;
  }, [remoteStream]);

  // Reset the keypad whenever the overlay is hidden or a fresh call starts, so a leftover
  // "keypad open" state from a previous call never bleeds into the next one.
  useEffect(() => {
    setShowKeypad(false);
  }, [callState === null]);

  const elapsed = useElapsed(callStartedAt);

  if (!callState) return null;

  const isVideo = callType === "video";
  const isRinging = callState === "ringing";
  const hasRemoteVideo = isVideo && !!remoteStream;

  const statusText =
    callState === "calling"
      ? `Calling ${peerUsername}…`
      : callState === "ringing"
        ? `Incoming ${isVideo ? "video" : "audio"} call…`
        : callState === "connecting"
          ? `Connecting ${isVideo ? "video" : ""}…`
          : elapsed || "Connected";

  return (
    <div className="call-overlay-v2">
      <div className={`call-card-v2 ${isVideo ? "is-video" : "is-audio"}`}>
        <div className="call-v2-kicker">{isVideo ? "Video call" : "Audio call"}</div>

        <div className={`call-v2-stage ${hasRemoteVideo ? "has-remote-video" : ""}`}>
          {hasRemoteVideo ? (
            <video ref={remoteRef} autoPlay playsInline className="call-remote-video-v2" />
          ) : (
            <div className={`call-v2-avatar-wrap state-${callState}`}>
              <span className="call-v2-ring r1" />
              <span className="call-v2-ring r2" />
              <span className="call-v2-avatar">
                {peerAvatarUrl ? (
                  <img src={peerAvatarUrl} alt="" />
                ) : (
                  <span className="call-v2-avatar-fallback">{initials(peerUsername)}</span>
                )}
              </span>
            </div>
          )}

          {isVideo && localStream && (
            <video ref={localRef} autoPlay playsInline muted className="call-local-video-v2" />
          )}
        </div>

        <div className="call-v2-name">{peerUsername}</div>
        <div className="call-v2-status">
          {!isRinging && <span className="call-v2-pulse-dot" />}
          {statusText}
        </div>

        {showKeypad && !isRinging && (
          <div className="call-v2-keypad">
            {KEYPAD_KEYS.map((k) => (
              <button type="button" key={k} className="call-v2-keypad-key">
                {k}
              </button>
            ))}
          </div>
        )}

        <div className="call-v2-controls">
          {isRinging ? (
            <>
              <div className="call-v2-btn-wrap">
                <button className="call-v2-btn decline" onClick={onDecline} aria-label="Decline">
                  <svg className="icon" width="24" height="24">
                    <use href="#call-end-icon" />
                  </svg>
                </button>
                <span className="call-v2-btn-label">Decline</span>
              </div>
              <div className="call-v2-btn-wrap">
                <button className="call-v2-btn accept" onClick={onAccept} aria-label="Accept">
                  <svg className="icon" width="24" height="24">
                    <use href={isVideo ? "#video-call-icon" : "#phone-icon"} />
                  </svg>
                </button>
                <span className="call-v2-btn-label">Accept</span>
              </div>
            </>
          ) : (
            <>
              <div className="call-v2-btn-wrap">
                <button
                  className={`call-v2-btn ghost ${!micOn ? "is-off" : ""}`}
                  onClick={onToggleMic}
                  aria-label={micOn ? "Mute" : "Unmute"}
                >
                  <svg className="icon" width="20" height="20">
                    <use href={micOn ? "#mic-icon" : "#mic-off-icon"} />
                  </svg>
                </button>
                <span className="call-v2-btn-label">{micOn ? "Mute" : "Unmute"}</span>
              </div>

              {isVideo ? (
                <div className="call-v2-btn-wrap">
                  <button
                    className={`call-v2-btn ghost ${!camOn ? "is-off" : ""}`}
                    onClick={onToggleCam}
                    aria-label={camOn ? "Camera off" : "Camera on"}
                  >
                    <svg className="icon" width="20" height="20">
                      <use href={camOn ? "#camera-icon" : "#video-off-icon"} />
                    </svg>
                  </button>
                  <span className="call-v2-btn-label">Camera</span>
                </div>
              ) : (
                <div className="call-v2-btn-wrap">
                  <button
                    className={`call-v2-btn ghost ${showKeypad ? "is-active" : ""}`}
                    onClick={() => setShowKeypad((v) => !v)}
                    aria-label="Keypad"
                  >
                    <svg className="icon" width="20" height="20">
                      <use href="#keypad-icon" />
                    </svg>
                  </button>
                  <span className="call-v2-btn-label">Keypad</span>
                </div>
              )}

              <div className="call-v2-btn-wrap">
                <button
                  className={`call-v2-btn ghost ${isVideo ? "is-active" : !speakerOn ? "is-off" : ""}`}
                  onClick={isVideo ? onSwitchCamera : onToggleSpeaker}
                  aria-label={isVideo ? "Switch camera" : speakerOn ? "Speaker off" : "Speaker on"}
                >
                  <svg className="icon" width="20" height="20">
                    <use
                      href={
                        isVideo
                          ? "#switch-camera-icon"
                          : speakerOn
                            ? "#speaker-icon"
                            : "#speaker-off-icon"
                      }
                    />
                  </svg>
                </button>
                <span className="call-v2-btn-label">{isVideo ? "Switch" : "Speaker"}</span>
              </div>

              <div className="call-v2-btn-wrap">
                <button className="call-v2-btn decline" onClick={onEnd} aria-label="End call">
                  <svg className="icon" width="24" height="24">
                    <use href="#call-end-icon" />
                  </svg>
                </button>
                <span className="call-v2-btn-label">End</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}