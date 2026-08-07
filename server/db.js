import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

let pool;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
} else {
  pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "ChatApp",
    max: 10,
  });
}

export default pool;

// Runs a MySQL-style `?`-placeholder query against Postgres (which uses $1, $2, ...)
// and returns a `[rows]` tuple so the rest of this file — originally written against
// mysql2's `[rows] = await pool.query(...)` style — didn't need to change shape.
async function query(sql, params = []) {
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  const result = await pool.query(text, params);
  return [result.rows, result];
}

// Creates all tables if they don't already exist. Called once on server start.
export async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      phone_number VARCHAR(20) NOT NULL UNIQUE,
      username VARCHAR(50) NOT NULL,
      password_hash VARCHAR(255) NULL,
      avatar_url VARCHAR(500) NULL,
      tagline VARCHAR(140) NULL,
      theme_color VARCHAR(60) NOT NULL DEFAULT 'blue',
      show_online SMALLINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Widen theme_color for existing databases created before gradient support was
  // added (gradients are encoded as "grad:#rrggbb,#rrggbb", which needs more than
  // the original 20 chars). No-op if the column is already wide enough.
  await query(`ALTER TABLE users ALTER COLUMN theme_color TYPE VARCHAR(60)`);

  // Global in-app admin flag (separate from conversation_members.is_admin, which is
  // only per-group). Grants access to the Admin section inside the chat app itself.
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin SMALLINT NOT NULL DEFAULT 0`);

  // A conversation is either a 1:1 "direct" chat or a named "group" chat.
  await query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      type VARCHAR(10) NOT NULL CHECK (type IN ('direct', 'group')),
      name VARCHAR(80) NULL,
      avatar_url VARCHAR(500) NULL,
      created_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_admin SMALLINT NOT NULL DEFAULT 0,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (conversation_id, user_id)
    )
  `);

  // type: text | image | video | audio | file | game | poll
  // seen_at: set once any other participant reads the message (drives the 1hr edit/delete window)
  // edited_at: set whenever the sender edits the text
  // deleted: soft-delete flag; text/media are cleared once true
  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(10) NOT NULL DEFAULT 'text'
        CHECK (type IN ('text', 'image', 'video', 'audio', 'file', 'game', 'poll')),
      text TEXT NULL,
      media_url VARCHAR(500) NULL,
      media_name VARCHAR(255) NULL,
      seen_at TIMESTAMP NULL,
      delivered_at TIMESTAMP NULL,
      edited_at TIMESTAMP NULL,
      deleted SMALLINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add delivered_at for databases created before delivery-tracking was added.
  await query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP NULL`);

  // Persisted record of every finished/forfeited game, so players can look back at past results.
  await query(`
    CREATE TABLE IF NOT EXISTS game_history (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      game_type VARCHAR(20) NOT NULL,
      player1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      player2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      winner_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
      result VARCHAR(10) NOT NULL DEFAULT 'win' CHECK (result IN ('win', 'draw', 'forfeit')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Real-time polls. `options` is a JSON array of option-label strings.
  await query(`
    CREATE TABLE IF NOT EXISTS polls (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question VARCHAR(300) NOT NULL,
      options JSONB NOT NULL,
      allow_multiple SMALLINT NOT NULL DEFAULT 0,
      closed SMALLINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS poll_votes (
      id SERIAL PRIMARY KEY,
      poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      option_index INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT poll_user_option UNIQUE (poll_id, user_id, option_index)
    )
  `);

  // A user's chat wallpaper choices, stored server-side so they survive logging out /
  // clearing localStorage / switching devices. conversation_id NULL means "this user's
  // account-wide default wallpaper" (used by any chat that doesn't have its own).
  await query(`
    CREATE TABLE IF NOT EXISTS chat_wallpapers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      conversation_id INTEGER NULL REFERENCES conversations(id) ON DELETE CASCADE,
      type VARCHAR(10) NOT NULL CHECK (type IN ('color', 'image')),
      value VARCHAR(500) NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS chat_wallpapers_default_uidx
     ON chat_wallpapers(user_id) WHERE conversation_id IS NULL`
  );
  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS chat_wallpapers_conv_uidx
     ON chat_wallpapers(user_id, conversation_id) WHERE conversation_id IS NOT NULL`
  );

  // Per-user "delete for me" and "clear chat" state, stored server-side for the same
  // reason as wallpapers above — so they persist across sessions/devices instead of
  // living only in one browser's localStorage.
  await query(`
    CREATE TABLE IF NOT EXISTS hidden_messages (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, message_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS cleared_chats (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      cleared_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, conversation_id)
    )
  `);

  console.log("PostgreSQL: tables ready");
}

// --- Game history ---

// Records a finished game so both players can view it later. winnerUserId is null for a draw.
export async function recordGameResult({ conversationId, gameType, player1Id, player2Id, winnerUserId, result }) {
  const [insertRows] = await query(
    `INSERT INTO game_history (conversation_id, game_type, player1_id, player2_id, winner_id, result)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    [conversationId, gameType, player1Id, player2Id, winnerUserId ?? null, result || "win"]
  );
  const insertId = insertRows[0].id;
  const [rows] = await query(
    `SELECT h.id, h.conversation_id AS "conversationId", h.game_type AS "gameType",
            h.player1_id AS "player1Id", h.player2_id AS "player2Id", h.winner_id AS "winnerId",
            h.result, h.created_at AS "createdAt",
            p1.username AS "player1Username", p2.username AS "player2Username",
            w.username AS "winnerUsername"
     FROM game_history h
     JOIN users p1 ON p1.id = h.player1_id
     JOIN users p2 ON p2.id = h.player2_id
     LEFT JOIN users w ON w.id = h.winner_id
     WHERE h.id = ?`,
    [insertId]
  );
  return rows[0];
}

