import { useEffect, useRef } from "react";

export default function CallOverlay({
  callState, // "calling" | "ringing" | "connecting" | "active"
  peerUsername,
  localStream,
  remoteStream,
  micOn,
  camOn,
  onAccept,
  onDecline,
  onEnd,
  onToggleMic,
  onToggleCam,
}) {
  const localRef = useRef(null);
  const remoteRef = useRef(null);

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = localStream || null;
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = remoteStream || null;
  }, [remoteStream]);

  if (!callState) return null;

  return (
    <div className="call-overlay">
      <div className="call-card">
        <div className="call-remote-wrap">
          {remoteStream ? (
            <video ref={remoteRef} autoPlay playsInline className="call-remote-video" />
          ) : (
            <div className="call-waiting">
              <span className="pulse-dot" />
              {callState === "calling" && `Calling ${peerUsername}…`}
              {callState === "ringing" && `${peerUsername} is calling…`}
              {callState === "connecting" && "Connecting…"}
            </div>
          )}
          {localStream && (
            <video
              ref={localRef}
              autoPlay
              playsInline
              muted
              className="call-local-video"
            />
          )}
        </div>

        <div className="call-controls">
          {callState === "ringing" ? (
            <>
              <div className="call-btn-wrap">
                <button className="call-btn decline" onClick={onDecline} aria-label="Decline">
                  <svg className="icon" width="22" height="22"><use href="#call-end-icon" /></svg>
                </button>
                <span className="call-btn-label">Decline</span>
              </div>
              <div className="call-btn-wrap">
                <button className="call-btn accept" onClick={onAccept} aria-label="Accept">
                  <svg className="icon" width="22" height="22"><use href="#video-call-icon" /></svg>
                </button>
                <span className="call-btn-label">Accept</span>
              </div>
            </>
          ) : (
            <>
              <div className="call-btn-wrap">
                <button className="call-btn ghost" onClick={onToggleMic} aria-label={micOn ? "Mute" : "Unmute"}>
                  <svg className="icon" width="20" height="20"><use href={micOn ? "#mic-icon" : "#mic-off-icon"} /></svg>
                </button>
                <span className="call-btn-label">{micOn ? "Mute" : "Unmute"}</span>
              </div>
              <div className="call-btn-wrap">
                <button className="call-btn ghost" onClick={onToggleCam} aria-label={camOn ? "Camera off" : "Camera on"}>
                  <svg className="icon" width="20" height="20"><use href={camOn ? "#camera-icon" : "#video-off-icon"} /></svg>
                </button>
                <span className="call-btn-label">{camOn ? "Camera" : "Camera off"}</span>
              </div>
              <div className="call-btn-wrap">
                <button className="call-btn decline" onClick={onEnd} aria-label="End call">
                  <svg className="icon" width="22" height="22"><use href="#call-end-icon" /></svg>
                </button>
                <span className="call-btn-label">End</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
