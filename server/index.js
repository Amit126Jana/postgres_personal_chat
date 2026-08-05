import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import {
  initDb,
  createUser,
  getUserWithPasswordByPhone,
  getUserById,
  touchLastSeen,
  listUsers,
  getOrCreateDirectConversation,
  createGroupConversation,
  getUserConversations,
  isConversationMember,
  getConversationMemberIds,
  addMessage,
  getMessages,
  updateUserProfile,
  updateMessageText,
  createPoll,
  votePoll,
  closePoll,
  getPollByMessageId,
  setConversationAvatar,
  isConversationAdmin,
  markMessagesSeen,
  markMessageDelivered,
  markMessagesDeliveredForUser,
  editMessage,
  deleteMessage,
} from "./db.js";
import { GAME_TYPES, createInitialState, applyMove, sanitizeStateForClient, PER_PLAYER_GAMES } from "./games.js";
import { recordGameResult, getGameHistory } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 4000;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("Missing JWT_SECRET in server/.env — set it to a long random string before starting the server.");
  process.exit(1);
}
const TOKEN_EXPIRY = "30d";

// Media (avatars, chat images/video/audio/files) is stored on Cloudinary instead of local
// disk, since hosts like Render wipe the local filesystem on every deploy/restart.
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error(
    "Missing Cloudinary env vars — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in server/.env."
  );
  process.exit(1);
}
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

const PHONE_REGEX = /^\+?[1-9]\d{9,14}$/;
const NAME_REGEX = /^[A-Za-z\s.'-]+$/;

function validateCredentials({ phoneNumber, username, password }) {
  const phone = (phoneNumber || "").toString().trim().replace(/[\s-]/g, "");
  const name = (username || "").toString().trim().slice(0, 24);
  const pass = (password || "").toString();

  if (!phone || !PHONE_REGEX.test(phone)) {
    return { error: "Enter a valid phone number (10-15 digits, optional +country code)." };
  }
  if (username !== undefined) {
    if (!name || name.length < 2) return { error: "Name must be at least 2 characters." };
    if (!NAME_REGEX.test(name)) return { error: "Name can only contain letters, spaces, and . ' -" };
  }
  if (password !== undefined) {
    if (!pass || pass.length < 6) return { error: "Password must be at least 6 characters." };
  }
  return { phone, name, pass };
}

const app = express();
app.use(cors());
app.use(express.json());
app.get("/", (_req, res) => res.send("Chat server is running"));

// --- Media upload (images, audio, video, generic files) ---
// Files are held in memory only long enough to stream them to Cloudinary — nothing
// touches local disk, so uploads survive redeploys.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

function mediaTypeFor(mimetype) {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  return "file";
}

// Cloudinary's own resource_type is coarser than ours: images use "image", video AND
// audio both use "video" (Cloudinary transcodes/streams audio via its video pipeline),
// and everything else (pdf, docs, zip, etc.) uses "raw".
function cloudinaryResourceTypeFor(type) {
  if (type === "image") return "image";
  if (type === "video" || type === "audio") return "video";
  return "raw";
}

function uploadBufferToCloudinary(buffer, { resourceType, originalname }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder: "makefriends-chat",
        // Keep a recognizable public_id without clashing on repeated filenames.
        public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
        filename_override: originalname,
        use_filename: false,
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  try {
    const type = mediaTypeFor(req.file.mimetype);
    const result = await uploadBufferToCloudinary(req.file.buffer, {
      resourceType: cloudinaryResourceTypeFor(type),
      originalname: req.file.originalname,
    });
    res.json({
      mediaUrl: result.secure_url,
      mediaName: req.file.originalname,
      type,
    });
  } catch (err) {
    console.error("Cloudinary upload failed:", err.message);
    res.status(500).json({ error: "Upload failed" });
  }
});