// All past game results visible to a user, optionally scoped to one conversation.
export async function getGameHistory(userId, conversationId = null) {
  const params = [userId, userId];
  let where = "WHERE (h.player1_id = ? OR h.player2_id = ?)";
  if (conversationId) {
    where += " AND h.conversation_id = ?";
    params.push(conversationId);
  }
  const [rows] = await query(
    `SELECT h.id, h.conversation_id AS "conversationId", h.game_type AS "gameType",
            h.player1_id AS "player1Id", h.player2_id AS "player2Id", h.winner_id AS "winnerId",
            h.result, h.created_at AS "createdAt",
            p1.username AS "player1Username", p2.username AS "player2Username",
            w.username AS "winnerUsername"
     FROM game_history h
     JOIN users p1 ON p1.id = h.player1_id
     JOIN users p2 ON p2.id = h.player2_id
     LEFT JOIN users w ON w.id = h.winner_id
     ${where}
     ORDER BY h.created_at DESC
     LIMIT 100`,
    params
  );
  return rows;
}

// --- Auth ---

function toPublicUser(row) {
  return {
    id: row.id,
    phoneNumber: row.phone_number ?? row.phoneNumber,
    username: row.username,
    avatarUrl: row.avatar_url ?? row.avatarUrl ?? null,
    tagline: row.tagline ?? null,
    themeColor: row.theme_color ?? row.themeColor ?? "violet",
    showOnline: !!(row.show_online ?? row.showOnline),
  };
}

// Registers a brand-new account. Throws with code "PHONE_TAKEN" if the number is already used.
export async function createUser(phoneNumber, username, passwordHash) {
  const [existing] = await query("SELECT id FROM users WHERE phone_number = ?", [phoneNumber]);
  if (existing.length > 0) {
    const err = new Error("An account with this phone number already exists.");
    err.code = "PHONE_TAKEN";
    throw err;
  }

  const [rows] = await query(
    "INSERT INTO users (phone_number, username, password_hash) VALUES (?, ?, ?) RETURNING id",
    [phoneNumber, username, passwordHash]
  );
  return toPublicUser({
    id: rows[0].id,
    phone_number: phoneNumber,
    username,
    avatar_url: null,
    tagline: null,
    theme_color: "violet",
    show_online: 1,
  });
}

// Returns the full row (including password_hash) for credential verification. Internal use only —
// never send this row to a client as-is.
export async function getUserWithPasswordByPhone(phoneNumber) {
  const [rows] = await query(
    "SELECT id, phone_number, username, password_hash, avatar_url, tagline, theme_color, show_online, is_admin FROM users WHERE phone_number = ?",
    [phoneNumber]
  );
  return rows[0] || null;
}

