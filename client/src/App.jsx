import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import AuthPage from "./AuthPage.jsx";
import EmojiPicker from "./EmojiPicker.jsx";
import ReactionPicker from "./ReactionPicker.jsx";
import CallOverlay from "./CallOverlay.jsx";
import GroupCallOverlay from "./GroupCallOverlay.jsx";
import NewChatModal from "./NewChatModal.jsx";
import ImageCropModal from "./ImageCropModal.jsx";
import GroupInfoPanel from "./GroupInfoPanel.jsx";
import UserProfilePanel from "./UserProfilePanel.jsx";
import IconSprite from "./Icons.jsx";
import SettingsPanel, { THEME_COLORS, resolveThemeColor } from "./SettingsPanel.jsx";
import ProfilePage from "./ProfilePage.jsx";
import GroupsPage from "./GroupsPage.jsx";
import ContactsPage from "./ContactsPage.jsx";
import GamesMenu from "./GamesMenu.jsx";
import GameOverlay from "./GameOverlay.jsx";
import PollComposer from "./PollComposer.jsx";
import PollCard from "./PollCard.jsx";
import GameHistory from "./GameHistory.jsx";
import AdminPage from "./AdminPage.jsx";
import { Client as BeamsClient, TokenProvider as BeamsTokenProvider } from "@pusher/push-notifications-web";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV
    ? "http://localhost:4000"
    : "https://personal-chat-rebx.onrender.com");

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFullDateTime(ts) {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${SERVER_URL}/api/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json(); // { mediaUrl, mediaName, type }
}

function mediaSrc(url) {
  if (!url) return url;
  return url.startsWith("http") ? url : `${SERVER_URL}${url}`;
}

