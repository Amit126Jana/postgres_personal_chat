import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import AuthPage from "./AuthPage.jsx";
import EmojiPicker from "./EmojiPicker.jsx";
import ReactionPicker from "./ReactionPicker.jsx";
import CallOverlay from "./CallOverlay.jsx";
import GroupCallOverlay from "./GroupCallOverlay.jsx";
import NewChatModal from "./NewChatModal.jsx";
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

  // --- Profile / account ---
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [tagline, setTagline] = useState("");
  const [themeColor, setThemeColor] = useState("violet");
  const [showOnline, setShowOnline] = useState(true);
  const [activeView, setActiveView] = useState("chats"); // "chats" | "profile" | "groups" | "contacts" | "settings"
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("mf_theme_mode") !== "light",
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [groupAvatarUploading, setGroupAvatarUploading] = useState(false);
  const groupAvatarInputRef = useRef(null);
  const [resuming, setResuming] = useState(false); // auto-relogin in progress after a page refresh

  // --- Conversations & messages ---
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messagesByConv, setMessagesByConv] = useState({}); // conversationId -> array
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
  const [uploading, setUploading] = useState(false);
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
  const [callPeer, setCallPeer] = useState(null); // { id, username }
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

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
  const typingTimeout = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const callPeerRef = useRef(null); // mirrors callPeer for use in socket callbacks
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
  function teardownCall() {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState(null);
    setCallPeer(null);
    callPeerRef.current = null;
    setMicOn(true);
    setCamOn(true);
  }

  function createPeerConnection(remoteId) {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("call:signal", {
          toId: remoteId,
          signal: { type: "candidate", candidate: e.candidate },
        });
      }
    };
    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0]);
    };
    pcRef.current = pc;
    return pc;
  }

  async function getLocalMedia() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }

  function startCall(toUserId, toUsername) {
    setCallState("calling");
    setCallPeer({ id: toUserId, username: toUsername });
    callPeerRef.current = { id: toUserId, username: toUsername };
    socket.emit("call:invite:user", { toUserId });
  }

  async function acceptCall() {
    const peer = callPeerRef.current;
    if (!peer) return;
    try {
      await getLocalMedia();
      setCallState("connecting");
      socket.emit("call:answer", { toId: peer.id, accepted: true });
    } catch (err) {
      console.error("Could not access camera/mic", err);
      socket.emit("call:answer", { toId: peer.id, accepted: false });
      teardownCall();
    }
  }

  function declineCall() {
    const peer = callPeerRef.current;
    if (peer) socket.emit("call:answer", { toId: peer.id, accepted: false });
    teardownCall();
  }

  function endCall() {
    const peer = callPeerRef.current;
    if (peer) socket.emit("call:end", { toId: peer.id });
    teardownCall();
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

    if (notifPermissionRef.current === "granted" && document.hidden) {
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
        tagline: tl,
        themeColor: tc,
        showOnline: so,
        wallpapers: serverWallpapers,
        hiddenMessageIds,
        clearedChats,
      }) => {
        setLoginError("");
        setResuming(false);
        setUserId(uid);
        setUsername(confirmedName);
        setPhoneNumber(confirmedPhone);
        setAvatarUrl(aUrl || null);
        setTagline(tl || "");
        setThemeColor(tc || "violet");
        setShowOnline(so !== false);
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
        tagline: tl,
        themeColor: tc,
        showOnline: so,
      }) => {
        setUsername(uName);
        setAvatarUrl(aUrl || null);
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
    // JWT. Distinct from "login:error", which is for errors emitted after a successful handshake.
    socket.on("connect_error", () => {
      setResuming(false);
      setJoined(false);
      setLoginError("Your session expired. Please log in again.");
      tokenRef.current = "";
      localStorage.removeItem("mf_token");
    });

    // Initial conversation list on login.
    socket.on("conversations", (list) => {
      setConversations(list);
      if (list.length > 0) {
        setActiveConvId((prev) => prev || list[0].id);
      }
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

    // --- Call signaling ---
    socket.on("call:invite", ({ fromId, fromUsername }) => {
      if (callPeerRef.current) {
        socket.emit("call:answer", { toId: fromId, accepted: false });
        return;
      }
      setCallState("ringing");
      setCallPeer({ id: fromId, username: fromUsername });
      callPeerRef.current = { id: fromId, username: fromUsername };
    });

    socket.on("call:answer", async ({ fromId, accepted }) => {
      if (!accepted) {
        teardownCall();
        return;
      }
      try {
        const stream = await getLocalMedia();
        const pc = createPeerConnection(fromId);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:signal", {
          toId: fromId,
          signal: { type: "offer", sdp: offer },
        });
        setCallState("connecting");
      } catch (err) {
        console.error("Failed to start call", err);
        teardownCall();
      }
    });

    socket.on("call:signal", async ({ fromId, signal }) => {
      try {
        if (signal.type === "offer") {
          const pc = pcRef.current || createPeerConnection(fromId);
          const stream = localStreamRef.current;
          if (stream)
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("call:signal", {
            toId: fromId,
            signal: { type: "answer", sdp: answer },
          });
          setCallState("active");
        } else if (signal.type === "answer") {
          await pcRef.current?.setRemoteDescription(
            new RTCSessionDescription(signal.sdp),
          );
          setCallState("active");
        } else if (signal.type === "candidate") {
          await pcRef.current?.addIceCandidate(
            new RTCIceCandidate(signal.candidate),
          );
        }
      } catch (err) {
        console.error("Signal handling failed", err);
      }
    });

    socket.on("call:end", () => {
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

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messagesByConv, activeConvId]);

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
    if (!text || !activeConvId) return;
    if (selectMode) {
      setSelectModeGuard({ kind: "send", action: () => actuallySendDraft(text) });
      return;
    }
    actuallySendDraft(text);
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

  async function handleFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeConvId) return;
    setUploading(true);
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
      alert("Media upload failed. Please try a smaller file (max 25MB).");
    } finally {
      setUploading(false);
    }
  }

  function startDirectChat(otherUserId) {
    socket.emit("conversation:direct", { withUserId: otherUserId });
    setShowNewChat(false);
  }

  function startGroupChat(name, memberIds) {
    socket.emit("conversation:group", { name, memberIds });
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

  function logout() {
    tokenRef.current = "";
    localStorage.removeItem("mf_token");
    teardownCall();
    socket.disconnect();
    setJoined(false);
    setUserId(null);
    setPhoneNumber("");
    setUsername("");
    setAvatarUrl(null);
    setTagline("");
    setThemeColor("violet");
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
        <div className="rail-brand">
          <img src="/logo.png" alt="MakeFriends" />
        </div>
        <button
          type="button"
          className={"rail-btn" + (activeView === "chats" ? " active" : "")}
          title="Chats"
          onClick={() => runOrConfirmLeaveSelect(() => setActiveView("chats"))}
        >
          <svg className="icon" width="22" height="22">
            <use href="#chat-icon" />
          </svg>
        </button>
        <button
          type="button"
          className={"rail-btn" + (activeView === "profile" ? " active" : "")}
          title="Profile"
          onClick={() => runOrConfirmLeaveSelect(() => setActiveView("profile"))}
        >
          <svg className="icon" width="22" height="22">
            <use href="#profile-icon" />
          </svg>
        </button>
        <button
          type="button"
          className={"rail-btn" + (activeView === "groups" ? " active" : "")}
          title="Groups"
          onClick={() => runOrConfirmLeaveSelect(() => setActiveView("groups"))}
        >
          <svg className="icon" width="22" height="22">
            <use href="#groups-icon" />
          </svg>
        </button>
        <button
          type="button"
          className={"rail-btn" + (activeView === "contacts" ? " active" : "")}
          title="Contacts"
          onClick={() => runOrConfirmLeaveSelect(() => setActiveView("contacts"))}
        >
          <svg className="icon" width="22" height="22">
            <use href="#contacts-icon" />
          </svg>
        </button>
        <div className="rail-spacer" />
        <button
          type="button"
          className="rail-btn"
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setDarkMode((v) => !v)}
        >
          <svg className="icon" width="20" height="20">
            <use href={darkMode ? "#sun-icon" : "#moon-icon"} />
          </svg>
        </button>
        <button
          type="button"
          className={"rail-btn" + (activeView === "settings" ? " active" : "")}
          title="Settings"
          onClick={() => runOrConfirmLeaveSelect(() => setActiveView("settings"))}
        >
          <svg className="icon" width="22" height="22">
            <use href="#settings-icon" />
          </svg>
        </button>
        <button
          type="button"
          className="rail-btn rail-avatar"
          title={username}
          onClick={() => runOrConfirmLeaveSelect(() => setActiveView("profile"))}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <span>{initials(username)}</span>
          )}
        </button>
      </nav>

      {activeView === "settings" ? (
        <SettingsPanel
          profile={{
            username,
            phoneNumber,
            avatarUrl,
            tagline,
            themeColor,
            showOnline,
          }}
          connected={connected}
          uploading={avatarUploading}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((v) => !v)}
          onUploadAvatar={handleAvatarUpload}
          onSave={saveProfile}
          onLogout={logout}
          onClose={() => setActiveView("chats")}
        />
      ) : activeView === "profile" ? (
        <ProfilePage
          profile={{ username, phoneNumber, avatarUrl, tagline }}
          connected={connected}
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
          onCall={(otherId, otherName) => startCall(otherId, otherName)}
          onNewChat={() => setShowNewChat(true)}
          mediaSrc={mediaSrc}
        />
      ) : (
        <>
          <aside className="sidebar">
            <div className="brand">
              <img src="/logo.png" alt="" className="brand-logo" />
              MakeFriends
              <span className={"pulse-dot" + (connected ? "" : " off")} />
            </div>
            <button
              type="button"
              className="new-chat-btn"
              onClick={() => setShowNewChat(true)}
            >
              + New chat / group
            </button>
            <div className="roster-label">chats — {conversations.length}</div>
            <ul className="roster conv-list">
              {conversations.map((c) => (
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
                  {c.type === "direct" &&
                    (() => {
                      const other = otherMemberOf(c);
                      return other ? (
                        <button
                          type="button"
                          className="call-icon-btn"
                          title={`Video call ${other.username}`}
                          disabled={!!callState}
                          onClick={(e) => {
                            e.stopPropagation();
                            startCall(other.id, other.username);
                          }}
                        >
                          <svg className="icon" width="16" height="16">
                            <use href="#video-call-icon" />
                          </svg>
                        </button>
                      ) : null;
                    })()}
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

          <main className="feed-col">
            {!activeConv ? (
              <div className="empty-state">
                Pick a chat, or start a new one.
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
                    <span
                      className={
                        "room-avatar" + (activeConv.myIsAdmin ? " room-avatar-editable" : "")
                      }
                      title={activeConv.myIsAdmin ? "Change group photo" : ""}
                      onClick={() => {
                        if (activeConv.myIsAdmin) groupAvatarInputRef.current?.click();
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
                  ) : (
                    ""
                  )}
                  {activeConv.type === "group" && (
                    <input
                      ref={groupAvatarInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleGroupAvatarUpload(activeConv.id, file);
                        e.target.value = "";
                      }}
                    />
                  )}
                  <span className="room-title-text">{activeConv.name}</span>
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
                <div className="feed" ref={scrollRef} style={feedBackgroundStyle}>
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
                      <svg className="icon" width="25" height="25">
                        <use href="#attach-icon" />
                      </svg>
                    )}
                  </button>
                  <input
                    placeholder="send a line…"
                    value={draft}
                    onChange={handleDraftChange}
                    maxLength={2000}
                  />
                  <button
                    type="submit"
                    className="send_btn"
                    disabled={!draft.trim()}
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
        peerUsername={callPeer?.username}
        localStream={localStream}
        remoteStream={remoteStream}
        micOn={micOn}
        camOn={camOn}
        onAccept={acceptCall}
        onDecline={declineCall}
        onEnd={endCall}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
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
        <div className="incoming-call-banner">
          <span>
            <strong>{incomingGroupCall.fromUsername}</strong> started a call in{" "}
            {incomingGroupCall.conversationName}
          </span>
          <div className="incoming-call-actions">
            <button
              type="button"
              className="call-btn accept"
              onClick={() => {
                setGroupCallConvId(incomingGroupCall.conversationId);
                setIncomingGroupCall(null);
              }}
            >
              Join
            </button>
            <button
              type="button"
              className="call-btn ghost"
              onClick={() => setIncomingGroupCall(null)}
            >
              Dismiss
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