export async function touchLastSeen(userId) {
  await query("UPDATE users SET last_seen = NOW() WHERE id = ?", [userId]);
}

// Updates whichever profile fields are provided; leaves the rest untouched.
export async function updateUserProfile(userId, { username, tagline, avatarUrl, themeColor, showOnline }) {
  const sets = [];
  const values = [];
  if (username !== undefined) {
    sets.push("username = ?");
    values.push(username);
  }
  if (tagline !== undefined) {
    sets.push("tagline = ?");
    values.push(tagline);
  }
  if (avatarUrl !== undefined) {
    sets.push("avatar_url = ?");
    values.push(avatarUrl);
  }
  if (themeColor !== undefined) {
    sets.push("theme_color = ?");
    values.push(themeColor);
  }
  if (showOnline !== undefined) {
    sets.push("show_online = ?");
    values.push(showOnline ? 1 : 0);
  }
  if (sets.length === 0) return getUserById(userId);

  values.push(userId);
  await query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, values);
  return getUserById(userId);
}

export async function getUserById(userId) {
  const [rows] = await query(
    `SELECT id, phone_number AS "phoneNumber", username, avatar_url AS "avatarUrl",
            tagline, theme_color AS "themeColor", show_online AS "showOnline", is_admin AS "isAdmin"
     FROM users WHERE id = ?`,
    [userId]
  );
  if (!rows[0]) return null;
  return { ...rows[0], showOnline: !!rows[0].showOnline, isAdmin: !!rows[0].isAdmin };
}

// --- Users ---

export async function listUsers() {
  const [rows] = await query(
    'SELECT id, phone_number AS "phoneNumber", username FROM users ORDER BY username'
  );
  return rows;
}

// Full account directory for the admin panel — every registered user, regardless of
// whether they share a conversation with the requester. No message/conversation data.
export async function listUsersForAdmin() {
  const [rows] = await query(
    `SELECT id, phone_number AS "phoneNumber", username, avatar_url AS "avatarUrl",
            tagline, created_at AS "createdAt", last_seen AS "lastSeen"
     FROM users ORDER BY username`
  );
  return rows;
}

// Grants or revokes the global in-app admin flag for the account with this phone number.
export async function setUserAdminByPhone(phoneNumber, isAdmin) {
  await query("UPDATE users SET is_admin = ? WHERE phone_number = ?", [isAdmin ? 1 : 0, phoneNumber]);
}

export async function getUserByPhone(phoneNumber) {
  const [rows] = await query(
    'SELECT id, phone_number AS "phoneNumber", username FROM users WHERE phone_number = ?',
    [phoneNumber]
  );
  return rows[0] || null;
}

// --- Conversations ---

// Finds an existing 1:1 conversation between two users, or creates one.
export async function getOrCreateDirectConversation(userIdA, userIdB) {
  const [rows] = await query(
    `SELECT c.id FROM conversations c
     JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = ?
     JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = ?
     WHERE c.type = 'direct'
     LIMIT 1`,
    [userIdA, userIdB]
  );
  if (rows.length > 0) return rows[0].id;

  const [inserted] = await query(
    "INSERT INTO conversations (type, created_by) VALUES ('direct', ?) RETURNING id",
    [userIdA]
  );
  const conversationId = inserted[0].id;
  await query(
    "INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)",
    [conversationId, userIdA, conversationId, userIdB]
  );
  return conversationId;
}

// Creates a named group conversation. memberIds should NOT include the creator (added automatically).
// The creator is made a group admin.
export async function createGroupConversation(name, creatorId, memberIds = []) {
  const [inserted] = await query(
    "INSERT INTO conversations (type, name, created_by) VALUES ('group', ?, ?) RETURNING id",
    [name, creatorId]
  );
  const conversationId = inserted[0].id;
  const allIds = [...new Set([creatorId, ...memberIds])];

  // Build a multi-row VALUES clause manually since Postgres doesn't support MySQL's
  // "VALUES ?" bulk-array shorthand.
  const placeholders = [];
  const params = [];
  allIds.forEach((id) => {
    placeholders.push("(?, ?, ?)");
    params.push(conversationId, id, id === creatorId ? 1 : 0);
  });
  await query(
    `INSERT INTO conversation_members (conversation_id, user_id, is_admin) VALUES ${placeholders.join(", ")}`,
    params
  );
  return conversationId;
}

