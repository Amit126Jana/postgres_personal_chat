import { useEffect, useRef, useState } from "react";

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// Mesh group video call: everyone connects to everyone directly (fine up to ~8 people).
export default function GroupCallOverlay({ socket, conversationId, conversationName, myUsername, onClose }) {
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState({}); // socketId -> { username, stream }
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [status, setStatus] = useState("connecting"); // connecting | active | full | error

  const localStreamRef = useRef(null);
  const pcsRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  function makePeerConnection(remoteSocketId, remoteUsername) {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("group-call:signal", {
          toSocketId: remoteSocketId,
          signal: { type: "candidate", candidate: e.candidate },
        });
      }
    };
    pc.ontrack = (e) => {
      setPeers((prev) => ({
        ...prev,
        [remoteSocketId]: { username: remoteUsername, stream: e.streams[0] },
      }));
    };
    const stream = localStreamRef.current;
    if (stream) stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pcsRef.current.set(remoteSocketId, pc);
    return pc;
  }

  async function callPeer(remoteSocketId, remoteUsername) {
    const pc = makePeerConnection(remoteSocketId, remoteUsername);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("group-call:signal", { toSocketId: remoteSocketId, signal: { type: "offer", sdp: offer } });
  }

  function removePeer(socketId) {
    const pc = pcsRef.current.get(socketId);
    if (pc) {
      pc.close();
      pcsRef.current.delete(socketId);
    }
    setPeers((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function join() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        socket.emit("group-call:join", { conversationId });
      } catch (err) {
        console.error("Could not access camera/mic", err);
        setStatus("error");
      }
    }
    join();

    function onJoined({ participants }) {
      setStatus("active");
      // I'm the new arrival — I initiate an offer to each participant already in the room.
      participants.forEach((p) => callPeer(p.socketId, p.username));
    }

    function onPeerJoined({ socketId, username }) {
      // Existing participants wait for the newcomer's offer; just track presence.
      setPeers((prev) => ({ ...prev, [socketId]: prev[socketId] || { username, stream: null } }));
    }

    async function onSignal({ fromSocketId, signal }) {
      try {
        if (signal.type === "offer") {
          const pc = pcsRef.current.get(fromSocketId) || makePeerConnection(fromSocketId, peers[fromSocketId]?.username || "Guest");
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("group-call:signal", { toSocketId: fromSocketId, signal: { type: "answer", sdp: answer } });
        } else if (signal.type === "answer") {
          await pcsRef.current.get(fromSocketId)?.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.type === "candidate") {
          await pcsRef.current.get(fromSocketId)?.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.error("group-call signal error", err);
      }
    }

    function onPeerLeft({ socketId }) {
      removePeer(socketId);
    }

    function onFull() {
      setStatus("full");
    }

    socket.on("group-call:joined", onJoined);
    socket.on("group-call:peer-joined", onPeerJoined);
    socket.on("group-call:signal", onSignal);
    socket.on("group-call:peer-left", onPeerLeft);
    socket.on("group-call:full", onFull);

    return () => {
      cancelled = true;
      socket.off("group-call:joined", onJoined);
      socket.off("group-call:peer-joined", onPeerJoined);
      socket.off("group-call:signal", onSignal);
      socket.off("group-call:peer-left", onPeerLeft);
      socket.off("group-call:full", onFull);
      socket.emit("group-call:leave", { conversationId });
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  function toggleMic() {
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMicOn((v) => !v);
  }

  function toggleCam() {
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCamOn((v) => !v);
  }

  const remoteEntries = Object.entries(peers);
  const tileCount = remoteEntries.length + 1;

  if (status === "error") {
    return (
      <div className="call-overlay-v2">
        <div className="call-card-v2 is-audio call-error-card">
          <div className="call-v2-kicker">Group call</div>
          <div className="call-error-icon">
            <svg className="icon" width="30" height="30">
              <use href="#video-off-icon" />
            </svg>
          </div>
          <div className="call-v2-name">{conversationName}</div>
          <div className="call-error-message">
            Couldn't access your camera or microphone. Check your browser's site
            permissions and try again.
          </div>
          <div className="call-v2-controls">
            <div className="call-v2-btn-wrap">
              <button className="call-v2-btn decline" onClick={onClose} aria-label="Close">
                <svg className="icon" width="22" height="22">
                  <use href="#call-end-icon" />
                </svg>
              </button>
              <span className="call-v2-btn-label">Close</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="call-overlay-v2">
      <div className="call-card-v2 is-video group-call-card-v2">
        <div className="call-v2-kicker">Group call</div>
        <div className="group-call-title">
          {conversationName}
          {status === "connecting" && (
            <span className="group-call-title-status">
              <span className="call-v2-pulse-dot" /> connecting…
            </span>
          )}
          {status === "full" && (
            <span className="group-call-title-status warn">call is full (max 8)</span>
          )}
        </div>

        <div className={`group-call-grid tiles-${Math.min(tileCount, 9)}`}>
          <div className="group-call-tile">
            <video ref={localVideoRef} autoPlay playsInline muted className="group-call-video" />
            <span className="group-call-name">{myUsername} (you)</span>
          </div>
          {remoteEntries.map(([socketId, p]) => (
            <RemoteTile key={socketId} username={p.username} stream={p.stream} />
          ))}
        </div>

        <div className="call-v2-controls">
          <div className="call-v2-btn-wrap">
            <button
              className={`call-v2-btn ghost ${!micOn ? "is-off" : ""}`}
              onClick={toggleMic}
              aria-label={micOn ? "Mute" : "Unmute"}
            >
              <svg className="icon" width="20" height="20">
                <use href={micOn ? "#mic-icon" : "#mic-off-icon"} />
              </svg>
            </button>
            <span className="call-v2-btn-label">{micOn ? "Mute" : "Unmute"}</span>
          </div>
          <div className="call-v2-btn-wrap">
            <button
              className={`call-v2-btn ghost ${!camOn ? "is-off" : ""}`}
              onClick={toggleCam}
              aria-label={camOn ? "Camera off" : "Camera on"}
            >
              <svg className="icon" width="20" height="20">
                <use href={camOn ? "#camera-icon" : "#video-off-icon"} />
              </svg>
            </button>
            <span className="call-v2-btn-label">Camera</span>
          </div>
          <div className="call-v2-btn-wrap">
            <button className="call-v2-btn decline" onClick={onClose} aria-label="Leave call">
              <svg className="icon" width="22" height="22">
                <use href="#call-end-icon" />
              </svg>
            </button>
            <span className="call-v2-btn-label">Leave</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RemoteTile({ username, stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream || null;
  }, [stream]);
  return (
    <div className="group-call-tile">
      {stream ? (
        <video ref={ref} autoPlay playsInline className="group-call-video" />
      ) : (
        <div className="group-call-waiting">
          <span className="pulse-dot" />
          joining…
        </div>
      )}
      <span className="group-call-name">{username}</span>
    </div>
  );
}