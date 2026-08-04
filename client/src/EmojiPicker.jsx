import { useEffect, useLayoutEffect, useRef, useState } from "react";
import EmojiPickerReact, { Theme } from "emoji-picker-react";

const BASE_WIDTH = 336;
const BASE_HEIGHT = 400;
const VIEWPORT_MARGIN = 12;

export default function EmojiPicker({ onSelect, onClose, anchorClass = "" }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const [size, setSize] = useState({ width: BASE_WIDTH, height: BASE_HEIGHT });

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    function reposition() {
      const el = ref.current;
      if (!el || !el.parentElement) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Responsive size: shrink to fit small viewports, cap at the base size.
      const width = Math.min(BASE_WIDTH, vw - VIEWPORT_MARGIN * 2);
      const height = Math.min(BASE_HEIGHT, vh - VIEWPORT_MARGIN * 2);
      setSize({ width, height });

      const anchor = el.parentElement.getBoundingClientRect();
      const alignRight = anchorClass.includes("mine");

      // Prefer opening above the trigger; flip below if there isn't room.
      let top = anchor.top - height - 8;
      if (top < VIEWPORT_MARGIN) {
        const below = anchor.bottom + 8;
        // Pick whichever side has more room if neither fully fits.
        top = below + height <= vh - VIEWPORT_MARGIN || below < anchor.top ? below : top;
      }
      top = Math.min(Math.max(top, VIEWPORT_MARGIN), vh - VIEWPORT_MARGIN - height);

      let left = alignRight ? anchor.right - width : anchor.left;
      left = Math.min(Math.max(left, VIEWPORT_MARGIN), vw - VIEWPORT_MARGIN - width);

      setPos({ top, left });
    }

    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorClass]);

  const wrapStyle = pos
    ? { position: "fixed", top: pos.top, left: pos.left, bottom: "auto", right: "auto" }
    : { visibility: "hidden" };

  return (
    <div className={"emoji-picker-wrap " + anchorClass} ref={ref} style={wrapStyle}>
      <EmojiPickerReact
        onEmojiClick={(emojiData) => onSelect(emojiData.emoji)}
        theme={Theme.DARK}
        autoFocusSearch={false}
        width={size.width}
        height={size.height}
        previewConfig={{ showPreview: false }}
        searchDisabled={false}
      />
    </div>
  );
}