// All conversations a user belongs to, with the other member's name for direct chats.
export async function getUserConversations(userId) {
  const [rows] = await query(
    `SELECT c.id, c.type, c.name, c.avatar_url AS "avatarUrl", c.created_at AS "createdAt"
     FROM conversations c
     JOIN conversation_members m ON m.conversation_id = c.id
     WHERE m.user_id = ?
     ORDER BY c.created_at DESC`,
    [userId]
  );

  for (const conv of rows) {
    const [members] = await query(
      `SELECT u.id, u.username, u.phone_number AS "phoneNumber", u.avatar_url AS "avatarUrl", cm.is_admin AS "isAdmin"
       FROM conversation_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.conversation_id = ?`,
      [conv.id]
    );
    conv.members = members.map((m) => ({ ...m, isAdmin: !!m.isAdmin }));
    conv.myIsAdmin = !!members.find((m) => m.id === userId)?.isAdmin;
    if (conv.type === "direct") {
      const other = members.find((m) => m.id !== userId);
      conv.name = other ? other.username : "Unknown";
      conv.avatarUrl = other ? other.avatarUrl : null;
    }
  }
  return rows;
}

// Group admin-only: set/change the group photo.
export async function setConversationAvatar(conversationId, userId, avatarUrl) {
  const [rows] = await query(
    "SELECT is_admin FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
    [conversationId, userId]
  );
  if (!rows[0]?.is_admin) return null;
  await query("UPDATE conversations SET avatar_url = ? WHERE id = ?", [avatarUrl, conversationId]);
  return avatarUrl;
}

export async function isConversationAdmin(conversationId, userId) {
  const [rows] = await query(
    "SELECT is_admin FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
    [conversationId, userId]
  );
  return !!rows[0]?.is_admin;
}

export async function isConversationMember(conversationId, userId) {
  const [rows] = await query(
    "SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
    [conversationId, userId]
  );
  return rows.length > 0;
}

export async function getConversationMemberIds(conversationId) {
  const [rows] = await query(
    'SELECT user_id AS "userId" FROM conversation_members WHERE conversation_id = ?',
    [conversationId]
  );
  return rows.map((r) => r.userId);
}

// --- Messages ---

const MESSAGE_SELECT = `
  SELECT m.id, m.conversation_id AS "conversationId", m.user_id AS "userId", u.username,
         m.type, m.text, m.media_url AS "mediaUrl", m.media_name AS "mediaName",
         m.seen_at AS "seenAt", m.delivered_at AS "deliveredAt", m.edited_at AS "editedAt",
         m.deleted, m.created_at AS "createdAt"
  FROM messages m JOIN users u ON u.id = m.user_id`;

// A message can be edited/deleted by its sender at any time until it's been seen by
// someone else, and for 1 hour after that. Group admins can additionally delete ANY
// message in the group within 24 hours of it being sent.
const EDIT_DELETE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ADMIN_DELETE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function canOwnerModify(message) {
  if (!message.seenAt) return true;
  return Date.now() - new Date(message.seenAt).getTime() <= EDIT_DELETE_WINDOW_MS;
}

function canAdminDelete(message) {
  return Date.now() - new Date(message.createdAt).getTime() <= ADMIN_DELETE_WINDOW_MS;
}

