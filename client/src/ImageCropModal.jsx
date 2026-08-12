import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Generic crop modal used everywhere a user picks a photo (profile avatar,
 * profile cover, group avatar on creation, group avatar edit...).
 *
 * Props:
 *  - file:      the File/Blob the user just picked (required)
 *  - shape:     "circle" | "rect"  (circle = avatars, rect = covers/banners)
 *  - aspect:    output width/height ratio, only used when shape === "rect" (default 16/9)
 *  - outputSize: pixel size of the longer output edge (default 640)
 *  - onCancel(): called when the user backs out without cropping
 *  - onConfirm(blob): called with the cropped image as a JPEG Blob
 */
export default function ImageCropModal({
  file,
  shape = "circle",
  aspect = 16 / 9,
  outputSize = 640,
  onCancel,
  onConfirm,
}) {
  const [imgSrc, setImgSrc] = useState(null);
  const [naturalSize, setNaturalSize] = useState(null); // {w,h}
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // top-left of image, px, relative to viewport
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null); // {x,y,offsetX,offsetY}
  const imgRef = useRef(null);

  const VW = shape === "circle" ? 280 : 320;
  const VH = shape === "circle" ? 280 : Math.round(320 / aspect);

  // Load the picked file into an object URL + read its natural dimensions.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = useMemo(() => {
    if (!naturalSize) return 1;
    return Math.max(VW / naturalSize.w, VH / naturalSize.h);
  }, [naturalSize, VW, VH]);

  const scale = baseScale * zoom;

  const imgDisplayW = naturalSize ? naturalSize.w * scale : 0;
  const imgDisplayH = naturalSize ? naturalSize.h * scale : 0;

  // Center the image the first time we know its size / whenever zoom bounds change.
  useEffect(() => {
    if (!naturalSize) return;
    setOffset((prev) => clampOffset(prev, imgDisplayW, imgDisplayH));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naturalSize]);

  useEffect(() => {
    setOffset((prev) => clampOffset(prev, imgDisplayW, imgDisplayH));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  function clampOffset(prev, w, h) {
    if (!w || !h) return prev;
    const minX = Math.min(0, VW - w);
    const minY = Math.min(0, VH - h);
    const x = Math.min(0, Math.max(minX, prev.x || (VW - w) / 2));
    const y = Math.min(0, Math.max(minY, prev.y || (VH - h) / 2));
    return { x, y };
  }

  function centerInit() {
    if (!naturalSize) return { x: 0, y: 0 };
    return { x: (VW - imgDisplayW) / 2, y: (VH - imgDisplayH) / 2 };
  }

  // Use lazy init once natural size known
  useEffect(() => {
    if (naturalSize) setOffset(centerInit());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naturalSize]);

  function onPointerDown(e) {
    e.preventDefault();
    setDragging(true);
    const point = e.touches ? e.touches[0] : e;
    dragStart.current = { x: point.clientX, y: point.clientY, offsetX: offset.x, offsetY: offset.y };
  }

  function onPointerMove(e) {
    if (!dragging || !dragStart.current) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - dragStart.current.x;
    const dy = point.clientY - dragStart.current.y;
    const next = { x: dragStart.current.offsetX + dx, y: dragStart.current.offsetY + dy };
    setOffset(clampOffset(next, imgDisplayW, imgDisplayH));
  }

  function onPointerUp() {
    setDragging(false);
    dragStart.current = null;
  }

  function handleConfirm() {
    if (!naturalSize || !imgSrc) return;
    const sx = -offset.x / scale;
    const sy = -offset.y / scale;
    const sw = VW / scale;
    const sh = VH / scale;

    const outW = shape === "circle" ? outputSize : outputSize;
    const outH = shape === "circle" ? outputSize : Math.round(outputSize / aspect);

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");

    const draw = (image) => {
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);
      canvas.toBlob(
        (blob) => {
          if (blob) onConfirm(blob);
        },
        "image/jpeg",
        0.92
      );
    };

    if (imgRef.current && imgRef.current.complete) {
      draw(imgRef.current);
    } else {
      const image = new Image();
      image.onload = () => draw(image);
      image.src = imgSrc;
    }
  }

  return (
    <div className="crop-backdrop" onClick={onCancel}>
      <div className="crop-panel" onClick={(e) => e.stopPropagation()}>
        <div className="crop-header">
          <h3>Adjust photo</h3>
          <button type="button" className="crop-close" onClick={onCancel} aria-label="Cancel">
            ×
          </button>
        </div>

        <p className="crop-hint">Drag to reposition · use the slider to zoom</p>

        <div
          className={"crop-viewport" + (shape === "circle" ? " crop-viewport-circle" : " crop-viewport-rect")}
          style={{ width: VW, height: VH }}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        >
          {imgSrc && (
            <img
              ref={imgRef}
              src={imgSrc}
              alt=""
              draggable={false}
              className="crop-image"
              style={{
                width: imgDisplayW || undefined,
                height: imgDisplayH || undefined,
                left: offset.x,
                top: offset.y,
              }}
            />
          )}
          <div className="crop-mask" />
        </div>

        <div className="crop-zoom-row">
          <svg className="icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="crop-zoom-slider"
          />
          <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 11h6M11 8v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <div className="crop-actions">
          <button type="button" className="crop-btn crop-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="crop-btn crop-btn-primary" onClick={handleConfirm} disabled={!naturalSize}>
            Use Photo
          </button>
        </div>
      </div>
    </div>
  );
}
