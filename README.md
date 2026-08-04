# Wire — realtime chat (your React app, converted)

Your existing Vite + React app (`client/`) has been converted into a realtime
chat UI, and a matching Node/Socket.IO server (`server/`) was added since a
chat app needs a backend to broadcast messages between users.

**What changed in `client/`:**
- `src/App.jsx` — replaced the starter template with a chat UI: a join screen (pick a handle) plus a chat view with a message feed, online-user roster, and typing indicator, all wired to Socket.IO.
- `src/index.css` — replaced the starter styles with the chat app's theme.
- `index.html` — updated title, added Google Fonts (Space Grotesk / IBM Plex Mono / Inter) used by the new styles.
- `package.json` — added `socket.io-client` as a dependency.
- Removed the unused starter assets (`hero.png`, `react.svg`, `vite.svg`, `App.css`) that the old template screen referenced.

Everything else in your project (build config, ESLint config, `public/` icons) is untouched.

## 1. Run the server

```bash
cd server
npm install
npm start
```

Runs on `http://localhost:4000`.

## 2. Run the client

In a new terminal:

```bash
cd client
npm install
npm run dev
```

Runs on `http://localhost:5173` (Vite's default). Open it in two tabs with different handles to see messages sync live.

## Configuration

- Server port: `PORT` env var (default `4000`).
- Client's server URL: `VITE_SERVER_URL` env var (default `http://localhost:4000`).

## Login by phone number (PostgreSQL)

Login works by phone number instead of an anonymous handle:

- The join screen asks for a **phone number** (required) and an optional display name.
- On login, the server looks the number up in a PostgreSQL `users` table. New number → a row is created. Returning number → their username/last-seen is updated. This means the same phone number always maps to the same account, across restarts.
- No OTP/SMS verification — anyone can type any number and log in as it. If you want real verification later (a code texted to the number before login succeeds), that needs a paid SMS provider (Twilio, MSG91, etc.) — say the word and I'll wire it in.

### One-time local PostgreSQL setup

1. Make sure PostgreSQL is installed and running on your machine (`brew install postgresql` on macOS, or the installer from postgresql.org on Windows/Linux).
2. Create the local user and database (matching the credentials already filled into `server/.env`):
   ```bash
   # from a terminal with psql available
   psql -U postgres -c "CREATE USER amit WITH PASSWORD 'Admin@1234' CREATEDB;"
   psql -U postgres -c "CREATE DATABASE \"ChatApp\" OWNER amit;"
   ```
3. `server/.env` is already set up for this local database:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=amit
   DB_PASSWORD=Admin@1234
   DB_NAME=ChatApp
   PORT=4000
   ```
   (`server/.env.example` has the same template if you ever need to recreate `.env`.)
4. Start the server as usual (`npm install && npm start`) — it connects to PostgreSQL and creates all tables automatically on first run. You'll see `PostgreSQL: tables ready` in the terminal.

`users` table columns: `id`, `phone_number` (unique), `username`, `password_hash`, `avatar_url`, `tagline`, `theme_color`, `show_online`, `created_at`, `last_seen`.

## Running it on your local IP (LAN) so other devices can join

This makes the chat reachable from other phones/laptops on the same WiFi/router — not from the internet.

1. **Find your machine's local IP address:**
   - Windows: open Command Prompt, run `ipconfig`, look for "IPv4 Address" (something like `192.168.1.42`).
   - Mac: System Settings → Wi-Fi → Details, or run `ipconfig getifaddr en0` in Terminal.
   - Linux: run `hostname -I` or `ip addr`.

2. **Start the server** (unchanged) — it already listens on `0.0.0.0`, meaning it accepts connections from any device on your network, not just `localhost`:
   ```bash
   cd server
   npm install
   npm start
   ```

3. **Start the client, telling it where the server lives on your LAN.** Replace `192.168.1.42` with your actual IP from step 1:
   ```bash
   cd client
   npm install
   VITE_SERVER_URL=http://192.168.1.42:4000 npm run dev
   ```
   (Windows PowerShell: `$env:VITE_SERVER_URL="http://192.168.1.42:4000"; npm run dev`)

   `vite.config.js` is already set to `host: true`, so Vite's dev server itself is also reachable on your LAN.

4. **On other devices on the same WiFi**, open a browser to:
   ```
   http://192.168.1.42:5173
   ```
   using your machine's actual IP. They'll log in with their own phone number and everyone will be in the same chat, video calls included.

5. **Firewall:** if other devices can't connect, your OS firewall may be blocking ports `4000` and `5173` for incoming connections — allow them (Windows: Windows Defender Firewall → Allow an app → add Node.js, or allow the specific ports).

## New: emoji + reactions + video calls

- **Send emoji**: click the 😊 icon in the composer to open a **full emoji picker** (thousands of emojis, all categories, search box, skin-tone variants) powered by the `emoji-picker-react` library — not a small curated set.
- **React to messages**: hover a message and click "react" to open that same full picker and react with any emoji. Reactions show as pills under the message with a count; click a pill again to remove your reaction. Reaction state lives on the server and syncs to everyone.
- **Video call**: each other user in the roster gets a 📹 button. Clicking it sends a call invite; the recipient sees an incoming-call screen with Accept/Decline. Once accepted, it's a live peer-to-peer WebRTC video/audio call (your server just relays the connection setup — no video ever passes through it). Controls let you mute mic, toggle camera, and end the call.
  - Calls are 1:1 only (no group calls) and need each browser to grant camera/mic permission.
  - Uses Google's public STUN server (`stun:stun.l.google.com:19302`) for NAT traversal — fine on a home LAN. If it ever fails between two people on separate networks, a TURN server would be needed.
  - Camera/mic access requires `localhost` or HTTPS in most browsers. Plain `http://192.168.x.x` may block camera/mic on some browsers (Chrome generally allows it for private LAN IPs; Safari/Firefox can be stricter) — if that happens, that's a browser security policy, not a bug in the app.

## Notes

- All users share one chat room (`general`); messages themselves are still in-memory (not saved to PostgreSQL) — only login identity (phone number ↔ username) is persisted. Say the word if you want message history saved to PostgreSQL too.
- CORS is wide open (`origin: "*"`) — fine for LAN use; restrict it in `server/index.js` if you ever expose this to the internet.