export async function addMessage({ conversationId, userId, type, text, mediaUrl, mediaName }) {
  const [inserted] = await query(
    `INSERT INTO messages (conversation_id, user_id, type, text, media_url, media_name)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    [conversationId, userId, type || "text", text || null, mediaUrl || null, mediaName || null]
  );
  const [rows] = await query(`${MESSAGE_SELECT} WHERE m.id = ?`, [inserted[0].id]);
  return rows[0];
}

// Used to update a game-invite message's text as the game's status changes
// (pending -> active -> finished), so the chat bubble reflects the latest state.
export async function updateMessageText(messageId, text) {
  await query("UPDATE messages SET text = ? WHERE id = ?", [text, messageId]);
  const [rows] = await query(`${MESSAGE_SELECT} WHERE m.id = ?`, [messageId]);
  return rows[0];
}

// Fetches the most recent `limit` messages, or — when `beforeMessageId` is given —
// the `limit` messages immediately preceding that message (for "load older on
// scroll up" pagination). Always returns oldest-first, ready to render/prepend.
export async function getMessages(conversationId, limit = 50, beforeMessageId = null) {
  const params = [conversationId];
  let cursorClause = "";
  if (beforeMessageId) {
    // Compare by the cursor message's created_at rather than id, since ids aren't
    // guaranteed to be strictly time-ordered under concurrent inserts.
    cursorClause = " AND m.created_at < (SELECT created_at FROM messages WHERE id = ?)";
    params.push(beforeMessageId);
  }
  params.push(limit);
  const [rows] = await query(
    `${MESSAGE_SELECT} WHERE m.conversation_id = ?${cursorClause} ORDER BY m.created_at DESC LIMIT ?`,
    params
  );
  return rows.reverse();
}

// Marks every not-yet-seen message in a conversation, sent by someone other than
// `userId`, as seen right now. Returns the list of message ids that just flipped,
// so the caller can notify the room.
export async function markMessagesSeen(conversationId, userId) {
  const [rows] = await query(
    "SELECT id FROM messages WHERE conversation_id = ? AND user_id != ? AND seen_at IS NULL AND deleted = 0",
    [conversationId, userId]
  );
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  // Being seen implies it was delivered too — cover any message that (for whatever
  // reason) never got a delivered_at stamp, so it doesn't get stuck showing "sent".
  await query("UPDATE messages SET seen_at = NOW(), delivered_at = COALESCE(delivered_at, NOW()) WHERE id = ANY(?)", [ids]);
  return ids;
}

// Called right after a message is inserted. If any other member of the conversation
// is currently connected (has a live socket, regardless of which chat they're
// viewing), the message has reached their client in real time — mark it delivered
// immediately so the sender sees a double grey tick without waiting on "seen".
export async function markMessageDelivered(messageId) {
  const [rows] = await query(
    "UPDATE messages SET delivered_at = NOW() WHERE id = ? AND delivered_at IS NULL RETURNING id, delivered_at AS \"deliveredAt\"",
    [messageId]
  );
  return rows[0] || null;
}

// Called when a user connects/reconnects, to catch up any messages that were sent to
// them while they were offline. Returns delivered ids grouped by conversation, so the
// caller can notify each room.
export async function markMessagesDeliveredForUser(userId) {
  const [rows] = await query(
    `SELECT m.id, m.conversation_id AS "conversationId"
     FROM messages m
     JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
     WHERE m.user_id != ? AND m.delivered_at IS NULL AND m.deleted = 0`,
    [userId, userId]
  );
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  await query("UPDATE messages SET delivered_at = NOW() WHERE id = ANY(?)", [ids]);
  const byConv = new Map();
  for (const r of rows) {
    if (!byConv.has(r.conversationId)) byConv.set(r.conversationId, []);
    byConv.get(r.conversationId).push(r.id);
  }
  return [...byConv.entries()].map(([conversationId, messageIds]) => ({ conversationId, messageIds }));
}

// Edits a text message. Only the sender may edit, and only within the allowed window.
export async function editMessage(messageId, userId, newText) {
  const [rows] = await query(`${MESSAGE_SELECT} WHERE m.id = ?`, [messageId]);
  const message = rows[0];
  if (!message || message.deleted) return { error: "not_found" };
  if (message.userId !== userId) return { error: "forbidden" };
  if (message.type !== "text") return { error: "not_editable" };
  if (!canOwnerModify(message)) return { error: "window_expired" };

  await query("UPDATE messages SET text = ?, edited_at = NOW() WHERE id = ?", [newText, messageId]);
  const [updated] = await query(`${MESSAGE_SELECT} WHERE m.id = ?`, [messageId]);
  return { message: updated[0] };
}

// Deletes (soft) a message. The sender can delete their own message within the
// owner window; a group admin can delete ANY message in their group within 24h.
export async function deleteMessage(messageId, userId) {
  const [rows] = await query(`${MESSAGE_SELECT} WHERE m.id = ?`, [messageId]);
  const message = rows[0];
  if (!message || message.deleted) return { error: "not_found" };

  let allowed = message.userId === userId && canOwnerModify(message);
  if (!allowed) {
    const [convRows] = await query("SELECT type FROM conversations WHERE id = ?", [message.conversationId]);
    if (convRows[0]?.type === "group") {
      const isAdmin = await isConversationAdmin(message.conversationId, userId);
      if (isAdmin && canAdminDelete(message)) allowed = true;
    }
  }
  if (!allowed) return { error: "forbidden" };

  await query(
    "UPDATE messages SET deleted = 1, text = NULL, media_url = NULL, media_name = NULL WHERE id = ?",
    [messageId]
  );
  const [updated] = await query(`${MESSAGE_SELECT} WHERE m.id = ?`, [messageId]);
  return { message: updated[0] };
}

// --- Real-time polls ---

export async function createPoll({ conversationId, messageId, createdBy, question, options, allowMultiple }) {
  const [inserted] = await query(
    `INSERT INTO polls (conversation_id, message_id, created_by, question, options, allow_multiple)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    [conversationId, messageId, createdBy, question, JSON.stringify(options), allowMultiple ? 1 : 0]
  );
  return getPollTally(inserted[0].id);
}

