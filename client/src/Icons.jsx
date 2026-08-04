// Renders once, hidden, at the root of the app. All icon buttons then reference
// these symbols locally via <use href="#symbol-id" /> — no external file fetch,
// so there's nothing to 404 or fail cross-origin.
export default function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <symbol id="video-call-icon" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 7.5a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 14 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 3 16.5z"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m14 10 5.5-3.2c.6-.35 1.5.06 1.5.8v8.8c0 .74-.9 1.15-1.5.8L14 14"
        />
      </symbol>

      <symbol id="attach-icon" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.5 8.5 9.9 16.1a3 3 0 1 1-4.24-4.24l7.6-7.6a2 2 0 1 1 2.83 2.83l-7.6 7.6a1 1 0 1 1-1.42-1.42l6.9-6.9"
        />
      </symbol>

      <symbol id="emoji-icon" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="9" cy="10" r="1" fill="currentColor" />
        <circle cx="15" cy="10" r="1" fill="currentColor" />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          d="M8.5 14.2a4.2 4.2 0 0 0 7 0"
        />
      </symbol>

      <symbol id="send-icon" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 12 20 4l-4.5 16-4.7-6.5L4 12Z"
        />
      </symbol>

      <symbol id="paperclip-small-icon" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.5 8.5 9.9 16.1a3 3 0 1 1-4.24-4.24l7.6-7.6a2 2 0 1 1 2.83 2.83l-7.6 7.6a1 1 0 1 1-1.42-1.42l6.9-6.9"
        />
      </symbol>

      <symbol id="chat-icon" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 5.5h16v10.5H9l-4 3.5v-3.5H4z"
        />
      </symbol>

      <symbol id="settings-icon" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.4-2-3.4-2.3.8a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.3-.8-2 3.4 2 1.4a7.6 7.6 0 0 0 0 3l-2 1.4 2 3.4 2.3-.8a7.6 7.6 0 0 0 2.6 1.5l.5 2.5h4l.5-2.5a7.6 7.6 0 0 0 2.6-1.5l2.3.8 2-3.4z"
        />
      </symbol>

      <symbol id="logout-icon" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9M16 16l4-4-4-4M20 12H9"
        />
      </symbol>

      <symbol id="camera-icon" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z"
        />
        <circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </symbol>
      <symbol id="profile-icon" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M5 19.5a7 7 0 0 1 14 0" />
      </symbol>

      <symbol id="groups-icon" viewBox="0 0 24 24">
        <circle cx="9" cy="9" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <circle cx="17" cy="8.5" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M15.6 12.3a4.4 4.4 0 0 1 5.4 4.3" />
      </symbol>

      <symbol id="contacts-icon" viewBox="0 0 24 24">
        <rect x="5" y="3.5" width="12" height="17" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="11" cy="10" r="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" d="M8 16a3 3 0 0 1 6 0" />
        <path fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" d="M17 8h2M17 12h2" />
      </symbol>

      <symbol id="sun-icon" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
      </symbol>

      <symbol id="moon-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" />
      </symbol>

      <symbol id="search-icon" viewBox="0 0 24 24">
        <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="m20 20-4.8-4.8" />
      </symbol>

      <symbol id="phone-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M5.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5L15 13l4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A15 15 0 0 1 4 5.6 1.5 1.5 0 0 1 5.5 4Z" />
      </symbol>

      <symbol id="more-icon" viewBox="0 0 24 24">
        <circle cx="12" cy="5.5" r="1.4" fill="currentColor" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        <circle cx="12" cy="18.5" r="1.4" fill="currentColor" />
      </symbol>

      <symbol id="close-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M5 5l14 14M19 5 5 19" />
      </symbol>

      <symbol id="chevron-down-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
      </symbol>

      <symbol id="plus-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M12 5v14M5 12h14" />
      </symbol>
      <symbol id="mic-icon" viewBox="0 0 24 24">
        <rect x="9" y="3.5" width="6" height="10.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M6 11.5a6 6 0 0 0 12 0M12 17.5v3" />
      </symbol>

      <symbol id="mic-off-icon" viewBox="0 0 24 24">
        <rect x="9" y="3.5" width="6" height="10.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M6 11.5a6 6 0 0 0 12 0M12 17.5v3" />
        <path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M4 4l16 16" />
      </symbol>

      <symbol id="video-off-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M3 7.5a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 14 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 3 16.5z" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="m14 10 5.5-3.2c.6-.35 1.5.06 1.5.8v8.8c0 .74-.9 1.15-1.5.8L14 14" />
        <path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M4 4l16 16" />
      </symbol>

      <symbol id="call-end-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3.5 14c5.7-4.6 11.3-4.6 17 0l-1.8 2.6a1.4 1.4 0 0 1-1.8.4l-2-1.1a1.4 1.4 0 0 1-.7-1.3l.1-1.4a12 12 0 0 0-6.6 0l.1 1.4a1.4 1.4 0 0 1-.7 1.3l-2 1.1a1.4 1.4 0 0 1-1.8-.4z" />
      </symbol>
    </svg>
  );
}