// --- Auth: register a new account / log in to an existing one ---
app.post("/api/auth/register", async (req, res) => {
  try {
    const { phoneNumber, username, password } = req.body || {};
    const result = validateCredentials({ phoneNumber, username, password });
    if (result.error) return res.status(400).json({ error: result.error });

    const passwordHash = await bcrypt.hash(result.pass, 10);
    const user = await createUser(result.phone, result.name, passwordHash);
    const token = signToken(user.id);
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === "PHONE_TAKEN") return res.status(409).json({ error: err.message });
    console.error("register failed:", err.message);
    res.status(500).json({ error: "Could not create your account right now." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { phoneNumber, password } = req.body || {};
    const result = validateCredentials({ phoneNumber, password });
    if (result.error) return res.status(400).json({ error: result.error });

    const row = await getUserWithPasswordByPhone(result.phone);
    // Same generic message whether the phone is unknown or the password is wrong,
    // so we don't leak which phone numbers have accounts.
    const genericError = { error: "Incorrect phone number or password." };
    if (!row || !row.password_hash) return res.status(401).json(genericError);

    const ok = await bcrypt.compare(result.pass, row.password_hash);
    if (!ok) return res.status(401).json(genericError);

    await touchLastSeen(row.id);
    const token = signToken(row.id);
    const user = {
      id: row.id,
      phoneNumber: row.phone_number,
      username: row.username,
      avatarUrl: row.avatar_url,
      tagline: row.tagline,
      themeColor: row.theme_color,
      showOnline: !!row.show_online,
    };
    res.json({ token, user });
  } catch (err) {
    console.error("login failed:", err.message);
    res.status(500).json({ error: "Could not log in right now." });
  }
});

// Verifies a bearer JWT for plain REST routes.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing auth token" });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(payload.userId);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// --- REST: users & conversations (used to populate "new chat" / "new group" UI) ---
app.get("/api/users", requireAuth, async (_req, res) => {
  try {
    res.json(await listUsers());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/conversations", requireAuth, async (req, res) => {
  try {
    res.json(await getUserConversations(req.user.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    if (!(await isConversationMember(req.params.id, req.user.id))) {
      return res.status(403).json({ error: "Not a member of this conversation" });
    }
    res.json(await getMessages(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Past game results for the logged-in user — optionally scoped to a single conversation.
app.get("/api/games/history", requireAuth, async (req, res) => {
  try {
    const conversationId = req.query.conversationId ? Number(req.query.conversationId) : null;
    if (conversationId && !(await isConversationMember(conversationId, req.user.id))) {
      return res.status(403).json({ error: "Not a member of this conversation" });
    }
    res.json(await getGameHistory(req.user.id, conversationId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // tighten this to your client's URL in production
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 1e7,
});

// In-memory state for who's connected right now. Login identity (phone number)
// is persisted in PostgreSQL via db.js — this map is just live socket presence.
const onlineUsers = new Map(); // socket.id -> { userId, socketId, username, phoneNumber }
const userSockets = new Map(); // userId -> Set(socket.id)  (a user may have multiple tabs)

// If any other member of the conversation is currently connected (any tab/socket),
// the message has already reached their client in real time via the room broadcast —
// mark it delivered immediately so the sender sees a double grey tick right away,
// rather than waiting for the recipient to open the chat (which flips it to "seen").
async function deliverIfRecipientOnline(conversationId, senderId, message) {
  try {
    const memberIds = await getConversationMemberIds(conversationId);
    const othersOnline = memberIds.some(
      (id) => id !== senderId && (userSockets.get(id)?.size || 0) > 0
    );
    if (!othersOnline) return message;
    const result = await markMessageDelivered(message.id);
    return result ? { ...message, deliveredAt: result.deliveredAt } : message;
  } catch (err) {
    console.error("deliverIfRecipientOnline failed", err.message);
    return message;
  }
}
const messageReactions = new Map(); // messageId -> Map(emoji -> Set(userId))
const activeGroupCalls = new Map(); // conversationId -> Map(socketId -> { userId, username })

// In-chat mini-games — one active game session per (direct) conversation at a time.
// conversationId -> { id, type, conversationId, players: [userIdA, userIdB], state, messageId }
const gameSessions = new Map();

function gameStatusLabel(session) {
  const { type, status, state } = session;
  const name = GAME_TYPES[type] || type;
  if (status === "pending") return `🎮 ${name} — invite sent`;
  if (status === "declined") return `🎮 ${name} — invite declined`;
  if (status === "cancelled") return `🎮 ${name} — cancelled`;
  if (status === "active") return `🎮 ${name} — in progress`;
  if (status === "finished") {
    return state?.forfeitedBy !== undefined
      ? `🎮 ${name} — ended (forfeit), tap to see result`
      : `🎮 ${name} — game ended, tap to see result`;
  }
  return `🎮 ${name}`;
}

async function broadcastGameSession(io, session) {
  const base = {
    id: session.id,
    type: session.type,
    conversationId: session.conversationId,
    players: session.players,
    invitedBy: session.invitedBy,
    status: session.status,
    messageId: session.messageId,
  };

  if (session.state && PER_PLAYER_GAMES.has(session.type)) {
    // Hidden-info games (e.g. UNO) need a different state payload per player, so
    // send directly to each player's socket(s) instead of one shared room emit.
    session.players.forEach((userId, playerIndex) => {
      const state = sanitizeStateForClient(session.type, session.state, playerIndex);
      for (const socketId of userSockets.get(userId) || []) {
        io.to(socketId).emit("game:session", { ...base, state });
      }
    });
    return;
  }

  const payload = {
    ...base,
    state: session.state ? sanitizeStateForClient(session.type, session.state) : null,
  };
  io.to(convRoom(session.conversationId)).emit("game:session", payload);
}

async function syncGameMessage(io, session) {
  if (!session.messageId) return;
  try {
    const updated = await updateMessageText(session.messageId, gameStatusLabel(session));
    io.to(convRoom(session.conversationId)).emit("message:update", updated);
  } catch (err) {
    console.error("game message sync failed", err.message);
  }
}

function convRoom(conversationId) {
  return `conv:${conversationId}`;
}

function editErrorMessage(code) {
  switch (code) {
    case "forbidden":
      return "You can't edit or delete this message anymore";
    case "window_expired":
      return "This message has been seen — the 1 hour edit/delete window has passed";
    case "not_editable":
      return "Only text messages can be edited";
    default:
      return "That message is no longer available";
  }
}

function groupCallRoom(conversationId) {
  return `groupcall:${conversationId}`;
}

// Every socket connection must present a valid JWT (issued by /api/auth/login or /api/auth/register)
// via `auth: { token }` in the socket.io client handshake. No token, no connection.
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("unauthorized"));
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(payload.userId);
    if (!user) return next(new Error("unauthorized"));
    socket.data.user = user;
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

async function joinAllConversations(socket, userId) {
  const conversations = await getUserConversations(userId);
  for (const c of conversations) socket.join(convRoom(c.id));
  return conversations;
}

io.on("connection", async (socket) => {
  // By the time we get here, the io.use() middleware above has already verified the
  // socket's JWT and loaded the corresponding user — no separate "login" event needed.
  const user = socket.data.user;

  onlineUsers.set(socket.id, {
    userId: user.id,
    socketId: socket.id,
    username: user.username,
    phoneNumber: user.phoneNumber,
  });
  if (!userSockets.has(user.id)) userSockets.set(user.id, new Set());
  userSockets.get(user.id).add(socket.id);

  try {
    const conversations = await joinAllConversations(socket, user.id);
    socket.emit("login:success", {
      userId: user.id,
      username: user.username,
      phoneNumber: user.phoneNumber,
      avatarUrl: user.avatarUrl,
      tagline: user.tagline,
      themeColor: user.themeColor,
      showOnline: user.showOnline,
    });
    socket.emit("conversations", conversations);

    // Catch up delivery receipts for anything sent while this user was offline.
    const deliveredGroups = await markMessagesDeliveredForUser(user.id);
    for (const { conversationId, messageIds } of deliveredGroups) {
      io.to(convRoom(conversationId)).emit("messages:delivered", { conversationId, messageIds });
    }
  } catch (err) {
    console.error("Post-connect setup failed:", err.message);
    socket.emit("login:error", "Could not load your account right now. Please try again.");
  }

  // --- Update profile: name, tagline, avatar, theme color, online-visibility privacy ---
  socket.on("profile:update", async ({ username, tagline, avatarUrl, themeColor, showOnline }) => {
    const me = onlineUsers.get(socket.id);
    if (!me) return;
    try {
      const patch = {};
      if (typeof username === "string" && username.trim()) {
        const cleanName = username.trim().slice(0, 24);
        if (!/^[A-Za-z\s.'-]+$/.test(cleanName) || cleanName.length < 2) {
          socket.emit("profile:error", "Name can only contain letters, spaces, and . ' - (min 2 chars).");
          return;
        }
        patch.username = cleanName;
      }
      if (typeof tagline === "string") patch.tagline = tagline.trim().slice(0, 140) || null;
      if (typeof avatarUrl === "string") patch.avatarUrl = avatarUrl;
      if (typeof themeColor === "string") patch.themeColor = themeColor.slice(0, 60);
      if (typeof showOnline === "boolean") patch.showOnline = showOnline;

      const updated = await updateUserProfile(me.userId, patch);
      if (!updated) return;

      // Keep every live tab/session for this user (and the in-memory presence map) in sync.
      for (const sid of userSockets.get(me.userId) || []) {
        const entry = onlineUsers.get(sid);
        if (entry) entry.username = updated.username;
        io.to(sid).emit("profile:updated", updated);
      }
    } catch (err) {
      console.error("profile:update failed", err.message);
      socket.emit("profile:error", "Could not save your profile right now.");
    }
  });

  // --- Directory: everyone who has ever logged in, so the user can start a chat ---
  socket.on("users:list", async () => {
    try {
      socket.emit("users:list", await listUsers());
    } catch (err) {
      console.error("users:list failed", err.message);
    }
  });

  // --- Start (or resume) a 1:1 private chat ---
  socket.on("conversation:direct", async ({ withUserId }) => {
    const me = onlineUsers.get(socket.id);
    if (!me || !withUserId) return;
    try {
      const conversationId = await getOrCreateDirectConversation(me.userId, withUserId);
      socket.join(convRoom(conversationId));
      // Make sure the other party (if online) also joins the room live.
      // IMPORTANT: a direct conversation's `name` is computed per-viewer (it's
      // "the other member's username"), so each side must get its OWN copy of
      // the conversation object — reusing the initiator's copy would show the
      // recipient their own name instead of the sender's, until they refresh.
      for (const sid of userSockets.get(withUserId) || []) {
        io.sockets.sockets.get(sid)?.join(convRoom(conversationId));
        const [theirConversation] = (await getUserConversations(withUserId)).filter(
          (c) => c.id === conversationId,
        );
        io.to(sid).emit("conversation:new", theirConversation);
      }
      const [myConversation] = (await getUserConversations(me.userId)).filter(
        (c) => c.id === conversationId,
      );
      socket.emit("conversation:new", myConversation);
    } catch (err) {
      console.error("conversation:direct failed", err.message);
    }
  });

  // --- Create a group chat ---
  socket.on("conversation:group", async ({ name, memberIds }) => {
    const me = onlineUsers.get(socket.id);
    if (!me || !name?.toString().trim()) return;
    try {
      const cleanName = name.toString().trim().slice(0, 80);
      const ids = Array.isArray(memberIds) ? memberIds.filter((id) => id !== me.userId) : [];
      const conversationId = await createGroupConversation(cleanName, me.userId, ids);
      const [conversation] = (await getUserConversations(me.userId)).filter((c) => c.id === conversationId);

      for (const memberId of [me.userId, ...ids]) {
        for (const sid of userSockets.get(memberId) || []) {
          io.sockets.sockets.get(sid)?.join(convRoom(conversationId));
          io.to(sid).emit("conversation:new", conversation);
        }
      }
    } catch (err) {
      console.error("conversation:group failed", err.message);
    }
  });

  // --- Fetch message history for a conversation ---
  socket.on("conversation:history", async ({ conversationId }) => {
    const me = onlineUsers.get(socket.id);
    if (!me || !conversationId) return;
    try {
      if (!(await isConversationMember(conversationId, me.userId))) return;
      const messages = await getMessages(conversationId);
      socket.emit("conversation:history", { conversationId, messages });
    } catch (err) {
      console.error("conversation:history failed", err.message);
    }
  });

  // --- Send a message: text, or media (image/video/audio/file) already uploaded via /api/upload ---
  socket.on("message", async ({ conversationId, text, type, mediaUrl, mediaName }) => {
    const me = onlineUsers.get(socket.id);
    if (!me || !conversationId) return;
    if (!(await isConversationMember(conversationId, me.userId))) return;

    const kind = type && type !== "text" ? type : "text";
    if (kind === "text" && !text?.toString().trim()) return;

    try {
      const saved = await addMessage({
        conversationId,
        userId: me.userId,
        type: kind,
        text: text ? text.toString().slice(0, 2000) : null,
        mediaUrl,
        mediaName,
      });
      const delivered = await deliverIfRecipientOnline(conversationId, me.userId, saved);
      io.to(convRoom(conversationId)).emit("message", delivered);
    } catch (err) {
      console.error("message failed", err.message);
    }
  });

  // --- Mark all of another sender's messages in this conversation as seen ---
  // Call when a user opens/focuses a conversation. Drives the edit/delete window.
  socket.on("conversation:read", async ({ conversationId }) => {
    const me = onlineUsers.get(socket.id);
    if (!me || !conversationId) return;
    try {
      if (!(await isConversationMember(conversationId, me.userId))) return;
      const seenIds = await markMessagesSeen(conversationId, me.userId);
      if (seenIds.length > 0) {
        io.to(convRoom(conversationId)).emit("messages:seen", {
          conversationId,
          messageIds: seenIds,
          seenBy: me.userId,
        });
      }
    } catch (err) {
      console.error("conversation:read failed", err.message);
    }
  });

  // --- Edit a text message (sender only, within the allowed window) ---
  socket.on("message:edit", async ({ conversationId, messageId, text }) => {
    const me = onlineUsers.get(socket.id);
    if (!me || !conversationId || !messageId) return;
    const cleanText = text?.toString().trim();
    if (!cleanText) return;
    try {
      if (!(await isConversationMember(conversationId, me.userId))) return;
      const result = await editMessage(messageId, me.userId, cleanText.slice(0, 2000));
      if (result.error) {
        socket.emit("message:error", { message: editErrorMessage(result.error) });
        return;
      }
      io.to(convRoom(conversationId)).emit("message:update", result.message);
    } catch (err) {
      console.error("message:edit failed", err.message);
    }
  });

  // --- Delete a message: sender within their window, or a group admin within 24h ---
  socket.on("message:delete", async ({ conversationId, messageId }) => {
    const me = onlineUsers.get(socket.id);
    if (!me || !conversationId || !messageId) return;
    try {
      if (!(await isConversationMember(conversationId, me.userId))) return;
      const result = await deleteMessage(messageId, me.userId);
      if (result.error) {
        socket.emit("message:error", { message: editErrorMessage(result.error) });
        return;
      }
      io.to(convRoom(conversationId)).emit("message:update", result.message);
    } catch (err) {
      console.error("message:delete failed", err.message);
    }
  });

  // --- Group admin: set/change the group photo (upload the file via /api/upload first) ---
  socket.on("group:avatar", async ({ conversationId, avatarUrl }) => {
    const me = onlineUsers.get(socket.id);
    if (!me || !conversationId) return;
    try {
      if (!(await isConversationMember(conversationId, me.userId))) return;
      const isAdmin = await isConversationAdmin(conversationId, me.userId);
      if (!isAdmin) {
        socket.emit("message:error", { message: "Only a group admin can change the group photo" });
        return;
      }
      const saved = await setConversationAvatar(conversationId, me.userId, avatarUrl);
      if (saved === null) return;
      io.to(convRoom(conversationId)).emit("group:avatar:updated", { conversationId, avatarUrl: saved });
    } catch (err) {
      console.error("group:avatar failed", err.message);
    }
  });

  // --- In-chat mini-games (1:1 conversations only) ---

  // Invite the other person in a direct chat to play a game. Posts a special
  // "game" message into the conversation (so it shows inline like any other message).
  socket.on("game:invite", async ({ conversationId, gameType }) => {
    const me = onlineUsers.get(socket.id);
    if (!me || !conversationId || !GAME_TYPES[gameType]) return;
    try {
      if (!(await isConversationMember(conversationId, me.userId))) return;
      const memberIds = await getConversationMemberIds(conversationId);
      if (memberIds.length !== 2) {
        socket.emit("game:error", { message: "Games are only available in 1:1 chats" });
        return;
      }
      if (gameSessions.has(conversationId) && gameSessions.get(conversationId).status !== "declined" &&
          gameSessions.get(conversationId).status !== "finished" && gameSessions.get(conversationId).status !== "cancelled") {
        socket.emit("game:error", { message: "There's already an active game in this chat" });
        return;
      }
      const players = memberIds[0] === me.userId ? memberIds : [memberIds[1], memberIds[0]];
      const saved = await addMessage({
        conversationId,
        userId: me.userId,
        type: "game",
        text: `🎮 ${GAME_TYPES[gameType]} — invite sent`,
      });
      const session = {
        id: `${conversationId}-${Date.now()}`,
        type: gameType,
        conversationId,
        players, // players[0] = inviter, players[1] = invitee
        invitedBy: me.userId,
        status: "pending",
        state: null,
        messageId: saved.id,
      };
      gameSessions.set(conversationId, session);
      const deliveredGame = await deliverIfRecipientOnline(conversationId, me.userId, saved);
      io.to(convRoom(conversationId)).emit("message", { ...deliveredGame, reactions: {} });
      await broadcastGameSession(io, session);
    } catch (err) {
      console.error("game:invite failed", err.message);
    }
  });

  // Invitee accepts -> game actually starts.
  socket.on("game:accept", async ({ conversationId }) => {
    const me = onlineUsers.get(socket.id);
    const session = gameSessions.get(conversationId);
    if (!me || !session || session.status !== "pending") return;
    if (session.players[1] !== me.userId) return; // only the invitee can accept
    try {
      session.status = "active";
      session.state = createInitialState(session.type);
      await syncGameMessage(io, session);
      await broadcastGameSession(io, session);
    } catch (err) {
      console.error("game:accept failed", err.message);
    }
  });

  socket.on("game:decline", async ({ conversationId }) => {
    const me = onlineUsers.get(socket.id);
    const session = gameSessions.get(conversationId);
    if (!me || !session || session.status !== "pending") return;
    if (session.players[1] !== me.userId) return;
    session.status = "declined";
    await syncGameMessage(io, session);
    await broadcastGameSession(io, session);
    gameSessions.delete(conversationId);
  });

  socket.on("game:cancel", async ({ conversationId }) => {
    const me = onlineUsers.get(socket.id);
    const session = gameSessions.get(conversationId);
    if (!me || !session) return;
    if (!session.players.includes(me.userId)) return;
    session.status = "cancelled";
    await syncGameMessage(io, session);
    await broadcastGameSession(io, session);
    gameSessions.delete(conversationId);
  });

  // A move/action within an active game (board click, dice roll, letter guess, truth/dare choice, etc).
  socket.on("game:move", async ({ conversationId, move }) => {
    const me = onlineUsers.get(socket.id);
    const session = gameSessions.get(conversationId);
    if (!me || !session || session.status !== "active") return;
    const playerIndex = session.players.indexOf(me.userId);
    if (playerIndex === -1) return;
    const { state, error } = applyMove(session.type, session.state, move, playerIndex);
    session.state = state;
    if (error) {
      socket.emit("game:error", { message: error });
      return;
    }
    if (state.status === "won" || state.status === "draw") {
      session.status = "finished";
      await syncGameMessage(io, session);
      await broadcastGameSession(io, session);
      try {
        const winnerUserId =
          typeof state.winner === "number" ? session.players[state.winner] : null;
        await recordGameResult({
          conversationId,
          gameType: session.type,
          player1Id: session.players[0],
          player2Id: session.players[1],
          winnerUserId,
          result: state.status === "draw" ? "draw" : "win",
        });
      } catch (err) {
        console.error("game history save failed", err.message);
      }
      gameSessions.delete(conversationId);
    } else {
      await broadcastGameSession(io, session);
    }
  });

  // A player exits an active game early — counts as a forfeit (the other player wins).
  socket.on("game:forfeit", async ({ conversationId }) => {
    const me = onlineUsers.get(socket.id);
    const session = gameSessions.get(conversationId);
    if (!me || !session || session.status !== "active") return;
    const playerIndex = session.players.indexOf(me.userId);
    if (playerIndex === -1) return;
    const winnerIndex = 1 - playerIndex;
    session.status = "finished";
    session.state = { ...session.state, status: "won", winner: winnerIndex, forfeitedBy: playerIndex };
    await syncGameMessage(io, session);
    await broadcastGameSession(io, session);
    try {
      await recordGameResult({
        conversationId,
        gameType: session.type,
        player1Id: session.players[0],
        player2Id: session.players[1],
        winnerUserId: session.players[winnerIndex],
        result: "forfeit",
      });
    } catch (err) {
      console.error("game history save failed", err.message);
    }
    gameSessions.delete(conversationId);
  });

  // Lets a client re-fetch the live session when re-opening the game overlay.
  socket.on("game:sync", async ({ conversationId }) => {
    const session = gameSessions.get(conversationId);
    if (session) await broadcastGameSession(io, session);
  });

  // --- Emoji reactions on messages (scoped to a conversation room) ---
  socket.on("reaction", ({ conversationId, messageId, emoji }) => {
    const me = onlineUsers.get(socket.id);
    if (!me || !conversationId || !messageId || !emoji) return;

    if (!messageReactions.has(messageId)) {
      messageReactions.set(messageId, new Map()); // emoji -> Set(userId)
    }
    const byEmoji = messageReactions.get(messageId);
    if (!byEmoji.has(emoji)) byEmoji.set(emoji, new Set());
    const reactors = byEmoji.get(emoji);

    if (reactors.has(me.userId)) {
      reactors.delete(me.userId);
      if (reactors.size === 0) byEmoji.delete(emoji);
    } else {
      reactors.add(me.userId);
    }

    const summary = {};
    for (const [e, ids] of byEmoji.entries()) {
      summary[e] = [...ids].map((uid) => {
        for (const u of onlineUsers.values()) if (u.userId === uid) return u.username;
        return "someone";
      });
    }
    io.to(convRoom(conversationId)).emit("reaction", { messageId, reactions: summary });
  });

  // --- Real-time polls (posted as a special message type, live-updated for everyone in the room) ---
  socket.on("poll:create", async ({ conversationId, question, options, allowMultiple }) => {
    const me = onlineUsers.get(socket.id);
    if (!me || !conversationId) return;
    try {
      if (!(await isConversationMember(conversationId, me.userId))) return;
      const q = (question || "").toString().trim().slice(0, 300);
      const opts = (Array.isArray(options) ? options : [])
        .map((o) => (o || "").toString().trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, 8);
      if (!q || opts.length < 2) {
        socket.emit("poll:error", { message: "A poll needs a question and at least 2 options" });
        return;
      }
      const saved = await addMessage({
        conversationId,
        userId: me.userId,
        type: "poll",
        text: `📊 ${q}`,
      });
      const poll = await createPoll({
        conversationId,
        messageId: saved.id,
        createdBy: me.userId,
        question: q,
        options: opts,
        allowMultiple: !!allowMultiple,
      });
      io.to(convRoom(conversationId)).emit("message", { ...(await deliverIfRecipientOnline(conversationId, me.userId, saved)), reactions: {} });
      io.to(convRoom(conversationId)).emit("poll:update", poll);
    } catch (err) {
      console.error("poll:create failed", err.message);
    }
  });

  socket.on("poll:vote", async ({ conversationId, pollId, optionIndex }) => {
    const me = onlineUsers.get(socket.id);
    if (!me || !conversationId || typeof pollId !== "number" && typeof pollId !== "string") return;
    try {
      if (!(await isConversationMember(conversationId, me.userId))) return;
      const poll = await votePoll(pollId, me.userId, optionIndex);
      if (poll) io.to(convRoom(conversationId)).emit("poll:update", poll);
    } catch (err) {
      console.error("poll:vote failed", err.message);
    }
  });

  socket.on("poll:close", async ({ conversationId, pollId }) => {
    const me = onlineUsers.get(socket.id);
    if (!me || !conversationId) return;
    try {
      if (!(await isConversationMember(conversationId, me.userId))) return;
      const poll = await closePoll(pollId, me.userId);
      if (poll) io.to(convRoom(conversationId)).emit("poll:update", poll);
    } catch (err) {
      console.error("poll:close failed", err.message);
    }
  });

  // Lets a client fetch the latest poll tally for a message (e.g. after re-joining a room).
  socket.on("poll:sync", async ({ messageId }) => {
    try {
      const poll = await getPollByMessageId(messageId);
      if (poll) socket.emit("poll:update", poll);
    } catch (err) {
      console.error("poll:sync failed", err.message);
    }
  });

  // --- WebRTC video/audio call signaling (1:1 calls, server just relays) ---
  socket.on("call:invite", ({ toId }) => {
    const caller = onlineUsers.get(socket.id);
    if (!caller || !onlineUsers.has(toId)) return;
    io.to(toId).emit("call:invite", { fromId: socket.id, fromUsername: caller.username });
  });

  // Call by persistent userId (e.g. from a conversation member list) — resolved to
  // whichever of their live sockets is currently connected.
  socket.on("call:invite:user", ({ toUserId }) => {
    const caller = onlineUsers.get(socket.id);
    if (!caller) return;
    const targetSocketId = [...(userSockets.get(toUserId) || [])][0];
    if (!targetSocketId) {
      socket.emit("call:answer", { fromId: toUserId, accepted: false, reason: "offline" });
      return;
    }
    io.to(targetSocketId).emit("call:invite", { fromId: socket.id, fromUsername: caller.username });
  });

  socket.on("call:answer", ({ toId, accepted }) => {
    io.to(toId).emit("call:answer", { fromId: socket.id, accepted });
  });

  socket.on("call:signal", ({ toId, signal }) => {
    io.to(toId).emit("call:signal", { fromId: socket.id, signal });
  });

  socket.on("call:end", ({ toId }) => {
    io.to(toId).emit("call:end", { fromId: socket.id });
  });

  // --- WebRTC group video calls (mesh, capped at 8 participants) ---
  socket.on("group-call:start", async ({ conversationId }) => {
    const me = onlineUsers.get(socket.id);
    if (!me || !conversationId) return;
    if (!(await isConversationMember(conversationId, me.userId))) return;
    socket.to(convRoom(conversationId)).emit("group-call:incoming", {
      conversationId,
      fromUsername: me.username,
    });
  });

  socket.on("group-call:join", async ({ conversationId }) => {
    const me = onlineUsers.get(socket.id);
    if (!me || !conversationId) return;
    if (!(await isConversationMember(conversationId, me.userId))) return;

    const room = groupCallRoom(conversationId);
    if (!activeGroupCalls.has(conversationId)) activeGroupCalls.set(conversationId, new Map());
    const participants = activeGroupCalls.get(conversationId);

    if (participants.size >= 8 && !participants.has(socket.id)) {
      socket.emit("group-call:full", { conversationId });
      return;
    }

    const existing = [...participants.entries()].map(([sid, info]) => ({ socketId: sid, ...info }));
    participants.set(socket.id, { userId: me.userId, username: me.username });
    socket.join(room);

    socket.emit("group-call:joined", { conversationId, participants: existing });
    socket.to(room).emit("group-call:peer-joined", {
      conversationId,
      socketId: socket.id,
      userId: me.userId,
      username: me.username,
    });
  });

  socket.on("group-call:signal", ({ toSocketId, signal }) => {
    if (!toSocketId || !signal) return;
    io.to(toSocketId).emit("group-call:signal", { fromSocketId: socket.id, signal });
  });

  socket.on("group-call:leave", ({ conversationId }) => {
    leaveGroupCall(socket, conversationId);
  });

  function leaveGroupCall(sock, conversationId) {
    const participants = activeGroupCalls.get(conversationId);
    if (!participants || !participants.has(sock.id)) return;
    participants.delete(sock.id);
    sock.leave(groupCallRoom(conversationId));
    sock.to(groupCallRoom(conversationId)).emit("group-call:peer-left", { conversationId, socketId: sock.id });
    if (participants.size === 0) activeGroupCalls.delete(conversationId);
  }

  socket.on("typing", ({ conversationId, isTyping }) => {
    const user = onlineUsers.get(socket.id);
    if (!user || !conversationId) return;
    socket.to(convRoom(conversationId)).emit("typing", { conversationId, username: user.username, isTyping });
  });

  socket.on("disconnect", () => {
    const user = onlineUsers.get(socket.id);
    onlineUsers.delete(socket.id);
    if (user) {
      userSockets.get(user.userId)?.delete(socket.id);
      if (userSockets.get(user.userId)?.size === 0) userSockets.delete(user.userId);
    }
    for (const conversationId of [...activeGroupCalls.keys()]) {
      leaveGroupCall(socket, conversationId);
    }
  });
});

initDb()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Chat server listening on http://0.0.0.0:${PORT} (reachable on your LAN)`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize PostgreSQL:", err.message);
    console.error("Check server/.env — DB_HOST, DB_USER, DB_PASSWORD, DB_NAME must be correct, and PostgreSQL must be running.");
    process.exit(1);
  });