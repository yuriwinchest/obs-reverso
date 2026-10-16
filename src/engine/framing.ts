export interface Framing {
  zoom: number;
  x: number;
  y: number;
}
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2;
export const OFFSET_LIMIT = 0.5;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

export function clampFraming(framing: Framing): Framing {
  return {
    zoom: clamp(framing.zoom || 1, ZOOM_MIN, ZOOM_MAX),
    x: clamp(framing.x, -OFFSET_LIMIT, OFFSET_LIMIT),
    y: clamp(framing.y, -OFFSET_LIMIT, OFFSET_LIMIT),
  };
}

/**
 * Equivalent of translate(w/2 + x·w, h/2 + y·h) · scale(zoom) · translate(−w/2, −h/2):
 * a frame point p lands on (e + scale·p.x, f + scale·p.y).
 */
export function framingMatrix(framing: Framing, w: number, h: number) {
  const { zoom, x, y } = clampFraming(framing);
  return {
    scale: zoom,
    e: w / 2 + x * w - (zoom * w) / 2,
    f: h / 2 + y * h - (zoom * h) / 2,
  };
}

/** Zooms to `zoom` while keeping the frame point under (qx, qy) where it is. */
export function zoomAt(
  framing: Framing,
  zoom: number,
  qx: number,
  qy: number,
  w: number,
  h: number,
): Framing {
  const current = clampFraming(framing);
  const next = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
  const ratio = next / current.zoom;
  const dx = qx - w / 2,
    dy = qy - h / 2;
  return clampFraming({
    zoom: next,
    x: (dx - ratio * (dx - current.x * w)) / w,
    y: (dy - ratio * (dy - current.y * h)) / h,
  });
}

/**
 * Maps a pointer position on an element showing a cw×ch bitmap with
 * object-fit: contain to bitmap coordinates; `scale` is bitmap px per CSS px.
 */
export function containPoint(
  clientX: number,
  clientY: number,
  box: { left: number; top: number; width: number; height: number },
  cw: number,
  ch: number,
) {
  const fit = Math.min(box.width / cw, box.height / ch) || 1;
  const left = box.left + (box.width - cw * fit) / 2,
    top = box.top + (box.height - ch * fit) / 2;
  return {
    x: (clientX - left) / fit,
    y: (clientY - top) / fit,
    scale: 1 / fit,
  };
}