export async function getPollByMessageId(messageId) {
  const [rows] = await query("SELECT id FROM polls WHERE message_id = ?", [messageId]);
  if (!rows[0]) return null;
  return getPollTally(rows[0].id);
}

// A single-choice poll's new vote replaces the user's previous vote(s) on that poll;
// a multiple-choice poll toggles the individual option on/off. Returns the fresh tally.
export async function votePoll(pollId, userId, optionIndex) {
  const [pollRows] = await query("SELECT allow_multiple, closed FROM polls WHERE id = ?", [pollId]);
  const poll = pollRows[0];
  if (!poll) return null;
  if (poll.closed) return getPollTally(pollId);

  if (poll.allow_multiple) {
    const [existing] = await query(
      "SELECT id FROM poll_votes WHERE poll_id = ? AND user_id = ? AND option_index = ?",
      [pollId, userId, optionIndex]
    );
    if (existing[0]) {
      await query("DELETE FROM poll_votes WHERE id = ?", [existing[0].id]);
    } else {
      await query(
        "INSERT INTO poll_votes (poll_id, user_id, option_index) VALUES (?, ?, ?)",
        [pollId, userId, optionIndex]
      );
    }
  } else {
    const [existing] = await query(
      'SELECT id, option_index AS "optionIndex" FROM poll_votes WHERE poll_id = ? AND user_id = ?',
      [pollId, userId]
    );
    await query("DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ?", [pollId, userId]);
    // Voting the same option again just clears your vote; a different option replaces it.
    if (!existing[0] || existing[0].optionIndex !== optionIndex) {
      await query(
        "INSERT INTO poll_votes (poll_id, user_id, option_index) VALUES (?, ?, ?)",
        [pollId, userId, optionIndex]
      );
    }
  }
  return getPollTally(pollId);
}

export async function closePoll(pollId, userId) {
  const [rows] = await query("SELECT created_by FROM polls WHERE id = ?", [pollId]);
  if (!rows[0] || rows[0].created_by !== userId) return null;
  await query("UPDATE polls SET closed = 1 WHERE id = ?", [pollId]);
  return getPollTally(pollId);
}

export async function getPollTally(pollId) {
  const [pollRows] = await query(
    `SELECT id, conversation_id AS "conversationId", message_id AS "messageId", created_by AS "createdBy",
            question, options, allow_multiple AS "allowMultiple", closed
     FROM polls WHERE id = ?`,
    [pollId]
  );
  const poll = pollRows[0];
  if (!poll) return null;
  const options = typeof poll.options === "string" ? JSON.parse(poll.options) : poll.options;

  const [voteRows] = await query(
    `SELECT pv.option_index AS "optionIndex", pv.user_id AS "userId", u.username
     FROM poll_votes pv JOIN users u ON u.id = pv.user_id WHERE pv.poll_id = ?`,
    [pollId]
  );

  const counts = options.map(() => 0);
  const votersByOption = options.map(() => []);
  const votedUserIds = new Set();
  for (const v of voteRows) {
    if (v.optionIndex < 0 || v.optionIndex >= options.length) continue;
    counts[v.optionIndex] += 1;
    votersByOption[v.optionIndex].push({ userId: v.userId, username: v.username });
    votedUserIds.add(v.userId);
  }

  return {
    id: poll.id,
    conversationId: poll.conversationId,
    messageId: poll.messageId,
    createdBy: poll.createdBy,
    question: poll.question,
    options,
    allowMultiple: !!poll.allowMultiple,
    closed: !!poll.closed,
    counts,
    votersByOption,
    totalVoters: votedUserIds.size,
  };
}

