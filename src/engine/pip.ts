export interface PipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PipConfig {
  pipSize: number;
  pipPosition?: "left" | "right" | "custom" | string;
  pipX?: number;
  pipY?: number;
}

export const PIP_MARGIN = 30;

/**
 * Computes the pixel rectangle for the PiP camera window on a canvas of size (w, h).
 * If pipX and pipY are set and finite, uses them (as fractions of w and h).
 * Otherwise falls back to preset positions "left" or "right" (bottom-anchored).
 * Guarantees the rectangle stays fully within the canvas boundaries.
 */
export function computePipRect(config: PipConfig, w: number, h: number): PipRect {
  const size = Math.max(0.1, Math.min(0.8, config.pipSize || 0.25));
  const pw = Math.round(w * size);
  const ph = Math.round((pw * 9) / 16);
  const maxX = Math.max(0, w - pw);
  const maxY = Math.max(0, h - ph);

  let px: number;
  let py: number;

  if (
    typeof config.pipX === "number" &&
    typeof config.pipY === "number" &&
    Number.isFinite(config.pipX) &&
    Number.isFinite(config.pipY)
  ) {
    px = Math.round(config.pipX * w);
    py = Math.round(config.pipY * h);
  } else if (config.pipPosition === "left") {
    px = PIP_MARGIN;
    py = maxY - PIP_MARGIN;
  } else {
    // Default: right
    px = maxX - PIP_MARGIN;
    py = maxY - PIP_MARGIN;
  }

  return {
    x: Math.max(0, Math.min(maxX, px)),
    y: Math.max(0, Math.min(maxY, py)),
    width: pw,
    height: ph,
  };
}

/**
 * Checks whether a canvas-coordinate point is inside the PiP rectangle.
 */
export function isPointInPip(point: { x: number; y: number }, rect: PipRect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Clamps raw (x, y) coordinates of the top-left corner so that the PiP
 * stays completely inside the [w, h] frame, and returns normalized (pipX, pipY).
 */
export function clampPipPosition(
  x: number,
  y: number,
  pw: number,
  ph: number,
  w: number,
  h: number,
): { pipX: number; pipY: number; px: number; py: number } {
  const maxX = Math.max(0, w - pw);
  const maxY = Math.max(0, h - ph);
  const px = Math.max(0, Math.min(maxX, Math.round(x)));
  const py = Math.max(0, Math.min(maxY, Math.round(y)));
  return {
    px,
    py,
    pipX: w > 0 ? px / w : 0,
    pipY: h > 0 ? py / h : 0,
  };
}
