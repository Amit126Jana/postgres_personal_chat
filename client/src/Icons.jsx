// Renders once, hidden, at the root of the app. All icon buttons then reference
// these symbols locally via <use href="#symbol-id" /> — no external file fetch,
// so there's nothing to 404 or fail cross-origin.
export default function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <symbol id="lock-icon" viewBox="0 0 24 24">
        <rect x="5" y="10.5" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          d="M8 10.5V7.5a4 4 0 0 1 8 0v3"
        />
        <circle cx="12" cy="14.7" r="1.3" fill="currentColor" />
      </symbol>

      <symbol id="bell-icon" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 10.5a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14.5 6 10.5Z"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          d="M10 19a2 2 0 0 0 4 0"
        />
      </symbol>

      <symbol id="shield-icon" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          d="M12 3.5 5 6v5.5C5 15.5 8 18.5 12 20.5c4-2 7-5 7-9V6z"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.3 11.7 11 13.4l3.7-3.9"
        />
      </symbol>

      <symbol id="eye-icon" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        />
        <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </symbol>

      <symbol id="laptop-icon" viewBox="0 0 24 24">
        <rect x="4" y="5.5" width="16" height="10" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          d="M2.5 18.5h19"
        />
      </symbol>

      <symbol id="image-icon" viewBox="0 0 24 24">
        <rect x="3" y="4.5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="8.3" cy="9.3" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          d="m4 17 5-5 3.5 3.5L16.5 11 20 14.5"
        />
      </symbol>

      <symbol id="ban-icon" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          d="m6.3 6.3 11.4 11.4"
        />
      </symbol>

      <symbol id="chevron-right-icon" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m9 5.5 7 6.5-7 6.5"
        />
      </symbol>

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

      <symbol id="menu-icon" viewBox="0 0 24 24">
        <path
          d="M4 6h16M4 12h16M4 18h16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
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

      <symbol id="refresh-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M17.5 3.5v4h-4M6.5 20.5v-4h4" />
      </symbol>

      <symbol id="admin-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M12 3.5 5 6.3v5.2c0 4.5 3 7.6 7 8.9 4-1.3 7-4.4 7-8.9V6.3L12 3.5Z" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="m9.3 12.2 1.9 1.9 3.6-3.9" />
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

      <symbol id="reply-icon" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 6 3 12l6 6M3 12h10a7 7 0 0 1 7 7v1"
        />
      </symbol>

      <symbol id="copy-icon" viewBox="0 0 24 24">
        <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M15.5 8.5V6.5A2 2 0 0 0 13.5 4.5H6A2 2 0 0 0 4 6.5V14a2 2 0 0 0 2 2h2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </symbol>

      <symbol id="download-icon" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14"
        />
      </symbol>

      <symbol id="edit-pencil-icon" viewBox="0 0 24 24">
  <path
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M12 20h9"
  />
  <path
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z"
  />
</symbol>

      <symbol id="delete-trash-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M4 7h16" />
      </symbol>

      <symbol id="info-icon" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="8" r="0.75" fill="currentColor" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M12 11v5" />
      </symbol>

      <symbol id="exit-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M15 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h9M10 12h11m0 0-4-4m4 4-4 4" />
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

      <symbol id="speaker-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M4 9.5h3.2L11 6.2c.5-.4 1.2-.05 1.2.6v10.4c0 .65-.7 1-1.2.6L7.2 14.5H4a.7.7 0 0 1-.7-.7V10.2c0-.4.3-.7.7-.7z" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M16 8.5a5 5 0 0 1 0 7M18.6 6a8.5 8.5 0 0 1 0 12" />
      </symbol>

      <symbol id="speaker-off-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M4 9.5h3.2L11 6.2c.5-.4 1.2-.05 1.2.6v10.4c0 .65-.7 1-1.2.6L7.2 14.5H4a.7.7 0 0 1-.7-.7V10.2c0-.4.3-.7.7-.7z" />
        <path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M15.5 9.5l5 5m0-5l-5 5" />
      </symbol>

      <symbol id="keypad-icon" viewBox="0 0 24 24">
        <circle cx="7" cy="6.5" r="1.4" fill="currentColor" />
        <circle cx="12" cy="6.5" r="1.4" fill="currentColor" />
        <circle cx="17" cy="6.5" r="1.4" fill="currentColor" />
        <circle cx="7" cy="12" r="1.4" fill="currentColor" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        <circle cx="17" cy="12" r="1.4" fill="currentColor" />
        <circle cx="7" cy="17.5" r="1.4" fill="currentColor" />
        <circle cx="12" cy="17.5" r="1.4" fill="currentColor" />
        <circle cx="17" cy="17.5" r="1.4" fill="currentColor" />
      </symbol>

      <symbol id="switch-camera-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M4 8.5h3l1.3-2h3.4M20 15.5h-3l-1.3 2H12.3" />
        <rect x="2.5" y="8.5" width="12" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="8.5" cy="13" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="m17.5 6 2.5 2.5-2.5 2.5M17.5 18l-2.5-2.5 2.5-2.5" />
      </symbol>

      <symbol id="filter-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M4 5.5h16L14 13v6l-4 2v-8L4 5.5Z" />
      </symbol>

      <symbol id="mention-icon" viewBox="0 0 24 24">
        <circle cx="12" cy="12.5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M15.6 12.3v.9a2.3 2.3 0 0 0 4.6 0V12a8.2 8.2 0 1 0-3.4 6.6" />
      </symbol>

      <symbol id="trophy-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M7 4.5h10v4.2a5 5 0 0 1-10 0V4.5Z" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M7 6H4.5v1.5A3 3 0 0 0 7.5 10.5M17 6h2.5v1.5A3 3 0 0 1 16.5 10.5" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M12 13.5v3M9 19.5h6M9.5 19.5l.6-3M14.5 19.5l-.6-3" />
      </symbol>

      <symbol id="megaphone-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M4 10.5v3a1.5 1.5 0 0 0 1.5 1.5H7l2.5 4V6.5L7 10.5H5.5A1.5 1.5 0 0 0 4 10.5Z" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M12 8.2c2.6.3 4.6 1.6 6.3 3.8-1.7 2.2-3.7 3.5-6.3 3.8" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M9 16v3a1.3 1.3 0 0 0 2.6 0v-2.3" />
      </symbol>

      <symbol id="check-icon" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="m8 12.3 2.6 2.6L16.2 9" />
      </symbol>

      {/* Message status ticks: single check = sent, double check = delivered/seen
          (color class .msg-tick-seen turns it green — see index.css) */}
      <symbol id="check-single-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m4 12.5 4.5 4.5L20 6" />
      </symbol>
      <symbol id="check-double-icon" viewBox="0 0 24 24">
        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m1 12.5 4.5 4.5L16 6" />
        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m8.5 12.5 1.3 1.3L21 6" />
      </symbol>

      <symbol id="clock-icon" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M12 7.5V12l3 2" />
      </symbol>
    </svg>
  );
}