function App() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState(null);
  const [joined, setJoined] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [connected, setConnected] = useState(false);
  const tokenRef = useRef(localStorage.getItem("mf_token") || "");
  const beamsClientRef = useRef(null);

  // --- Profile / account ---
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [coverUrl, setCoverUrl] = useState(null);
  const [tagline, setTagline] = useState("");
  const [themeColor, setThemeColor] = useState("violet");
  const [showOnline, setShowOnline] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeView, setActiveView] = useState("chats"); // "chats" | "profile" | "groups" | "contacts" | "settings"
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("mf_theme_mode") !== "light",
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [gamesPlayedCount, setGamesPlayedCount] = useState(0);
  const [groupAvatarUploading, setGroupAvatarUploading] = useState(false);
  const groupAvatarInputRef = useRef(null);
  const [resuming, setResuming] = useState(false); // auto-relogin in progress after a page refresh

  // --- Shared "pick photo -> crop -> confirm" flow, used by every avatar/cover picker ---
  const [cropTask, setCropTask] = useState(null); // { file, shape, aspect, onDone }
  function openCrop(file, { shape = "circle", aspect = 1, onDone }) {
    if (!file) return;
    setCropTask({ file, shape, aspect, onDone });
  }
  function pickAvatarWithCrop(file) {
    openCrop(file, { shape: "circle", onDone: handleAvatarUpload });
  }
  function pickCoverWithCrop(file) {
    openCrop(file, { shape: "rect", aspect: 16 / 9, onDone: handleCoverUpload });
  }
  function pickGroupAvatarWithCrop(conversationId, file) {
    openCrop(file, { shape: "circle", onDone: (f) => handleGroupAvatarUpload(conversationId, f) });
  }

  // --- Full-size avatar preview (lightbox) ---
  const [lightboxImage, setLightboxImage] = useState(null); // url string | null

  // --- Group Info / User Profile side panels ---
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [convInfoByConv, setConvInfoByConv] = useState({}); // { [conversationId]: { mediaCount } }

  // --- Conversations & messages ---
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messagesByConv, setMessagesByConv] = useState({}); // conversationId -> array
  const [hasMoreByConv, setHasMoreByConv] = useState({}); // conversationId -> boolean (more older messages exist)
  const [loadingOlderByConv, setLoadingOlderByConv] = useState({}); // conversationId -> boolean
  const [draft, setDraft] = useState("");
  const [typingByConv, setTypingByConv] = useState({}); // conversationId -> username | null
  const [showComposerEmoji, setShowComposerEmoji] = useState(false);
  const [openReactionPickerFor, setOpenReactionPickerFor] = useState(null);
  const [openMsgMenuFor, setOpenMsgMenuFor] = useState(null);
  const [infoPanelMsgId, setInfoPanelMsgId] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [playingReaction, setPlayingReaction] = useState(null); // { kind: "voice"|"video", url }
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatMode, setNewChatMode] = useState("direct");
  const [convSearch, setConvSearch] = useState("");
  const [convFilterTab, setConvFilterTab] = useState("all"); // "all" | "unread" | "groups"
  const [uploading, setUploading] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]); // [{ id, file, previewUrl, kind }] staged, not yet sent
  const [pendingPreview, setPendingPreview] = useState(null); // staged file currently shown large, or null
  const [mobileChatOpen, setMobileChatOpen] = useState(false); // narrow-screen nav: list vs conversation

  // --- Multi-select / delete-for-me / clear chat / wallpapers ---
  // hiddenMsgIds, clearedAt, and wallpapers are all synced from the server (see the
  // "login:success" handler below) so they persist across logout/sessions/devices —
  // not just kept in this browser's localStorage.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState(() => new Set());
  const [hiddenMsgIds, setHiddenMsgIds] = useState(() => new Set()); // Set(messageId) — "deleted for me"
  const [clearedAt, setClearedAt] = useState({}); // conversationId -> timestamp — "clear chat"
  const [wallpapers, setWallpapers] = useState({}); // { default: {type,value}|null, [conversationId]: {type,value} }
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [deleteSheet, setDeleteSheet] = useState(null); // { ids: [], canEveryone: bool }
  const [selectModeGuard, setSelectModeGuard] = useState(null); // { kind: "send" | "leave", action: () => void }
  const wallpaperFileInputRef = useRef(null);

  // --- Call state ---
  const [callState, setCallState] = useState(null); // null | "calling" | "ringing" | "connecting" | "active"
  const [callPeer, setCallPeer] = useState(null); // { id, username, avatarUrl }
  const [callType, setCallType] = useState("video"); // "audio" | "video"
  const [callRole, setCallRole] = useState(null); // "caller" | "receiver" (for UI: sender vs receiver layout)
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [callStartedAt, setCallStartedAt] = useState(null);

  // --- Group call state ---
  const [groupCallConvId, setGroupCallConvId] = useState(null);
  const [incomingGroupCall, setIncomingGroupCall] = useState(null); // { conversationId, fromUsername, conversationName }

  // --- In-chat mini-games ---
  const [showGamesMenu, setShowGamesMenu] = useState(false);
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [pollsByMessageId, setPollsByMessageId] = useState({});
  const [historyConvId, setHistoryConvId] = useState(null); // set to a conversationId, or "all", to open history modal
  const [gameSessionsByConv, setGameSessionsByConv] = useState({}); // conversationId -> live session payload
  const [openGameConvId, setOpenGameConvId] = useState(null); // which conversation's game overlay is open
  const [gameError, setGameError] = useState("");

  // --- Notifications ---
  const [toasts, setToasts] = useState([]); // { id, title, body }
  const [unreadByConv, setUnreadByConv] = useState({}); // conversationId -> count
  const notifPermissionRef = useRef(
    typeof Notification !== "undefined"
      ? Notification.permission
      : "unsupported",
  );

  const scrollRef = useRef(null);
  const pendingScrollAdjustRef = useRef(null); // { prevScrollHeight, prevScrollTop } set right before prepending older messages
  const typingTimeout = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const callPeerRef = useRef(null); // mirrors callPeer for use in socket callbacks
  const callIdRef = useRef(null); // uniquely identifies the *current* call attempt; used to
  // ignore stale signaling events left over from a previous, already-ended call.
  const callTypeRef = useRef("video");
  const pendingCandidatesRef = useRef([]); // ICE candidates buffered until remoteDescription is set
  const remoteDescSetRef = useRef(false);
  const videoDeviceIdRef = useRef(null); // deviceId of the camera currently in use (for "switch camera")
  const fileInputRef = useRef(null);
  const activeConvIdRef = useRef(null);
  const usernameRef = useRef("");
  const conversationsRef = useRef([]);

  // `auth` is a function so socket.io re-reads the latest token on every (re)connect attempt,
  // instead of freezing whatever token existed when the socket instance was first created.
  const socket = useMemo(
    () =>
      io(SERVER_URL, {
        autoConnect: false,
        auth: (cb) => cb({ token: tokenRef.current }),
      }),
    [],
  );

  useEffect(() => {
    activeConvIdRef.current = activeConvId;
    if (activeConvId) {
      setUnreadByConv((prev) => {
        if (!prev[activeConvId]) return prev;
        const next = { ...prev };
        delete next[activeConvId];
        return next;
      });
    }
  }, [activeConvId]);

  // Don't let staged-but-unsent attachments follow the user into a different chat.
  useEffect(() => {
    setPendingFiles((prev) => {
      prev.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
      return [];
    });
    setPendingPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId]);

  // Messages that arrive while the tab is backgrounded still get counted as unread
  // (see the "message" handler below), even if that conversation is the active one.
  // When the tab becomes visible again, re-clear the badge for whichever conversation
  // is currently open — otherwise it stays stuck even though the user is looking at it.
  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) return;
      const id = activeConvIdRef.current;
      if (!id) return;
      setUnreadByConv((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Apply the chosen accent color (solid or gradient) across the app.
  useEffect(() => {
    const resolved = resolveThemeColor(themeColor);
    const hex = resolved.mode === "gradient" ? resolved.from : resolved.hex;
    document.documentElement.style.setProperty("--signal", hex);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    document.documentElement.style.setProperty("--signal-rgb", `${r}, ${g}, ${b}`);
    document.documentElement.style.setProperty(
      "--signal-gradient",
      resolved.mode === "gradient"
        ? `linear-gradient(135deg, ${resolved.from}, ${resolved.to})`
        : `linear-gradient(135deg, ${hex}, ${hex})`,
    );
  }, [themeColor]);

  // Apply dark/light mode across the app.
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      darkMode ? "dark" : "light",
    );
    localStorage.setItem("mf_theme_mode", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Server pushes this account's "delete for me" / "clear chat" / wallpaper state as
  // part of the login payload (see "login:success" handler below) so it's ready before
  // messages render. Live updates after that arrive via the listeners below.
  useEffect(() => {
    function onWallpapersUpdate(payload) {
      setWallpapers(payload || {});
    }
    function onMessagesHidden({ messageIds }) {
      setHiddenMsgIds((prev) => {
        const next = new Set(prev);
        messageIds.forEach((id) => next.add(id));
        return next;
      });
    }
    function onChatCleared({ conversationId, clearedAt: ts }) {
      setClearedAt((prev) => ({ ...prev, [conversationId]: new Date(ts).getTime() }));
    }
    socket.on("wallpapers:update", onWallpapersUpdate);
    socket.on("messages:hidden", onMessagesHidden);
    socket.on("chat:cleared", onChatCleared);
    return () => {
      socket.off("wallpapers:update", onWallpapersUpdate);
      socket.off("messages:hidden", onMessagesHidden);
      socket.off("chat:cleared", onChatCleared);
    };
  }, [socket]);

  // Resume a session after a page refresh: if we have saved credentials, log back in
  // automatically instead of dropping the person back on the gate screen.
  useEffect(() => {
    if (tokenRef.current) {
      setResuming(true);
      socket.connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called once the REST /api/auth/login or /api/auth/register call succeeds.
  function handleAuthenticated(token) {
    tokenRef.current = token;
    localStorage.setItem("mf_token", token);
    setLoginError("");
    socket.connect();
  }

  // --- Cleanup helpers for calls ---
  // Fully tears down whatever call is currently in progress (if any) and resets every
  // piece of call-related state, so nothing from this call can leak into or interfere
  // with the next one. Safe to call multiple times / when there's no active call.
  function teardownCall() {
    // Invalidate this call's id first — any in-flight signal/answer callbacks still
    // resolving after this point will see a mismatched callId and no-op.
    callIdRef.current = null;

    if (pcRef.current) {
      const pc = pcRef.current;
      // Detach handlers before closing so no late/queued event from the old
      // connection can still touch React state after teardown.
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.onnegotiationneeded = null;
      try {
        pc.getSenders().forEach((s) => s.track && s.track.stop());
      } catch {
        // ignore
      }
      pc.close();
      pcRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    pendingCandidatesRef.current = [];
    remoteDescSetRef.current = false;
    videoDeviceIdRef.current = null;
    callPeerRef.current = null;
    callTypeRef.current = "video";

    setLocalStream(null);
    setRemoteStream(null);
    setCallState(null);
    setCallPeer(null);
    setCallType("video");
    setCallRole(null);
    setMicOn(true);
    setCamOn(true);
    setSpeakerOn(true);
    setCallStartedAt(null);
  }

  function createPeerConnection(remoteId, callId) {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc.onicecandidate = (e) => {
      // Guard against a trailing candidate firing after this call has already ended.
      if (e.candidate && callIdRef.current === callId) {
        socket.emit("call:signal", {
          toId: remoteId,
          callId,
          signal: { type: "candidate", candidate: e.candidate },
        });
      }
    };
    pc.ontrack = (e) => {
      if (callIdRef.current !== callId) return;
      setRemoteStream(e.streams[0]);
    };
    pc.onconnectionstatechange = () => {
      if (callIdRef.current !== callId) return;
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        teardownCall();
      }
    };
    pcRef.current = pc;
    return pc;
  }

  async function getLocalMedia(type) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: type === "audio" ? false : true,
      audio: true,
    });
    localStreamRef.current = stream;
    const vTrack = stream.getVideoTracks()[0];
    if (vTrack) videoDeviceIdRef.current = vTrack.getSettings().deviceId || null;
    setLocalStream(stream);
    return stream;
  }

  function genCallId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  // Applies any ICE candidates that arrived before the remote description was set.
  async function flushPendingCandidates(pc) {
    const queued = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Failed to add queued ICE candidate", err);
      }
    }
  }

  function startCall(toUserId, toUsername, avatarUrl, type = "video") {
    if (callState) return; // already in a call — ignore
    const callId = genCallId();
    callIdRef.current = callId;
    callTypeRef.current = type;
    setCallState("calling");
    setCallRole("caller");
    setCallType(type);
    setCallPeer({ id: toUserId, username: toUsername, avatarUrl: avatarUrl || null });
    callPeerRef.current = { id: toUserId, username: toUsername, avatarUrl: avatarUrl || null };
    socket.emit("call:invite:user", { toUserId, callId, callType: type });
  }

  async function acceptCall() {
    const peer = callPeerRef.current;
    const callId = callIdRef.current;
    if (!peer || !callId) return;
    try {
      await getLocalMedia(callTypeRef.current);
      if (callIdRef.current !== callId) return; // call was ended/replaced while awaiting media
      setCallState("connecting");
      socket.emit("call:answer", { toId: peer.id, accepted: true, callId });
    } catch (err) {
      console.error("Could not access camera/mic", err);
      socket.emit("call:answer", { toId: peer.id, accepted: false, callId });
      teardownCall();
    }
  }

  function declineCall() {
    const peer = callPeerRef.current;
    const callId = callIdRef.current;
    if (peer) socket.emit("call:answer", { toId: peer.id, accepted: false, callId });
    teardownCall();
  }

  function endCall() {
    const peer = callPeerRef.current;
    const callId = callIdRef.current;
    if (peer) socket.emit("call:end", { toId: peer.id, callId });
    teardownCall();
  }

  // Cycles to the next available camera (front/back on mobile, or between webcams on
  // desktop) mid-call by swapping the outgoing video track on the existing peer connection.
  async function switchCamera() {
    if (!localStreamRef.current || callTypeRef.current !== "video") return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      if (cams.length < 2) return;
      const currentIdx = cams.findIndex((d) => d.deviceId === videoDeviceIdRef.current);
      const next = cams[(currentIdx + 1 + cams.length) % cams.length];
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: next.deviceId } },
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;

      const oldTrack = localStreamRef.current.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((s) => s.track && s.track.kind === "video");
      if (sender) await sender.replaceTrack(newTrack);

      newTrack.enabled = camOn;
      localStreamRef.current.removeTrack(oldTrack);
      localStreamRef.current.addTrack(newTrack);
      oldTrack.stop();
      videoDeviceIdRef.current = next.deviceId;
      // Re-trigger the <video> binding effect in CallOverlay with the (same) stream object.
      setLocalStream(localStreamRef.current);
    } catch (err) {
      console.error("Failed to switch camera", err);
    }
  }

  // Purely a UI/UX affordance for now (there's no separate "speaker" output device to
  // pick on most desktop browsers) — flips the label/icon and, where supported, tries
  // to route audio to the loudspeaker via setSinkId.
  function toggleSpeaker() {
    setSpeakerOn((v) => !v);
  }

  function pushToast(title, body) {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, body }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }

  function notifyNewMessage(conv, msg) {
    const title =
      conv?.type === "group" ? `${msg.username} in ${conv.name}` : msg.username;
    const body =
      msg.type === "text"
        ? msg.text
        : msg.type === "image"
          ? "📷 sent a photo"
          : msg.type === "video"
            ? "🎬 sent a video"
            : msg.type === "audio"
              ? "🎤 sent audio"
              : "📎 sent a file";

    pushToast(title, body);

    if (notifPermissionRef.current === "granted") {
      try {
        new Notification(title, { body });
      } catch {
        // ignore — some browsers restrict Notification outside a user gesture
      }
    }
  }

  // Reaction "emoji" values can carry a kind prefix (see ReactionPicker), e.g.
  // "voice:<url>" or "video:<url>" for sticker-style audio/video reactions,
  // plain emoji/sticker characters otherwise.
  function labelForReactionKey(key) {
    const sepIdx = key.indexOf(":");
    const kind = sepIdx === -1 ? "emoji" : key.slice(0, sepIdx);
    if (kind === "voice") return "🎙️ a voice reaction";
    if (kind === "video") return "🎥 a video reaction";
    return key; // plain emoji or sticker character
  }

  function notifyReaction({ conversationId, emoji, fromUsername }) {
    const conv = conversationsRef.current.find((c) => c.id === conversationId);
    const title = conv?.type === "group" ? `${fromUsername} in ${conv.name}` : fromUsername;
    const body = `reacted ${labelForReactionKey(emoji)} to your message`;

    pushToast(title, body);

    if (notifPermissionRef.current === "granted") {
      try {
        new Notification(title, { body });
      } catch {
        // ignore — some browsers restrict Notification outside a user gesture
      }
    }
  }

  function toggleMic() {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMicOn((v) => !v);
  }

  function toggleCam() {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCamOn((v) => !v);
  }

  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on(
      "login:success",
      ({
        userId: uid,
        username: confirmedName,
        phoneNumber: confirmedPhone,
        avatarUrl: aUrl,
        coverUrl: cUrl,
        tagline: tl,
        themeColor: tc,
        showOnline: so,
        wallpapers: serverWallpapers,
        hiddenMessageIds,
        clearedChats,
        isAdmin: adminFlag,
      }) => {
        setLoginError("");
        setResuming(false);
        setUserId(uid);
        setUsername(confirmedName);
        setPhoneNumber(confirmedPhone);
        setAvatarUrl(aUrl || null);
        setCoverUrl(cUrl || null);
        setTagline(tl || "");
        setThemeColor(tc || "violet");
        setShowOnline(so !== false);
        setIsAdmin(!!adminFlag);
        setWallpapers(serverWallpapers || {});
        setHiddenMsgIds(new Set(hiddenMessageIds || []));
        const clearedTimestamps = {};
        for (const convId of Object.keys(clearedChats || {})) {
          clearedTimestamps[convId] = new Date(clearedChats[convId]).getTime();
        }
        setClearedAt(clearedTimestamps);
        setJoined(true);
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "default"
        ) {
          Notification.requestPermission().then((perm) => {
            notifPermissionRef.current = perm;
          });
        }
      },
    );

    socket.on(
      "profile:updated",
      ({
        username: uName,
        avatarUrl: aUrl,
        coverUrl: cUrl,
        tagline: tl,
        themeColor: tc,
        showOnline: so,
      }) => {
        setUsername(uName);
        setAvatarUrl(aUrl || null);
        setCoverUrl(cUrl || null);
        setTagline(tl || "");
        setThemeColor(tc || "violet");
        setShowOnline(so !== false);
        pushToast("Profile updated", "Your changes were saved.");
      },
    );

    socket.on("profile:error", (msg) => {
      pushToast("Couldn't save profile", msg || "Please try again.");
    });

    socket.on("login:error", (msg) => {
      setResuming(false);
      setLoginError(msg || "Login failed. Please try again.");
      tokenRef.current = "";
      localStorage.removeItem("mf_token");
      socket.disconnect();
    });

    // Fires when the socket.io handshake itself is rejected — e.g. an expired or invalid
    // JWT (server sends `unauthorized`) — OR on plain network/connection failures (timeouts,
    // transport errors, server cold-starting). Only the former means the user is actually
    // logged out; the latter is transient and socket.io will keep retrying on its own, so we
    // must not wipe a still-valid token just because a connection attempt briefly failed.
    socket.on("connect_error", (err) => {
      setResuming(false);
      if (err?.message === "unauthorized" || err?.message === "suspended") {
        setJoined(false);
        setLoginError(
          err.message === "suspended"
            ? "This account has been suspended."
            : "Your session expired. Please log in again."
        );
        tokenRef.current = "";
        localStorage.removeItem("mf_token");
      }
      // else: transient network issue — leave the token intact and let socket.io retry.
    });

    // Live online/offline status for anyone sharing a conversation with me.
    socket.on("presence:update", ({ userId: uid, online }) => {
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          members: (c.members || []).map((m) => (m.id === uid ? { ...m, online } : m)),
        })),
      );
    });

    // Initial conversation list on login.
    socket.on("conversations", (list) => {
      setConversations(list);
      // Intentionally do NOT auto-select the first conversation here — on login/reload
      // the person should land on the "Start a conversation" screen, not jump straight
      // into whichever chat they last had open.
    });

    // A conversation was created/updated (new DM or group involving me).
    socket.on("conversation:new", (conv) => {
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conv.id);
        return exists
          ? prev.map((c) => (c.id === conv.id ? conv : c))
          : [conv, ...prev];
      });
      setActiveConvId((prev) => prev ?? conv.id);
    });

    socket.on("conversation:history", ({ conversationId, messages }) => {
      setMessagesByConv((prev) => ({
        ...prev,
        [conversationId]: messages.map((m) => ({ ...m, reactions: {} })),
      }));
      // The initial batch is capped at 50 server-side (see getMessages default limit).
      // A shorter batch means we've already got the whole history for this conversation.
      setHasMoreByConv((prev) => ({ ...prev, [conversationId]: messages.length >= 50 }));
      messages
        .filter((m) => m.type === "poll")
        .forEach((m) => socket.emit("poll:sync", { messageId: m.id }));
    });

    socket.on("message", (msg) => {
      setMessagesByConv((prev) => {
        const existing = prev[msg.conversationId] || [];
        return {
          ...prev,
          [msg.conversationId]: [...existing, { ...msg, reactions: {} }],
        };
      });

      const isMine = msg.username === usernameRef.current;
      const isActive =
        msg.conversationId === activeConvIdRef.current && !document.hidden;
      if (!isMine && !isActive) {
        setUnreadByConv((prev) => ({
          ...prev,
          [msg.conversationId]: (prev[msg.conversationId] || 0) + 1,
        }));
        const conv = conversationsRef.current.find(
          (c) => c.id === msg.conversationId,
        );
        notifyNewMessage(conv, msg);
      }
    });

    socket.on("message:update", (msg) => {
      setMessagesByConv((prev) => {
        const existing = prev[msg.conversationId] || [];
        return {
          ...prev,
          [msg.conversationId]: existing.map((m) =>
            m.id === msg.id ? { ...m, ...msg, reactions: m.reactions } : m,
          ),
        };
      });
    });

    socket.on("messages:seen", ({ conversationId, messageIds }) => {
      setMessagesByConv((prev) => {
        const existing = prev[conversationId] || [];
        const idSet = new Set(messageIds);
        return {
          ...prev,
          [conversationId]: existing.map((m) =>
            idSet.has(m.id) ? { ...m, seenAt: m.seenAt || new Date().toISOString() } : m,
          ),
        };
      });
    });

    socket.on("messages:delivered", ({ conversationId, messageIds }) => {
      setMessagesByConv((prev) => {
        const existing = prev[conversationId] || [];
        const idSet = new Set(messageIds);
        return {
          ...prev,
          [conversationId]: existing.map((m) =>
            idSet.has(m.id) ? { ...m, deliveredAt: m.deliveredAt || new Date().toISOString() } : m,
          ),
        };
      });
    });

    socket.on("group:avatar:updated", ({ conversationId, avatarUrl }) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, avatarUrl } : c)),
      );
    });

    socket.on("group:renamed", ({ conversationId, name }) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, name } : c)),
      );
    });

    // A group I'm in was renamed / got new members / etc.
    socket.on("conversation:updated", (conv) => {
      if (!conv) return;
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conv.id);
        return exists
          ? prev.map((c) => (c.id === conv.id ? conv : c))
          : [conv, ...prev];
      });
    });

    // A group was deleted, or I left/was removed from it — drop it from my list.
    socket.on("conversation:deleted", ({ conversationId }) => {
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      setActiveConvId((prev) => (prev === conversationId ? null : prev));
      setShowGroupInfo(false);
      setShowUserInfo(false);
    });

    socket.on("conversation:info", ({ conversationId, mediaCount }) => {
      setConvInfoByConv((prev) => ({ ...prev, [conversationId]: { mediaCount } }));
    });

    socket.on("message:error", ({ message: msg }) => {
      setGameError(msg);
      setTimeout(() => setGameError(""), 4000);
    });

    socket.on("game:session", (payload) => {
      setGameSessionsByConv((prev) => ({ ...prev, [payload.conversationId]: payload }));
    });

    socket.on("game:error", ({ message: msg }) => {
      setGameError(msg);
      setTimeout(() => setGameError(""), 4000);
    });

    socket.on("poll:update", (poll) => {
      setPollsByMessageId((prev) => ({ ...prev, [poll.messageId]: poll }));
    });

    socket.on("poll:error", ({ message: msg }) => {
      setGameError(msg);
      setTimeout(() => setGameError(""), 4000);
    });

    socket.on("group-call:incoming", ({ conversationId, fromUsername }) => {
      const conv = conversationsRef.current.find(
        (c) => c.id === conversationId,
      );
      setIncomingGroupCall({
        conversationId,
        fromUsername,
        conversationName: conv?.name || "Group call",
      });
      pushToast(`${fromUsername} started a group call`, conv?.name || "");
    });

    socket.on("typing", ({ conversationId, username: who, isTyping }) => {
      setTypingByConv((prev) => ({
        ...prev,
        [conversationId]: isTyping ? who : null,
      }));
      if (isTyping) {
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => {
          setTypingByConv((prev) => ({ ...prev, [conversationId]: null }));
        }, 2500);
      }
    });

    socket.on("reaction", ({ messageId, reactions }) => {
      setMessagesByConv((prev) => {
        const next = { ...prev };
        for (const convId of Object.keys(next)) {
          next[convId] = next[convId].map((m) =>
            m.id === messageId ? { ...m, reactions } : m,
          );
        }
        return next;
      });
    });

    // Someone reacted (emoji, sticker, voice, or video reaction) to one of my messages.
    socket.on("reaction:notify", (payload) => {
      notifyReaction(payload);
    });

    // --- Call signaling ---
    // Every event below carries the `callId` the sender attached at call:invite time.
    // We check it against callIdRef/callPeerRef before acting, so a stale event from a
    // call that has since ended (declined, hung up, replaced by a new call) is ignored
    // instead of corrupting the state of whatever call is happening now.
    socket.on("call:invite", ({ fromId, fromUsername, callId, callType: incomingType }) => {
      if (callPeerRef.current) {
        // Already in (or setting up) a call — decline any other incoming invite so the
        // two calls' state never mix.
        socket.emit("call:answer", { toId: fromId, accepted: false, callId });
        return;
      }
      const peerAvatar = peerAvatarByUserId(fromId);
      callIdRef.current = callId;
      callTypeRef.current = incomingType === "audio" ? "audio" : "video";
      setCallState("ringing");
      setCallRole("receiver");
      setCallType(callTypeRef.current);
      setCallPeer({ id: fromId, username: fromUsername, avatarUrl: peerAvatar });
      callPeerRef.current = { id: fromId, username: fromUsername, avatarUrl: peerAvatar };
    });

    socket.on("call:answer", async ({ fromId, accepted, callId }) => {
      // Ignore answers that don't belong to the call we're currently placing. Note: we
      // only compare callId here, not the peer id — as the caller, callPeerRef.current.id
      // is still the callee's persistent *userId* (that's all we knew at invite time),
      // while `fromId` on every event after that is their live *socket id*. Those are
      // different id spaces by design, so callId (unique per call attempt) is the only
      // safe thing to match on.
      if (callId !== callIdRef.current) return;
      // Now that the callee has responded, learn their live socket id so any further
      // messages we send (end, decline-ack, etc.) reach them directly.
      if (callPeerRef.current) callPeerRef.current = { ...callPeerRef.current, id: fromId };
      if (!accepted) {
        teardownCall();
        return;
      }
      try {
        const stream = await getLocalMedia(callTypeRef.current);
        if (callId !== callIdRef.current) return; // ended while awaiting getUserMedia
        const pc = createPeerConnection(fromId, callId);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:signal", {
          toId: fromId,
          callId,
          signal: { type: "offer", sdp: offer },
        });
        setCallState("connecting");
      } catch (err) {
        console.error("Failed to start call", err);
        teardownCall();
      }
    });

    socket.on("call:signal", async ({ fromId, signal, callId }) => {
      // Drop any signal that isn't part of the call we're currently in — this is what
      // stops a stale offer/answer/candidate (e.g. from a call that was just hung up)
      // from ever being applied to a new call's peer connection. As above, we match on
      // callId only, since `fromId` here is a live socket id that won't equal a
      // caller-side callPeerRef.current.id captured as a persistent userId.
      if (!callId || callId !== callIdRef.current) return;
      // Keep the peer's live socket id current so end/decline can always reach them.
      if (callPeerRef.current) callPeerRef.current = { ...callPeerRef.current, id: fromId };
      try {
        if (signal.type === "offer") {
          const pc = pcRef.current || createPeerConnection(fromId, callId);
          const stream = localStreamRef.current;
          if (stream)
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          remoteDescSetRef.current = true;
          await flushPendingCandidates(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("call:signal", {
            toId: fromId,
            callId,
            signal: { type: "answer", sdp: answer },
          });
          setCallState("active");
          setCallStartedAt(Date.now());
        } else if (signal.type === "answer") {
          if (!pcRef.current) return;
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          remoteDescSetRef.current = true;
          await flushPendingCandidates(pcRef.current);
          setCallState("active");
          setCallStartedAt(Date.now());
        } else if (signal.type === "candidate") {
          if (!pcRef.current) return;
          if (remoteDescSetRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            // Remote description isn't set yet — buffer it, flushed once it is.
            pendingCandidatesRef.current.push(signal.candidate);
          }
        }
      } catch (err) {
        console.error("Signal handling failed", err);
      }
    });

    socket.on("call:end", ({ callId }) => {
      // Only tear down if this "end" belongs to the call currently in progress. Matching
      // on callId alone (rather than also checking fromId against callPeerRef.current.id)
      // is what lets this fire correctly regardless of which side — caller or callee —
      // is the one hanging up, since the two sides don't share a common id space for
      // the peer until an answer/signal has been exchanged.
      if (!callIdRef.current) return;
      if (callId && callId !== callIdRef.current) return;
      teardownCall();
    });

    return () => {
      socket.off();
      socket.disconnect();
      teardownCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch history whenever the active conversation changes and we don't have it cached yet.
  useEffect(() => {
    if (!activeConvId) return;
    if (!messagesByConv[activeConvId]) {
      socket.emit("conversation:history", { conversationId: activeConvId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId]);

  // Warn on actual tab close/refresh while messages are selected (browser-native prompt).
  useEffect(() => {
    function onBeforeUnload(e) {
      if (!selectMode) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [selectMode]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (pendingScrollAdjustRef.current) {
      // We just prepended older messages — keep the same messages in view instead of
      // jumping to the bottom, by re-adding however much the content height grew.
      const { prevScrollHeight, prevScrollTop } = pendingScrollAdjustRef.current;
      el.scrollTop = prevScrollTop + (el.scrollHeight - prevScrollHeight);
      pendingScrollAdjustRef.current = null;
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messagesByConv, activeConvId]);

  // Loads the next batch of older messages for a conversation (scroll-up pagination)
  // and splices them onto the front of the already-loaded list, preserving the
  // user's current scroll position so the view doesn't jump.
  async function loadOlderMessages(conversationId) {
    if (!conversationId) return;
    if (loadingOlderByConv[conversationId]) return;
    if (hasMoreByConv[conversationId] === false) return;
    const current = messagesByConv[conversationId] || [];
    const oldest = current[0];
    if (!oldest) return;

    setLoadingOlderByConv((prev) => ({ ...prev, [conversationId]: true }));
    try {
      const res = await fetch(
        `${SERVER_URL}/api/conversations/${conversationId}/messages?before=${oldest.id}&limit=30`,
        { headers: { Authorization: `Bearer ${tokenRef.current}` } },
      );
      if (!res.ok) throw new Error("Failed to load older messages");
      const older = await res.json();

      const el = scrollRef.current;
      if (el) {
        pendingScrollAdjustRef.current = {
          prevScrollHeight: el.scrollHeight,
          prevScrollTop: el.scrollTop,
        };
      }

      setMessagesByConv((prev) => ({
        ...prev,
        [conversationId]: [
          ...older.map((m) => ({ ...m, reactions: {} })),
          ...(prev[conversationId] || []),
        ],
      }));
      setHasMoreByConv((prev) => ({ ...prev, [conversationId]: older.length >= 30 }));
    } catch (err) {
      console.error("loadOlderMessages failed:", err.message);
    } finally {
      setLoadingOlderByConv((prev) => ({ ...prev, [conversationId]: false }));
    }
  }

  // Fires while scrolling the message feed — triggers loading older messages once
  // the user scrolls near the top.
  function handleFeedScroll(e) {
    if (e.currentTarget.scrollTop < 80) {
      loadOlderMessages(activeConvId);
    }
  }

  function actuallySendDraft(text) {
    socket.emit("message", {
      conversationId: activeConvId,
      text,
      type: "text",
    });
    setDraft("");
    socket.emit("typing", { conversationId: activeConvId, isTyping: false });
  }

  function handleSend(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text && pendingFiles.length === 0) return;
    if (!activeConvId) return;
    if (selectMode) {
      setSelectModeGuard({
        kind: "send",
        action: () => {
          if (pendingFiles.length > 0) sendPendingFiles();
          if (text) actuallySendDraft(text);
        },
      });
      return;
    }
    if (pendingFiles.length > 0) sendPendingFiles();
    if (text) actuallySendDraft(text);
  }

  // Runs `action` immediately, unless we're in message-select mode, in which
  // case it opens a themed confirm dialog first (sending / navigating away
  // both clear the current selection).
  function runOrConfirmLeaveSelect(action, kind = "leave") {
    if (selectMode) {
      setSelectModeGuard({ kind, action });
    } else {
      action();
    }
  }

  function handleDraftChange(e) {
    setDraft(e.target.value);
    if (!activeConvId) return;
    socket.emit("typing", { conversationId: activeConvId, isTyping: true });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(
      () =>
        socket.emit("typing", {
          conversationId: activeConvId,
          isTyping: false,
        }),
      1200,
    );
  }

  function insertEmojiIntoDraft(emoji) {
    setDraft((prev) => prev + emoji);
    setShowComposerEmoji(false);
  }

  function sendReaction(messageId, emoji) {
    if (!activeConvId) return;
    socket.emit("reaction", { conversationId: activeConvId, messageId, emoji });
    setOpenReactionPickerFor(null);
  }

  function inviteToGame(gameType) {
    if (!activeConvId) return;
    socket.emit("game:invite", { conversationId: activeConvId, gameType });
    setShowGamesMenu(false);
    setOpenGameConvId(activeConvId);
  }

  function createPoll({ question, options, allowMultiple }) {
    if (!activeConvId) return;
    socket.emit("poll:create", { conversationId: activeConvId, question, options, allowMultiple });
    setShowPollComposer(false);
  }

  function votePoll(pollId, optionIndex) {
    if (!activeConvId) return;
    socket.emit("poll:vote", { conversationId: activeConvId, pollId, optionIndex });
  }

  function closePoll(pollId) {
    if (!activeConvId) return;
    socket.emit("poll:close", { conversationId: activeConvId, pollId });
  }

  function rematchGame(session) {
    socket.emit("game:invite", {
      conversationId: session.conversationId,
      gameType: session.type,
    });
    setOpenGameConvId(session.conversationId);
  }

  function gameMove(move) {
    if (!activeConvId) return;
    socket.emit("game:move", { conversationId: activeConvId, move });
  }

  function gameAccept() {
    if (!activeConvId) return;
    socket.emit("game:accept", { conversationId: activeConvId });
  }

  function gameDecline() {
    if (!activeConvId) return;
    socket.emit("game:decline", { conversationId: activeConvId });
    setOpenGameConvId(null);
  }

  function gameCancel() {
    if (!activeConvId) return;
    socket.emit("game:cancel", { conversationId: activeConvId });
    setOpenGameConvId(null);
  }

  function gameForfeit() {
    if (!activeConvId) return;
    socket.emit("game:forfeit", { conversationId: activeConvId });
  }

  function kindForFile(file) {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "file";
  }

  // Adds files to the staging area (shown as previews in the composer) instead of
  // uploading/sending immediately. The user reviews them and hits Send.
  function stageFiles(files) {
    if (!files || files.length === 0 || !activeConvId) return;
    const staged = files.map((file) => {
      const kind = kindForFile(file);
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        kind,
        previewUrl: kind === "image" || kind === "video" ? URL.createObjectURL(file) : null,
      };
    });
    setPendingFiles((prev) => [...prev, ...staged]);
  }

  function removePendingFile(id) {
    setPendingFiles((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
    setPendingPreview((prev) => (prev?.id === id ? null : prev));
  }

  function clearPendingFiles() {
    setPendingFiles((prev) => {
      prev.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
      return [];
    });
    setPendingPreview(null);
  }

  // Actually uploads + sends every staged file, in the order they were added.
  async function sendPendingFiles() {
    if (pendingFiles.length === 0 || !activeConvId) return;
    setUploading(true);
    try {
      for (const { file } of pendingFiles) {
        try {
          const { mediaUrl, mediaName, type } = await uploadFile(file);
          socket.emit("message", {
            conversationId: activeConvId,
            type,
            mediaUrl,
            mediaName,
          });
        } catch (err) {
          console.error("Upload failed", err);
          alert(`Couldn't send "${file.name || "file"}". Please try a smaller file (max 25MB).`);
        }
      }
    } finally {
      setUploading(false);
      clearPendingFiles();
    }
  }

  async function handleFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    stageFiles([file]);
  }

  // Pasting an image/video/audio/file (e.g. Ctrl+V after copying an image) stages it
  // as a preview in the composer, same as picking it via the attach button — it isn't
  // sent until the user hits Send.
  function handleComposerPaste(e) {
    const items = e.clipboardData?.items;
    if (!items || !activeConvId) return;
    const files = Array.from(items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter(Boolean);
    if (files.length === 0) return; // plain text paste — let the browser handle it normally
    e.preventDefault();
    stageFiles(files);
  }

  // Dragging a file in from the OS (e.g. a folder window) anywhere over the chat pane
  // stages it as a preview — it isn't sent until the user hits Send.
  function handleFeedDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer.types?.includes("Files")) setIsDraggingFile(true);
  }

  function handleFeedDragLeave(e) {
    // Only clear when actually leaving the pane, not when moving between its children.
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDraggingFile(false);
  }

  function handleFeedDrop(e) {
    e.preventDefault();
    setIsDraggingFile(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0 || !activeConvId) return;
    stageFiles(files);
  }

  function startDirectChat(otherUserId) {
    socket.emit("conversation:direct", { withUserId: otherUserId });
    setShowNewChat(false);
  }

  async function startGroupChat(name, memberIds, avatarFile) {    let avatarUrl = null;
    if (avatarFile) {
      try {
        const { mediaUrl } = await uploadFile(avatarFile);
        avatarUrl = mediaSrc(mediaUrl);
      } catch (err) {
        console.error("Group avatar upload failed", err);
        pushToast("Upload failed", "Group was created without a photo — try changing it from the chat.");
      }
    }
    socket.emit("conversation:group", { name, memberIds, avatarUrl });
    setShowNewChat(false);
  }

  function saveProfile({
    username: newName,
    tagline: newTagline,
    themeColor: newTheme,
    showOnline: newShowOnline,
  }) {
    socket.emit("profile:update", {
      username: newName,
      tagline: newTagline,
      themeColor: newTheme,
      showOnline: newShowOnline,
    });
  }

  async function handleDeleteAccount() {
    try {
      const res = await fetch(`${SERVER_URL}/api/account`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not delete your account.");
      }
      logout();
    } catch (err) {
      pushToast("Couldn't delete account", err.message || "Please try again.");
    }
  }

  async function handleAvatarUpload(file) {
    setAvatarUploading(true);
    try {
      const { mediaUrl } = await uploadFile(file);
      const fullUrl = mediaSrc(mediaUrl);
      socket.emit("profile:update", { avatarUrl: fullUrl });
    } catch (err) {
      console.error("Avatar upload failed", err);
      pushToast("Upload failed", "Please try a smaller image.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleCoverUpload(file) {
    setAvatarUploading(true);
    try {
      const { mediaUrl } = await uploadFile(file);
      const fullUrl = mediaSrc(mediaUrl);
      socket.emit("profile:update", { coverUrl: fullUrl });
    } catch (err) {
      console.error("Cover upload failed", err);
      pushToast("Upload failed", "Please try a smaller image.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleGroupAvatarUpload(conversationId, file) {
    setGroupAvatarUploading(true);
    try {
      const { mediaUrl } = await uploadFile(file);
      const fullUrl = mediaSrc(mediaUrl);
      socket.emit("group:avatar", { conversationId, avatarUrl: fullUrl });
    } catch (err) {
      console.error("Group avatar upload failed", err);
      pushToast("Upload failed", "Please try a smaller image.");
    } finally {
      setGroupAvatarUploading(false);
    }
  }

  // Real push notifications (Pusher Beams) — arrive even when this tab/app is fully
  // closed, as long as the device has internet. Starts once logged in, stops on logout.
  // No-ops quietly if VITE_BEAMS_INSTANCE_ID isn't set, the browser doesn't support
  // service workers, or the page isn't served over HTTPS (all required for web push).
  useEffect(() => {
    if (activeView !== "profile" || !joined || !tokenRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/games/history`, {
          headers: { Authorization: `Bearer ${tokenRef.current}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setGamesPlayedCount(Array.isArray(data) ? data.length : 0);
      } catch {
        // Non-critical stat — leave the previous count if the fetch fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeView, joined]);

  useEffect(() => {
    const instanceId = import.meta.env.VITE_BEAMS_INSTANCE_ID;
    if (!joined || !userId || !instanceId) return;
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    let cancelled = false;
    (async () => {
      try {
        const client = new BeamsClient({ instanceId });
        const tokenProvider = new BeamsTokenProvider({
          url: `${SERVER_URL}/pusher/beams-auth`,
          headers: { Authorization: `Bearer ${tokenRef.current}` },
        });
        await client.start();
        if (cancelled) return;
        await client.setUserId(String(userId), tokenProvider);
        beamsClientRef.current = client;
      } catch (err) {
        // Most common cause: the user hasn't granted notification permission yet, or
        // denied it. Not an error worth surfacing to them.
        console.warn("Push notification setup skipped:", err.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [joined, userId]);

  function logout() {
    tokenRef.current = "";
    localStorage.removeItem("mf_token");
    teardownCall();
    socket.disconnect();
    if (beamsClientRef.current) {
      beamsClientRef.current.stop().catch(() => {});
      beamsClientRef.current = null;
    }
    setJoined(false);
    setUserId(null);
    setPhoneNumber("");
    setUsername("");
    setAvatarUrl(null);
    setTagline("");
    setThemeColor("violet");
    setIsAdmin(false);
    setConversations([]);
    setMessagesByConv({});
    setActiveConvId(null);
    setActiveView("chats");
  }

  const activeConv = conversations.find((c) => c.id === activeConvId) || null;
  const activeMessagesRaw = messagesByConv[activeConvId] || [];
  const clearedAtActiveConv = clearedAt[activeConvId] || 0;
  const activeMessages = activeMessagesRaw.filter((m) => {
    if (hiddenMsgIds.has(m.id)) return false;
    if (clearedAtActiveConv && new Date(m.createdAt || m.timestamp).getTime() <= clearedAtActiveConv) return false;
    return true;
  });
  const typingUser = typingByConv[activeConvId];

  // Wallpaper this chat should show: its own choice, else the account-wide default.
  const activeWallpaper = activeConvId
    ? wallpapers[activeConvId] || wallpapers.default || null
    : null;
  const feedBackgroundStyle = (() => {
    if (!activeWallpaper) return {};
    if (activeWallpaper.type === "image") {
      return {
        backgroundImage: `url(${mediaSrc(activeWallpaper.value)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    return { background: activeWallpaper.value };
  })();

  function toggleSelectMsg(id) {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startSelectMode(seedMsgId) {
    setSelectMode(true);
    setOpenMsgMenuFor(null);
    setShowChatMenu(false);
    setSelectedMsgIds(seedMsgId != null ? new Set([seedMsgId]) : new Set());
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedMsgIds(new Set());
  }

  // Opens the "Delete for me / Delete for everyone" choice sheet for one or many messages.
  function openDeleteSheet(ids) {
    const msgs = ids.map((id) => activeMessages.find((m) => m.id === id)).filter(Boolean);
    const canEveryone = msgs.length > 0 && msgs.every((m) => canDeleteMessage(m));
    setDeleteSheet({ ids, canEveryone });
  }

  function confirmDeleteForMe() {
    if (!deleteSheet) return;
    socket.emit("messages:deleteForMe", { messageIds: deleteSheet.ids });
    // Optimistic local update; the server also echoes back "messages:hidden".
    setHiddenMsgIds((prev) => {
      const next = new Set(prev);
      deleteSheet.ids.forEach((id) => next.add(id));
      return next;
    });
    setDeleteSheet(null);
    exitSelectMode();
  }

  function confirmDeleteForEveryone() {
    if (!deleteSheet) return;
    deleteSheet.ids.forEach((id) => {
      const m = activeMessages.find((mm) => mm.id === id);
      if (m) socket.emit("message:delete", { conversationId: m.conversationId, messageId: id });
    });
    setDeleteSheet(null);
    exitSelectMode();
  }

  function requestClearChat() {
    setShowChatMenu(false);
    if (!activeConvId) return;
    if (!window.confirm("Clear all messages in this chat? This only clears it for you.")) return;
    socket.emit("chat:clear", { conversationId: activeConvId });
    // Optimistic local update; the server also echoes back "chat:cleared".
    setClearedAt((prev) => ({ ...prev, [activeConvId]: Date.now() }));
  }

  function openInfoPanel() {
    setShowChatMenu(false);
    if (!activeConvId) return;
    socket.emit("conversation:info", { conversationId: activeConvId });
    if (activeConv?.type === "group") setShowGroupInfo(true);
    else setShowUserInfo(true);
  }

  function requestDeleteGroup(conversationId) {
    setShowChatMenu(false);
    if (!conversationId) return;
    if (
      !window.confirm(
        "Delete this group for everyone? All messages, media, and shared files will be permanently deleted. This can't be undone.",
      )
    )
      return;
    socket.emit("group:delete", { conversationId });
  }

  function requestLeaveGroup(conversationId) {
    setShowChatMenu(false);
    if (!conversationId) return;
    if (!window.confirm("Leave this group? You'll stop receiving messages from it.")) return;
    socket.emit("group:leave", { conversationId });
  }

  async function handleWallpaperFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { mediaUrl } = await uploadFile(file);
      socket.emit("wallpaper:set", { conversationId: activeConvId, type: "image", value: mediaUrl });
    } catch {
      window.alert("Couldn't upload that image.");
    }
  }

  function applyWallpaperPreset(preset, applyToAll) {
    socket.emit("wallpaper:set", {
      conversationId: applyToAll ? null : activeConvId,
      type: preset.type,
      value: preset.value,
    });
  }

  function clearWallpaperChoice(applyToAll) {
    socket.emit("wallpaper:clear", { conversationId: applyToAll ? null : activeConvId });
  }

  // Find the live socket id of the other member of a direct chat, for video-calling them.
  function otherMemberOf(conv) {
    if (!conv || conv.type !== "direct") return null;
    return conv.members?.find((m) => m.id !== userId) || null;
  }

  function renameGroup(conversationId, name) {
    socket.emit("group:rename", { conversationId, name });
  }

  function addGroupMember(conversationId, userId) {
    socket.emit("group:addMember", { conversationId, userId });
  }

  function removeGroupMember(conversationId, userId) {
    if (!window.confirm("Remove this member from the group?")) return;
    socket.emit("group:removeMember", { conversationId, userId });
  }

  function setGroupMemberRole(conversationId, userId, role) {
    socket.emit("group:setRole", { conversationId, userId, role });
  }

  async function handleBlockUser(otherUserId) {
    try {
      const res = await fetch(`${SERVER_URL}/api/blocked/${otherUserId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (!res.ok) throw new Error("Block failed");
      pushToast("User blocked", "You won't receive messages or calls from them.");
      setShowUserInfo(false);
    } catch (err) {
      pushToast("Couldn't block user", err.message || "Please try again.");
    }
  }

  // Best-effort avatar lookup for an incoming call, before we have anything richer than
  // the caller's userId — scans our existing direct conversations for a match.
  function peerAvatarByUserId(otherUserId) {
    const conv = conversationsRef.current.find(
      (c) => c.type === "direct" && c.members?.some((m) => m.id === otherUserId),
    );
    return conv?.avatarUrl || null;
  }

  const groupConversations = conversations.filter((c) => c.type === "group");
  const contactList = conversations
    .filter((c) => c.type === "direct")
    .map((c) => {
      const other = otherMemberOf(c);
      return {
        id: c.id,
        name: c.name,
        otherId: other?.id || null,
        online: !!other?.online,
        avatarUrl: c.avatarUrl || null,
      };
    });

  // Mirrors the server's edit/delete window rules, purely to show/hide buttons —
  // the server re-checks everything and is the real source of truth.
  const EDIT_DELETE_WINDOW_MS = 60 * 60 * 1000;
  const ADMIN_DELETE_WINDOW_MS = 24 * 60 * 60 * 1000;

  function ownerCanModify(m) {
    if (m.username !== username) return false;
    if (!m.seenAt) return true;
    return Date.now() - new Date(m.seenAt).getTime() <= EDIT_DELETE_WINDOW_MS;
  }

  function adminCanDelete(m) {
    if (!activeConv || activeConv.type !== "group" || !activeConv.myIsAdmin) return false;
    return Date.now() - new Date(m.createdAt).getTime() <= ADMIN_DELETE_WINDOW_MS;
  }

  function canEditMessage(m) {
    return m.type === "text" && !m.deleted && ownerCanModify(m);
  }

  function canDeleteMessage(m) {
    if (m.deleted) return false;
    return ownerCanModify(m) || adminCanDelete(m);
  }

  function startEditMessage(m) {
    setEditingMessageId(m.id);
    setEditingText(m.text || "");
    setOpenMsgMenuFor(null);
  }

  function cancelEditMessage() {
    setEditingMessageId(null);
    setEditingText("");
  }

  function submitEditMessage(m) {
    const trimmed = editingText.trim();
    if (!trimmed || trimmed === m.text) {
      cancelEditMessage();
      return;
    }
    socket.emit("message:edit", {
      conversationId: m.conversationId,
      messageId: m.id,
      text: trimmed,
    });
    cancelEditMessage();
  }

  function requestDeleteMessage(m) {
    setOpenMsgMenuFor(null);
    openDeleteSheet([m.id]);
  }

  function openConversation(convId) {
    setActiveConvId(convId);
    socket.emit("conversation:read", { conversationId: convId });
    setActiveView("chats");
    setMobileChatOpen(true);
  }

  if (!joined) {
    if (resuming) {
      return (
        <div className="gate">
          <div className="gate-card">
            <div className="gate-mark">
              <img src="/logo.png" alt="" className="gate-logo" />
              MakeFriends
            </div>
            <p className="gate-sub">Reconnecting your session…</p>
          </div>
        </div>
      );
    }
    return (
      <AuthPage
        serverUrl={SERVER_URL}
        onAuthenticated={handleAuthenticated}
        initialError={loginError}
      />
    );
  }

  return (
    <div className={"app" + (mobileChatOpen ? " mobile-chat-open" : "")}>
      <IconSprite />

      <nav className="icon-rail">
        <div className="rail-brand-row">
          <div className="rail-brand">
            <img src="/logo.png" alt="MakeFriends" />
          </div>
          <span className="rail-wordmark">MakeFriends</span>
        </div>
        <button
          type="button"
          className={"rail-btn" + (activeView === "chats" ? " active" : "")}
          title="Chats"
          onClick={() => runOrConfirmLeaveSelect(() => setActiveView("chats"))}
        >
          <svg className="icon" width="20" height="20">
            <use href="#chat-icon" />
          </svg>
          <span className="rail-label">Chats</span>
        </button>
        <button
          type="button"
          className={"rail-btn" + (activeView === "contacts" ? " active" : "")}
          title="Friends"
          onClick={() => runOrConfirmLeaveSelect(() => setActiveView("contacts"))}
        >
          <svg className="icon" width="20" height="20">
            <use href="#contacts-icon" />
          </svg>
          <span className="rail-label">Friends</span>
        </button>
        <button
          type="button"
          className={"rail-btn" + (activeView === "groups" ? " active" : "")}
          title="Groups"
          onClick={() => runOrConfirmLeaveSelect(() => setActiveView("groups"))}
        >
          <svg className="icon" width="20" height="20">
            <use href="#groups-icon" />
          </svg>
          <span className="rail-label">Groups</span>
        </button>
        <button
          type="button"
          className="rail-btn"
          title="Games"
          onClick={() =>
            runOrConfirmLeaveSelect(() => {
              if (activeConv) {
                setActiveView("chats");
                setShowGamesMenu(true);
              } else {
                setActiveView("chats");
              }
            })
          }
        >
          <svg className="icon" width="20" height="20">
            <use href="#video-call-icon" />
          </svg>
          <span className="rail-label">Games</span>
        </button>
        <button
          type="button"
          className="rail-btn"
          title="Polls"
          onClick={() =>
            runOrConfirmLeaveSelect(() => {
              if (activeConv) {
                setActiveView("chats");
                setShowPollComposer(true);
              } else {
                setActiveView("chats");
              }
            })
          }
        >
          <svg className="icon" width="20" height="20">
            <use href="#info-icon" />
          </svg>
          <span className="rail-label">Polls</span>
        </button>
        {isAdmin && (
          <button
            type="button"
            className={"rail-btn" + (activeView === "admin" ? " active" : "")}
            title="Admin"
            onClick={() => runOrConfirmLeaveSelect(() => setActiveView("admin"))}
          >
            <svg className="icon" width="20" height="20">
              <use href="#admin-icon" />
            </svg>
            <span className="rail-label">Admin</span>
          </button>
        )}
        <div className="rail-spacer" />
        <button
          type="button"
          className={"rail-btn" + (activeView === "settings" ? " active" : "")}
          title="Settings"
          onClick={() => runOrConfirmLeaveSelect(() => setActiveView("settings"))}
        >
          <svg className="icon" width="20" height="20">
            <use href="#settings-icon" />
          </svg>
          <span className="rail-label">Settings</span>
        </button>
        <button
          type="button"
          className="rail-btn"
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setDarkMode((v) => !v)}
        >
          <svg className="icon" width="20" height="20">
            <use href={darkMode ? "#sun-icon" : "#moon-icon"} />
          </svg>
          <span className="rail-label">Theme</span>
        </button>
        <button
          type="button"
          className="rail-user-card"
          title={username}
          onClick={() => runOrConfirmLeaveSelect(() => setActiveView("profile"))}
        >
          <span className="rail-avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initials(username)}</span>}
          </span>
          <span className="rail-user-info">
            <span className="rail-user-name">{username}</span>
            <span className={"rail-user-status" + (connected ? "" : " off")}>
              {connected ? "Online" : "Offline"}
            </span>
          </span>
        </button>
      </nav>

      {activeView === "settings" ? (
        <SettingsPanel
          profile={{
            username,
            phoneNumber,
            avatarUrl,
            coverUrl,
            tagline,
            themeColor,
            showOnline,
          }}
          connected={connected}
          uploading={avatarUploading}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((v) => !v)}
          onUploadAvatar={pickAvatarWithCrop}
          onUploadCover={pickCoverWithCrop}
          onSave={saveProfile}
          onLogout={logout}
          onDeleteAccount={handleDeleteAccount}
          onClose={() => setActiveView("chats")}
          serverUrl={SERVER_URL}
          token={tokenRef.current}
          mediaSrc={mediaSrc}
        />
      ) : activeView === "profile" ? (
        <ProfilePage
          profile={{ username, phoneNumber, avatarUrl, coverUrl, tagline }}
          connected={connected}
          stats={{
            chats: conversations.length,
            friends: contactList.length,
            groups: groupConversations.length,
            games: gamesPlayedCount,
          }}
          uploading={avatarUploading}
          onUploadAvatar={pickAvatarWithCrop}
          onUploadCover={pickCoverWithCrop}
          onSave={saveProfile}
          onClose={() => setActiveView("chats")}
        />
      ) : activeView === "groups" ? (
        <GroupsPage
          groups={groupConversations}
          onOpenGroup={openConversation}
          onNewGroup={() => setShowNewChat(true)}
          mediaSrc={mediaSrc}
        />
      ) : activeView === "contacts" ? (
        <ContactsPage
          contacts={contactList}
          onOpenContact={openConversation}
          onCall={(otherId, otherName, avatarUrl, type) => startCall(otherId, otherName, avatarUrl, type)}
          onNewChat={() => setShowNewChat(true)}
          mediaSrc={mediaSrc}
        />
      ) : activeView === "admin" && isAdmin ? (
        <AdminPage serverUrl={SERVER_URL} token={tokenRef.current} mediaSrc={mediaSrc} />
      ) : (
        <>
          <aside className="sidebar">
            <div className="sidebar-header">
              <h1 className="sidebar-title">Chats</h1>
              <button
                type="button"
                className="compose-btn"
                title="New chat or group"
                onClick={() => {
                  setNewChatMode("direct");
                  setShowNewChat(true);
                }}
              >
                <svg className="icon" width="17" height="17">
                  <use href="#edit-pencil-icon" />
                </svg>
              </button>
            </div>

            <div className="sidebar-search">
              <svg className="icon sidebar-search-icon" width="15" height="15">
                <use href="#search-icon" />
              </svg>
              <input
                type="text"
                placeholder="Search chats..."
                value={convSearch}
                onChange={(e) => setConvSearch(e.target.value)}
              />
            </div>

            <div className="sidebar-tabs">
              <button
                type="button"
                className={"sidebar-tab" + (convFilterTab === "all" ? " active" : "")}
                onClick={() => setConvFilterTab("all")}
              >
                All
              </button>
              <button
                type="button"
                className={"sidebar-tab" + (convFilterTab === "unread" ? " active" : "")}
                onClick={() => setConvFilterTab("unread")}
              >
                Unread
              </button>
              <button
                type="button"
                className={"sidebar-tab" + (convFilterTab === "groups" ? " active" : "")}
                onClick={() => setConvFilterTab("groups")}
              >
                Groups
              </button>
            </div>

            <div className="new-action-row">
              <button
                type="button"
                className="new-action-card new-action-chat"
                onClick={() => {
                  setNewChatMode("direct");
                  setShowNewChat(true);
                }}
              >
                <span className="new-action-icon">
                  <svg className="icon" width="18" height="18">
                    <use href="#chat-icon" />
                  </svg>
                </span>
                <span className="new-action-copy">
                  <span className="new-action-title">New Chat</span>
                  <span className="new-action-sub">Start a private conversation</span>
                </span>
                <span className="new-action-arrow">›</span>
              </button>
              <button
                type="button"
                className="new-action-card new-action-group"
                onClick={() => {
                  setNewChatMode("group");
                  setShowNewChat(true);
                }}
              >
                <span className="new-action-icon">
                  <svg className="icon" width="18" height="18">
                    <use href="#groups-icon" />
                  </svg>
                </span>
                <span className="new-action-copy">
                  <span className="new-action-title">New Group</span>
                  <span className="new-action-sub">Create a group chat</span>
                </span>
                <span className="new-action-arrow">›</span>
              </button>
            </div>
            <div className="roster-label">recent chats — {conversations.length}</div>
            <ul className="roster conv-list">
              {conversations
                .filter((c) => {
                  if (convFilterTab === "unread" && !(unreadByConv[c.id] > 0)) return false;
                  if (convFilterTab === "groups" && c.type !== "group") return false;
                  if (convSearch.trim() && !c.name.toLowerCase().includes(convSearch.trim().toLowerCase()))
                    return false;
                  return true;
                })
                .map((c) => (
                <li
                  key={c.id}
                  className={
                    "conv-item" + (c.id === activeConvId ? " active" : "")
                  }
                  onClick={() => {
                    runOrConfirmLeaveSelect(() => {
                      setActiveConvId(c.id);
                      setMobileChatOpen(true);
                      socket.emit("conversation:read", { conversationId: c.id });
                    });
                  }}
                >
                  <span className="avatar">
                    {c.avatarUrl ? (
                      <img src={mediaSrc(c.avatarUrl)} alt="" />
                    ) : c.type === "group" ? (
                      "👥"
                    ) : (
                      initials(c.name)
                    )}
                  </span>
                  <span className="roster-name">
                    {c.name}
                    {c.type === "group" && (
                      <span className="conv-badge">group</span>
                    )}
                  </span>
                  {unreadByConv[c.id] > 0 && (
                    <span className="unread-badge">{unreadByConv[c.id]}</span>
                  )}
                </li>
              ))}
              {conversations.length === 0 && (
                <li className="conv-empty">No chats yet — start one above.</li>
              )}
            </ul>
            <div className="conn-status">
              {connected ? "connected" : "reconnecting…"}
            </div>
          </aside>

          <main
            className="feed-col"
            onDragOver={handleFeedDragOver}
            onDragLeave={handleFeedDragLeave}
            onDrop={handleFeedDrop}
            style={{ position: "relative" }}
          >
            {isDraggingFile && activeConv && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 50,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.55)",
                  border: "3px dashed #fff",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "18px",
                  fontWeight: 600,
                  pointerEvents: "none",
                }}
              >
                Drop to send
              </div>
            )}
            {!activeConv ? (
              <div className="empty-state">
                <div className="empty-state-illustration">
                  <svg className="icon" width="40" height="40">
                    <use href="#chat-icon" />
                  </svg>
                </div>
                <h2 className="empty-state-title">Start a conversation</h2>
                <p className="empty-state-sub">Select a chat from the list or start a new one.</p>
                <div className="empty-state-actions">
                  <button
                    type="button"
                    className="empty-state-btn empty-state-btn-chat"
                    onClick={() => {
                      setNewChatMode("direct");
                      setShowNewChat(true);
                    }}
                  >
                    <svg className="icon" width="16" height="16">
                      <use href="#chat-icon" />
                    </svg>
                    New Chat
                  </button>
                  <button
                    type="button"
                    className="empty-state-btn empty-state-btn-group"
                    onClick={() => {
                      setNewChatMode("group");
                      setShowNewChat(true);
                    }}
                  >
                    <svg className="icon" width="16" height="16">
                      <use href="#groups-icon" />
                    </svg>
                    New Group
                  </button>
                </div>
              </div>
            ) : (
              <>
                {selectMode ? (
                  <div className="room-label select-toolbar">
                    <button
                      type="button"
                      className="header-action-btn header-action-close"
                      title="Cancel selection"
                      onClick={exitSelectMode}
                    >
                      <svg className="icon" width="15" height="15">
                        <use href="#close-icon" />
                      </svg>
                    </button>
                    <span className="select-toolbar-count">
                      {selectedMsgIds.size} selected
                    </span>
                    <button
                      type="button"
                      className="call-icon-btn group-call-header-btn"
                      disabled={selectedMsgIds.size === 0}
                      onClick={() => openDeleteSheet([...selectedMsgIds])}
                    >
                      <svg className="icon" width="17" height="17">
                        <use href="#delete-trash-icon" />
                      </svg>
                      Delete
                    </button>
                  </div>
                ) : (
                <div className="room-label">
                  <button
                    type="button"
                    className="mobile-back-btn"
                    aria-label="Back to chats"
                    onClick={() => runOrConfirmLeaveSelect(() => setMobileChatOpen(false))}
                  >
                    ←
                  </button>
                  {activeConv.type === "group" ? (
                    <span className="room-avatar-wrap">
                      <span
                        className="room-avatar"
                        title="View group photo"
                        onClick={() => {
                          if (activeConv.avatarUrl) setLightboxImage(mediaSrc(activeConv.avatarUrl));
                        }}
                      >
                        {activeConv.avatarUrl ? (
                          <img src={mediaSrc(activeConv.avatarUrl)} alt="" />
                        ) : (
                          "👥"
                        )}
                        {groupAvatarUploading && (
                          <span className="room-avatar-spinner" />
                        )}
                      </span>
                      {activeConv.myIsAdmin && (
                        <button
                          type="button"
                          className="room-avatar-edit-badge"
                          title="Change group photo"
                          onClick={() => groupAvatarInputRef.current?.click()}
                        >
                          <svg className="icon" width="11" height="11">
                            <use href="#camera-icon" />
                          </svg>
                        </button>
                      )}
                    </span>
                  ) : (
                    <span
                      className="room-avatar"
                      title="View photo"
                      onClick={() => {
                        if (activeConv.avatarUrl) setLightboxImage(mediaSrc(activeConv.avatarUrl));
                      }}
                    >
                      {activeConv.avatarUrl ? (
                        <img src={mediaSrc(activeConv.avatarUrl)} alt="" />
                      ) : (
                        initials(activeConv.name)
                      )}
                    </span>
                  )}
                  {activeConv.type === "group" && (
                    <input
                      ref={groupAvatarInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) pickGroupAvatarWithCrop(activeConv.id, file);
                        e.target.value = "";
                      }}
                    />
                  )}
                  <span className="room-identity" onClick={openInfoPanel} title="View info" style={{ cursor: "pointer" }}>
                    <span className="room-title-text">{activeConv.name}</span>
                  </span>
                  {activeConv.type === "direct" &&
                    (() => {
                      const other = otherMemberOf(activeConv);
                      if (!other) return null;
                      return (
                        <span className="room-header-call-btns">
                          <button
                            type="button"
                            className="header-action-btn"
                            title={`Audio call ${other.username}`}
                            disabled={!!callState}
                            onClick={() => startCall(other.id, other.username, activeConv.avatarUrl, "audio")}
                          >
                            <svg className="icon" width="18" height="18">
                              <use href="#phone-icon" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="header-action-btn"
                            title={`Video call ${other.username}`}
                            disabled={!!callState}
                            onClick={() => startCall(other.id, other.username, activeConv.avatarUrl, "video")}
                          >
                            <svg className="icon" width="18" height="18">
                              <use href="#video-call-icon" />
                            </svg>
                          </button>
                        </span>
                      );
                    })()}
                  {activeConv.type === "group" && (
                    <span className="conv-badge">                      {activeConv.members?.length || 0} members
                    </span>
                  )}
                  {activeConv.type === "group" && (
                    <button
                      type="button"
                      className="call-icon-btn group-call-header-btn"
                      title="Start group video call"
                      disabled={!!groupCallConvId}
                      onClick={() => {
                        socket.emit("group-call:start", {
                          conversationId: activeConv.id,
                        });
                        setGroupCallConvId(activeConv.id);
                      }}
                    >
                      <svg className="icon" width="16" height="16">
                        <use href="#video-call-icon" />
                      </svg>
                      <span className="header-btn-label">Group call</span>
                    </button>
                  )}
                  {activeConv.type === "direct" && (
                    <button
                      type="button"
                      className="call-icon-btn group-call-header-btn"
                      title="Play a game together"
                      onClick={() => setShowGamesMenu(true)}
                    >
                      🎮 <span className="header-btn-label">Games</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="call-icon-btn group-call-header-btn"
                    title="Create a poll"
                    onClick={() => setShowPollComposer(true)}
                  >
                    📊 <span className="header-btn-label">Poll</span>
                  </button>
                  {openMsgMenuFor &&
                    (() => {
                      const selectedMsg = activeMessages.find((m) => m.id === openMsgMenuFor);
                      if (!selectedMsg || selectedMsg.username !== username) return null;
                      return (
                        <div className="header-msg-actions">
                          {canEditMessage(selectedMsg) && (
                            <button
                              type="button"
                              className="header-action-btn"
                              title="Edit message"
                              onClick={() => {
                                startEditMessage(selectedMsg);
                                setOpenMsgMenuFor(null);
                              }}
                            >
                              <svg className="icon" width="17" height="17">
                                <use href="#edit-pencil-icon" />
                              </svg>
                            </button>
                          )}
                          {canDeleteMessage(selectedMsg) && (
                            <button
                              type="button"
                              className="header-action-btn"
                              title="Delete message"
                              onClick={() => {
                                requestDeleteMessage(selectedMsg);
                                setOpenMsgMenuFor(null);
                              }}
                            >
                              <svg className="icon" width="17" height="17">
                                <use href="#delete-trash-icon" />
                              </svg>
                            </button>
                          )}
                          <button
                            type="button"
                            className="header-action-btn"
                            title="Message info"
                            onClick={() => setInfoPanelMsgId(selectedMsg.id)}
                          >
                            <svg className="icon" width="17" height="17">
                              <use href="#info-icon" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="header-action-btn header-action-close"
                            title="Close"
                            onClick={() => setOpenMsgMenuFor(null)}
                          >
                            <svg className="icon" width="15" height="15">
                              <use href="#close-icon" />
                            </svg>
                          </button>
                        </div>
                      );
                    })()}
                  <div className="chat-menu-wrap">
                    <button
                      type="button"
                      className="header-action-btn chat-menu-trigger"
                      title="Chat options"
                      onClick={() => setShowChatMenu((v) => !v)}
                    >
                      <svg className="icon" width="20" height="20">
                        <use href="#more-icon" />
                      </svg>
                    </button>
                    {showChatMenu && (
                      <>
                        <div className="chat-menu-backdrop" onClick={() => setShowChatMenu(false)} />
                        <div className="chat-menu-dropdown">
                          <button type="button" onClick={openInfoPanel}>
                            <svg className="icon" width="15" height="15"><use href="#info-icon" /></svg>
                            Info
                          </button>
                          <button type="button" onClick={() => startSelectMode(null)}>
                            Select messages
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowChatMenu(false);
                              setShowWallpaperPicker(true);
                            }}
                          >
                            Chat wallpaper
                          </button>
                          <button type="button" onClick={requestClearChat}>
                            Clear chat
                          </button>
                          {activeConv.type === "group" && activeConv.myIsAdmin && (
                            <button
                              type="button"
                              className="chat-menu-danger"
                              onClick={() => requestDeleteGroup(activeConv.id)}
                            >
                              <svg className="icon" width="15" height="15"><use href="#delete-trash-icon" /></svg>
                              Delete Group
                            </button>
                          )}
                          {activeConv.type === "group" && (
                            <button
                              type="button"
                              className="chat-menu-danger"
                              onClick={() => requestLeaveGroup(activeConv.id)}
                            >
                              <svg className="icon" width="15" height="15"><use href="#exit-icon" /></svg>
                              Leave Group
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                )}
                {gameError && (
                  <div
                    style={{
                      background: "#e0454533",
                      color: "#e04545",
                      padding: "8px 14px",
                      fontSize: "13px",
                      textAlign: "center",
                    }}
                  >
                    {gameError}
                  </div>
                )}
                <div className="feed" ref={scrollRef} style={feedBackgroundStyle} onScroll={handleFeedScroll}>
                  {loadingOlderByConv[activeConvId] && (
                    <div style={{ textAlign: "center", padding: "8px", fontSize: "12px", opacity: 0.6 }}>
                      Loading earlier messages…
                    </div>
                  )}
                  {activeMessages.map((m) => {
                    const mine = m.username === username;
                    let msgStatus = null;
                    if (mine && !m.deleted) {
                      if (m.seenAt) msgStatus = "seen";
                      else if (m.deliveredAt) msgStatus = "delivered";
                      else msgStatus = "sent";
                    }
                    const isSelected = selectedMsgIds.has(m.id);
                    return (
                    <div
                      className={
                        "msg" + (mine ? " mine" : "") + (selectMode ? " msg-selectable" : "") + (isSelected ? " msg-row-selected" : "")
                      }
                      key={m.id}
                      onClick={() => {
                        if (selectMode) toggleSelectMsg(m.id);
                      }}
                      onContextMenu={(e) => {
                        if (!selectMode && !m.deleted) {
                          e.preventDefault();
                          startSelectMode(m.id);
                        }
                      }}
                    >
                      {/* {selectMode && (
                        <span
                          className={"msg-select-checkbox" + (isSelected ? " checked" : "")}
                          aria-hidden="true"
                        >
                          {isSelected ? "✓" : ""}
                        </span>
                      )} */}
                      <div className="msg-content">
                      <div className="msg-meta">
                        <span className="msg-user">{m.username}</span>
                        <span className="msg-time">
                          {formatTime(m.createdAt || m.timestamp)}
                        </span>
                        {msgStatus && (
                          <span
                            className={"msg-tick msg-tick-" + msgStatus}
                            title={
                              msgStatus === "seen"
                                ? "Seen"
                                : msgStatus === "delivered"
                                ? "Delivered"
                                : "Sent"
                            }
                          >
                            <svg className="icon" width="15" height="15">
                              <use
                                href={
                                  msgStatus === "sent"
                                    ? "#check-single-icon"
                                    : "#check-double-icon"
                                }
                              />
                            </svg>
                          </span>
                        )}
                      </div>
                      {m.deleted ? (
                        <div className="msg-row">
                          <div className="msg-bubble msg-deleted">
                            <em>This message was deleted</em>
                          </div>
                        </div>
                      ) : m.type === "game" ? (
                        <div className="msg-row">
                          <div
                            className="msg-bubble"
                            style={{ cursor: "pointer" }}
                            onClick={() => {
                              socket.emit("game:sync", { conversationId: m.conversationId });
                              setOpenGameConvId(m.conversationId);
                            }}
                          >
                            <div className="msg-text">{m.text}</div>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                              Tap to open
                            </div>
                          </div>
                        </div>
                      ) : m.type === "poll" ? (
                        <div className="msg-row">
                          <div className="msg-bubble">
                            <PollCard
                              poll={pollsByMessageId[m.id]}
                              myUserId={userId}
                              onVote={votePoll}
                              onClose={closePoll}
                            />
                          </div>
                        </div>
                      ) : (
                      <div className="msg-row">
                        <div
                          className={
                            "msg-bubble" +
                            (mine ? " msg-bubble-clickable" : "") +
                            (openMsgMenuFor === m.id ? " msg-bubble-selected" : "")
                          }
                          onClick={(e) => {
                            if (selectMode) {
                              e.stopPropagation();
                              toggleSelectMsg(m.id);
                              return;
                            }
                            if (mine && editingMessageId !== m.id) {
                              setOpenMsgMenuFor(openMsgMenuFor === m.id ? null : m.id);
                            }
                          }}
                        >
                          {m.type === "image" && (
                            <img
                              className="msg-media msg-image"
                              src={mediaSrc(m.mediaUrl)}
                              alt={m.mediaName || "image"}
                            />
                          )}
                          {m.type === "video" && (
                            <video
                              className="msg-media"
                              src={mediaSrc(m.mediaUrl)}
                              controls
                            />
                          )}
                          {m.type === "audio" && (
                            <audio
                              className="msg-media"
                              src={mediaSrc(m.mediaUrl)}
                              controls
                            />
                          )}
                          {m.type === "file" && (
                            <a
                              className="msg-file"
                              href={mediaSrc(m.mediaUrl)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="icon" width="25" height="25">
                                <use href="#paperclip-small-icon" />
                              </svg>
                              {m.mediaName || "file"}
                            </a>
                          )}
                          {m.text && editingMessageId === m.id ? (
                            <div className="msg-edit-box" onClick={(e) => e.stopPropagation()}>
                              <textarea
                                autoFocus
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    submitEditMessage(m);
                                  } else if (e.key === "Escape") {
                                    cancelEditMessage();
                                  }
                                }}
                              />
                              <div className="msg-edit-actions">
                                <button type="button" onClick={() => submitEditMessage(m)}>
                                  Save
                                </button>
                                <button type="button" onClick={cancelEditMessage}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            m.text && (
                              <div className="msg-text">
                                {m.text}
                                {m.editedAt && <span className="msg-edited-tag"> (edited)</span>}
                              </div>
                            )
                          )}
                        </div>
                        {!selectMode && (
                          <button
                            type="button"
                            className="react-trigger"
                            onClick={() =>
                              setOpenReactionPickerFor(
                                openReactionPickerFor === m.id ? null : m.id,
                              )
                            }
                            aria-label="Add reaction"
                          >
                            <svg className="icon" width="18" height="18">
                              <use href="#emoji-icon" />
                            </svg>
                            <span className="react-trigger-badge">+</span>
                          </button>
                        )}
                        {!selectMode && openReactionPickerFor === m.id && (
                          <ReactionPicker
                            anchorClass={
                              "reaction-picker" +
                              (mine ? " reaction-picker-mine" : "")
                            }
                            onSelect={(key) => sendReaction(m.id, key)}
                            onClose={() => setOpenReactionPickerFor(null)}
                            uploadFile={uploadFile}
                            mediaSrc={mediaSrc}
                          />
                        )}
                      </div>
                      )}
                      {m.reactions && Object.keys(m.reactions).length > 0 && (
                        <div className="reaction-pills">
                          {Object.entries(m.reactions).map(([key, names]) => {
                            const sepIdx = key.indexOf(":");
                            const kind = sepIdx === -1 ? "emoji" : key.slice(0, sepIdx);
                            const value = sepIdx === -1 ? key : key.slice(sepIdx + 1);
                            const isMedia = kind === "voice" || kind === "video";
                            return (
                              <button
                                type="button"
                                key={key}
                                className={
                                  "reaction-pill" +
                                  (names.includes(username) ? " mine-pill" : "")
                                }
                                title={names.join(", ")}
                                onClick={() =>
                                  isMedia
                                    ? setPlayingReaction({ kind, url: value })
                                    : sendReaction(m.id, key)
                                }
                              >
                                {kind === "voice" && "🎙️▶"}
                                {kind === "video" && "🎥▶"}
                                {(kind === "emoji" || kind === "sticker") && value}{" "}
                                {names.length}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      </div>
                    </div>
                    );
                  })}
                  <div className="typing-slot">
                    {typingUser && typingUser !== username
                      ? `${typingUser} is typing…`
                      : ""}
                  </div>
                </div>

                {pendingFiles.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      padding: "8px 14px",
                      overflowX: "auto",
                      borderTop: "1px solid rgba(128,128,128,0.25)",
                    }}
                  >
                    {pendingFiles.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          position: "relative",
                          flexShrink: 0,
                          width: "64px",
                          height: "64px",
                          borderRadius: "8px",
                          overflow: "hidden",
                          background: "rgba(128,128,128,0.15)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "11px",
                          textAlign: "center",
                          cursor: p.kind === "image" || p.kind === "video" ? "pointer" : "default",
                        }}
                        title={p.file.name}
                        onClick={() => {
                          if (p.kind === "image" || p.kind === "video") setPendingPreview(p);
                        }}
                        role={p.kind === "image" || p.kind === "video" ? "button" : undefined}
                        tabIndex={p.kind === "image" || p.kind === "video" ? 0 : undefined}
                      >
                        {p.kind === "image" && (
                          <img src={p.previewUrl} alt={p.file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                        {p.kind === "video" && (
                          <video src={p.previewUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                        )}
                        {p.kind === "audio" && <span>🎤</span>}
                        {p.kind === "file" && <span style={{ padding: "4px" }}>📎 {p.file.name.slice(0, 10)}</span>}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePendingFile(p.id);
                          }}
                          aria-label={`Remove ${p.file.name}`}
                          style={{
                            position: "absolute",
                            top: 2,
                            right: 2,
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            border: "none",
                            background: "rgba(0,0,0,0.65)",
                            color: "#fff",
                            fontSize: "12px",
                            lineHeight: "18px",
                            cursor: "pointer",
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <form className="composer" onSubmit={handleSend}>
                  <div className="composer-emoji-wrap">
                    <button
                      type="button"
                      className="emoji-trigger"
                      onClick={() => setShowComposerEmoji((v) => !v)}
                      aria-label="Open emoji picker"
                    >
                      <svg className="icon" width="25" height="25">
                        <use href="#emoji-icon" />
                      </svg>
                    </button>
                    {showComposerEmoji && (
                      <EmojiPicker
                        anchorClass="composer-picker"
                        onSelect={insertEmojiIntoDraft}
                        onClose={() => setShowComposerEmoji(false)}
                      />
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden-file-input"
                    accept="image/*,video/*,audio/*"
                    onChange={handleFilePicked}
                  />
                  <button
                    type="button"
                    className="attach-btn"
                    title="Share image, video, or audio"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      "…"
                    ) : (
                      <svg className="icon" width="20" height="20">
                        <use href="#plus-icon" />
                      </svg>
                    )}
                  </button>
                  <input
                    placeholder="send a line…"
                    value={draft}
                    onChange={handleDraftChange}
                    onPaste={handleComposerPaste}
                    maxLength={2000}
                  />
                  <button
                    type="submit"
                    className="send_btn"
                    disabled={!draft.trim() && pendingFiles.length === 0}
                  >
                    <svg className="icon" width="30" height="30">
                      <use href="#send-icon" />
                    </svg>
                  </button>
                </form>
              </>
            )}
          </main>
        </>
      )}

      {pendingPreview && (
        <div className="modal-overlay" onClick={() => setPendingPreview(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            {pendingPreview.kind === "image" && (
              <img
                src={pendingPreview.previewUrl}
                alt={pendingPreview.file.name}
                style={{ maxWidth: "90vw", maxHeight: "75vh", borderRadius: "8px", objectFit: "contain" }}
              />
            )}
            {pendingPreview.kind === "video" && (
              <video
                src={pendingPreview.previewUrl}
                controls
                autoPlay
                style={{ maxWidth: "90vw", maxHeight: "75vh", borderRadius: "8px" }}
              />
            )}
            <div style={{ color: "#fff", fontSize: "13px" }}>{pendingPreview.file.name}</div>
            <button
              type="button"
              className="delete-sheet-btn"
              onClick={() => setPendingPreview(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {selectModeGuard && (
        <div className="modal-overlay" onClick={() => setSelectModeGuard(null)}>
          <div className="delete-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="delete-sheet-title">
              {selectModeGuard.kind === "send" ? "Send message?" : "Leave selection?"}
            </div>
            <div className="delete-sheet-desc">
              {selectModeGuard.kind === "send"
                ? "You're still selecting messages. Sending now will clear your selection."
                : "You're still selecting messages. Leaving now will clear your selection."}
            </div>
            <button
              type="button"
              className="delete-sheet-btn delete-sheet-danger"
              onClick={() => {
                const action = selectModeGuard.action;
                setSelectModeGuard(null);
                exitSelectMode();
                action();
              }}
            >
              {selectModeGuard.kind === "send" ? "Send & deselect" : "Leave & deselect"}
            </button>
            <button
              type="button"
              className="delete-sheet-btn delete-sheet-cancel"
              onClick={() => setSelectModeGuard(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {deleteSheet && (
        <div className="modal-overlay" onClick={() => setDeleteSheet(null)}>
          <div className="delete-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="delete-sheet-title">
              Delete {deleteSheet.ids.length > 1 ? `${deleteSheet.ids.length} messages` : "message"}?
            </div>
            <button type="button" className="delete-sheet-btn" onClick={confirmDeleteForMe}>
              Delete for me
            </button>
            {deleteSheet.canEveryone && (
              <button
                type="button"
                className="delete-sheet-btn delete-sheet-danger"
                onClick={confirmDeleteForEveryone}
              >
                Delete for everyone
              </button>
            )}
            <button type="button" className="delete-sheet-btn delete-sheet-cancel" onClick={() => setDeleteSheet(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showWallpaperPicker && (
        <div className="modal-overlay" onClick={() => setShowWallpaperPicker(false)}>
          <div className="wallpaper-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wallpaper-modal-title">Chat wallpaper</div>
            <input
              ref={wallpaperFileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleWallpaperFilePicked}
            />
            <div className="wallpaper-swatches">
              {[
                { type: "color", value: "linear-gradient(135deg,#0f2027,#203a43,#2c5364)" },
                { type: "color", value: "linear-gradient(135deg,#0b486b,#f56217)" },
                { type: "color", value: "linear-gradient(135deg,#1e3c72,#2a5298)" },
                { type: "color", value: "linear-gradient(135deg,#134e5e,#71b280)" },
                { type: "color", value: "linear-gradient(135deg,#232526,#414345)" },
                { type: "color", value: "linear-gradient(135deg,#8e2de2,#4a00e0)" },
              ].map((preset, i) => {
                const current = wallpapers[activeConvId];
                const isSelected = current && current.type === preset.type && current.value === preset.value;
                return (
                  <button
                    key={i}
                    type="button"
                    className={"wallpaper-swatch" + (isSelected ? " wallpaper-swatch-selected" : "")}
                    style={{ background: preset.value }}
                    onClick={() => applyWallpaperPreset(preset, false)}
                  />
                );
              })}
            </div>
            <div className="wallpaper-modal-actions">
              <button type="button" onClick={() => wallpaperFileInputRef.current?.click()}>
                Upload photo…
              </button>
              <button type="button" onClick={() => clearWallpaperChoice(false)}>
                Reset this chat
              </button>
            </div>
            <div className="wallpaper-modal-actions">
              <button
                type="button"
                onClick={() => {
                  const current = wallpapers[activeConvId];
                  if (current) applyWallpaperPreset(current, true);
                }}
              >
                Use as default for all chats
              </button>
              <button type="button" onClick={() => clearWallpaperChoice(true)}>
                Clear default
              </button>
            </div>
            <button type="button" className="wallpaper-modal-close" onClick={() => setShowWallpaperPicker(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      {showNewChat && (
        <NewChatModal
          serverUrl={SERVER_URL}
          token={tokenRef.current}
          myUserId={userId}
          onStartDirect={startDirectChat}
          onStartGroup={startGroupChat}
          onClose={() => setShowNewChat(false)}
          initialMode={newChatMode}
        />
      )}

      {cropTask && (
        <ImageCropModal
          file={cropTask.file}
          shape={cropTask.shape}
          aspect={cropTask.aspect}
          onCancel={() => setCropTask(null)}
          onConfirm={(blob) => {
            const cropped = new File([blob], "photo.jpg", { type: "image/jpeg" });
            cropTask.onDone(cropped);
            setCropTask(null);
          }}
        />
      )}

      {lightboxImage && (
        <div className="lightbox-backdrop" onClick={() => setLightboxImage(null)}>
          <button
            type="button"
            className="lightbox-close"
            onClick={() => setLightboxImage(null)}
            aria-label="Close"
          >
            <svg className="icon" width="20" height="20"><use href="#close-icon" /></svg>
          </button>
          <img src={lightboxImage} alt="" className="lightbox-image" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {showGroupInfo && activeConv?.type === "group" && (
        <GroupInfoPanel
          conv={{
            ...activeConv,
            avatarUrl: activeConv.avatarUrl ? mediaSrc(activeConv.avatarUrl) : null,
            members: (activeConv.members || []).map((m) => ({
              ...m,
              avatarUrl: m.avatarUrl ? mediaSrc(m.avatarUrl) : null,
            })),
          }}
          myUserId={userId}
          mediaCount={convInfoByConv[activeConv.id]?.mediaCount}
          uploading={groupAvatarUploading}
          onClose={() => setShowGroupInfo(false)}
          onOpenAvatar={(url) => setLightboxImage(url)}
          onPickAvatar={() => groupAvatarInputRef.current?.click()}
          onRename={(name) => renameGroup(activeConv.id, name)}
          onAudioCall={() => {
            socket.emit("group-call:start", { conversationId: activeConv.id });
            setGroupCallConvId(activeConv.id);
          }}
          onVideoCall={() => {
            socket.emit("group-call:start", { conversationId: activeConv.id });
            setGroupCallConvId(activeConv.id);
          }}
          onOpenMember={() => {}}
          onDeleteGroup={() => requestDeleteGroup(activeConv.id)}
          onLeaveGroup={() => requestLeaveGroup(activeConv.id)}
          serverUrl={SERVER_URL}
          token={tokenRef.current}
          onAddMember={(uid) => addGroupMember(activeConv.id, uid)}
          onRemoveMember={(uid) => removeGroupMember(activeConv.id, uid)}
          onSetRole={(uid, role) => setGroupMemberRole(activeConv.id, uid, role)}
        />
      )}

      {showUserInfo && activeConv?.type === "direct" && (
        <UserProfilePanel
          user={{
            ...otherMemberOf(activeConv),
            avatarUrl: activeConv.avatarUrl ? mediaSrc(activeConv.avatarUrl) : null,
          }}
          mediaCount={convInfoByConv[activeConv.id]?.mediaCount}
          onClose={() => setShowUserInfo(false)}
          onOpenAvatar={(url) => setLightboxImage(url)}
          onMessage={() => setShowUserInfo(false)}
          onAudioCall={() => {
            const other = otherMemberOf(activeConv);
            if (other) startCall(other.id, other.username, activeConv.avatarUrl, "audio");
            setShowUserInfo(false);
          }}
          onVideoCall={() => {
            const other = otherMemberOf(activeConv);
            if (other) startCall(other.id, other.username, activeConv.avatarUrl, "video");
            setShowUserInfo(false);
          }}
          onBlock={handleBlockUser}
        />
      )}

      {showPollComposer && (
        <PollComposer onCreate={createPoll} onClose={() => setShowPollComposer(false)} />
      )}

      {showGamesMenu && (
        <GamesMenu
          onPick={inviteToGame}
          onClose={() => setShowGamesMenu(false)}
          onViewHistory={() => {
            setShowGamesMenu(false);
            setHistoryConvId(activeConvId || "all");
          }}
        />
      )}

      {openGameConvId && gameSessionsByConv[openGameConvId] && (
        <GameOverlay
          session={gameSessionsByConv[openGameConvId]}
          myUserId={userId}
          members={(conversations.find((c) => c.id === openGameConvId)?.members || []).map((m) => ({
            ...m,
            avatarUrl: m.avatarUrl ? mediaSrc(m.avatarUrl) : null,
          }))}
          onMove={gameMove}
          onAccept={gameAccept}
          onDecline={gameDecline}
          onCancel={gameCancel}
          onRematch={rematchGame}
          onForfeit={gameForfeit}
          onViewHistory={(conversationId) => setHistoryConvId(conversationId)}
          onClose={() => setOpenGameConvId(null)}
        />
      )}

      {infoPanelMsgId &&
        (() => {
          const infoMsg = activeMessages.find((m) => m.id === infoPanelMsgId);
          if (!infoMsg) return null;
          return (
            <div className="modal-backdrop" onClick={() => setInfoPanelMsgId(null)}>
              <div
                className="modal-card"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: "320px" }}
              >
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setInfoPanelMsgId(null)}
                >
                  ✕
                </button>
                <h3 style={{ margin: "0 0 14px" }}>Message info</h3>
                {infoMsg.text && (
                  <div className="msg-info-preview">{infoMsg.text}</div>
                )}
                <div className="msg-info-rows">
                  <div className="msg-info-row">
                    <svg className="icon" width="16" height="16">
                      <use href="#check-single-icon" />
                    </svg>
                    <span className="msg-info-label">Sent</span>
                    <span className="msg-info-value">
                      {formatFullDateTime(infoMsg.createdAt || infoMsg.timestamp)}
                    </span>
                  </div>
                  <div className="msg-info-row">
                    <svg className="icon" width="16" height="16">
                      <use href="#check-double-icon" />
                    </svg>
                    <span className="msg-info-label">Delivered</span>
                    <span className="msg-info-value">
                      {infoMsg.deliveredAt ? formatFullDateTime(infoMsg.deliveredAt) : "Not yet"}
                    </span>
                  </div>
                  <div className="msg-info-row">
                    <svg className="icon" width="16" height="16" style={{ color: "#47c0ff" }}>
                      <use href="#check-double-icon" />
                    </svg>
                    <span className="msg-info-label">Seen</span>
                    <span className="msg-info-value">
                      {infoMsg.seenAt ? formatFullDateTime(infoMsg.seenAt) : "Not yet"}
                    </span>
                  </div>
                  {infoMsg.editedAt && (
                    <div className="msg-info-row">
                      <svg className="icon" width="16" height="16">
                        <use href="#edit-pencil-icon" />
                      </svg>
                      <span className="msg-info-label">Edited</span>
                      <span className="msg-info-value">
                        {formatFullDateTime(infoMsg.editedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {playingReaction && (
        <div className="modal-backdrop" onClick={() => setPlayingReaction(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "300px", textAlign: "center" }}>
            <button type="button" className="modal-close" onClick={() => setPlayingReaction(null)}>
              ✕
            </button>
            <h3 style={{ margin: "0 0 14px" }}>
              {playingReaction.kind === "video" ? "🎥 Video reaction" : "🎙️ Voice reaction"}
            </h3>
            {playingReaction.kind === "video" ? (
              <video src={mediaSrc(playingReaction.url)} controls autoPlay style={{ width: "100%", borderRadius: "8px" }} />
            ) : (
              <audio src={mediaSrc(playingReaction.url)} controls autoPlay style={{ width: "100%" }} />
            )}
          </div>
        </div>
      )}

      {historyConvId && (
        <GameHistory
          serverUrl={SERVER_URL}
          token={tokenRef.current}
          myUserId={userId}
          conversationId={historyConvId === "all" ? null : historyConvId}
          onClose={() => setHistoryConvId(null)}
        />
      )}

      <CallOverlay
        callState={callState}
        callType={callType}
        callRole={callRole}
        peerUsername={callPeer?.username}
        peerAvatarUrl={callPeer?.avatarUrl ? mediaSrc(callPeer.avatarUrl) : null}
        localStream={localStream}
        remoteStream={remoteStream}
        micOn={micOn}
        camOn={camOn}
        speakerOn={speakerOn}
        callStartedAt={callStartedAt}
        onAccept={acceptCall}
        onDecline={declineCall}
        onEnd={endCall}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onToggleSpeaker={toggleSpeaker}
        onSwitchCamera={switchCamera}
      />

      {groupCallConvId && (
        <GroupCallOverlay
          socket={socket}
          conversationId={groupCallConvId}
          conversationName={
            conversations.find((c) => c.id === groupCallConvId)?.name ||
            "Group call"
          }
          myUsername={username}
          onClose={() => setGroupCallConvId(null)}
        />
      )}

      {incomingGroupCall && !groupCallConvId && (
        <div className="group-call-toast">
          <span className="group-call-toast-avatar">
            <svg className="icon" width="18" height="18">
              <use href="#video-call-icon" />
            </svg>
          </span>
          <div className="group-call-toast-body">
            <div className="group-call-toast-title">
              <strong>{incomingGroupCall.fromUsername}</strong> started a call
            </div>
            <div className="group-call-toast-sub">in {incomingGroupCall.conversationName}</div>
          </div>
          <div className="group-call-toast-actions">
            <button
              type="button"
              className="group-call-toast-btn join"
              title="Join call"
              onClick={() => {
                setGroupCallConvId(incomingGroupCall.conversationId);
                setIncomingGroupCall(null);
              }}
            >
              <svg className="icon" width="18" height="18">
                <use href="#phone-icon" />
              </svg>
            </button>
            <button
              type="button"
              className="group-call-toast-btn dismiss"
              title="Dismiss"
              onClick={() => setIncomingGroupCall(null)}
            >
              <svg className="icon" width="15" height="15">
                <use href="#close-icon" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <div className="toast-title">{t.title}</div>
            {t.body && <div className="toast-body">{t.body}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;