// --- Chat wallpapers (server-persisted so they survive logout/session loss) ---

// Returns { default: {type,value}|null, [conversationId]: {type,value} } for this user.
export async function getWallpapers(userId) {
  const [rows] = await query(
    'SELECT conversation_id AS "conversationId", type, value FROM chat_wallpapers WHERE user_id = ?',
    [userId]
  );
  const result = { default: null };
  for (const r of rows) {
    const entry = { type: r.type, value: r.value };
    if (r.conversationId == null) result.default = entry;
    else result[r.conversationId] = entry;
  }
  return result;
}

// Sets (replacing any existing) wallpaper for a specific chat, or — when conversationId
// is null — this user's account-wide default used by any chat without its own choice.
export async function setWallpaper(userId, conversationId, type, value) {
  if (conversationId == null) {
    await query("DELETE FROM chat_wallpapers WHERE user_id = ? AND conversation_id IS NULL", [userId]);
    await query(
      "INSERT INTO chat_wallpapers (user_id, conversation_id, type, value) VALUES (?, NULL, ?, ?)",
      [userId, type, value]
    );
  } else {
    if (!(await isConversationMember(conversationId, userId))) {
      const err = new Error("Not a member of this conversation.");
      err.code = "FORBIDDEN";
      throw err;
    }
    await query("DELETE FROM chat_wallpapers WHERE user_id = ? AND conversation_id = ?", [userId, conversationId]);
    await query(
      "INSERT INTO chat_wallpapers (user_id, conversation_id, type, value) VALUES (?, ?, ?, ?)",
      [userId, conversationId, type, value]
    );
  }
  return getWallpapers(userId);
}

export async function clearWallpaper(userId, conversationId) {
  if (conversationId == null) {
    await query("DELETE FROM chat_wallpapers WHERE user_id = ? AND conversation_id IS NULL", [userId]);
  } else {
    await query("DELETE FROM chat_wallpapers WHERE user_id = ? AND conversation_id = ?", [userId, conversationId]);
  }
  return getWallpapers(userId);
}

// --- "Delete for me" (per-user hidden messages) ---

export async function hideMessagesForUser(userId, messageIds) {
  if (!messageIds || messageIds.length === 0) return;
  const placeholders = [];
  const params = [];
  for (const id of messageIds) {
    placeholders.push("(?, ?)");
    params.push(userId, id);
  }
  await query(
    `INSERT INTO hidden_messages (user_id, message_id) VALUES ${placeholders.join(", ")}
     ON CONFLICT (user_id, message_id) DO NOTHING`,
    params
  );
}

// All message ids this user has hidden ("deleted for me"), for merging into their view.
export async function getHiddenMessageIds(userId) {
  const [rows] = await query('SELECT message_id AS "messageId" FROM hidden_messages WHERE user_id = ?', [userId]);
  return rows.map((r) => r.messageId);
}

// --- "Clear chat" (per-user, per-conversation cutoff timestamp) ---

export async function clearChatForUser(userId, conversationId) {
  if (!(await isConversationMember(conversationId, userId))) {
    const err = new Error("Not a member of this conversation.");
    err.code = "FORBIDDEN";
    throw err;
  }
  await query(
    `INSERT INTO cleared_chats (user_id, conversation_id, cleared_at) VALUES (?, ?, NOW())
     ON CONFLICT (user_id, conversation_id) DO UPDATE SET cleared_at = NOW()`,
    [userId, conversationId]
  );
  const [rows] = await query(
    'SELECT cleared_at AS "clearedAt" FROM cleared_chats WHERE user_id = ? AND conversation_id = ?',
    [userId, conversationId]
  );
  return rows[0]?.clearedAt || null;
}

// All per-conversation "cleared before" cutoffs for this user, e.g. { 12: "2026-08-01T..." }.
export async function getClearedChats(userId) {
  const [rows] = await query(
    'SELECT conversation_id AS "conversationId", cleared_at AS "clearedAt" FROM cleared_chats WHERE user_id = ?',
    [userId]
  );
  const result = {};
  for (const r of rows) result[r.conversationId] = r.clearedAt;
  return result;
}