// Pure window-placement math, kept free of Electron so it can be unit tested.
// Every rectangle is in DIP (the units Electron's screen API reports).

export type Rect = { x: number; y: number; width: number; height: number };
export type Area = { workArea: Rect };
export type SavedWindow = Rect & { maximized: boolean };
export type WindowPlan = {
  bounds: Rect;
  minWidth: number;
  minHeight: number;
  maximized: boolean;
};

export const PREFERRED = { width: 1440, height: 940 };
// Smallest size the stage-first layout stays usable at (qa-ui checks 800×560).
export const COMFORT_MIN = { width: 800, height: 560 };
const FILL = 0.92;
// Below this the 92% leftovers are wasted margin: open maximized instead.
const SMALL = { width: 1440, height: 800 };
// A restored window must show at least this much of itself on some monitor.
const VISIBLE = { width: 200, height: 120 };

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);

const overlap = (a: Rect, b: Rect) => ({
  width: Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  ),
  height: Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  ),
});

export function minimumFor(area: Rect) {
  return {
    minWidth: Math.min(COMFORT_MIN.width, area.width),
    minHeight: Math.min(COMFORT_MIN.height, area.height),
  };
}

export function freshPlan(area: Rect): WindowPlan {
  const width = Math.round(
    Math.min(PREFERRED.width, area.width * FILL, area.width),
  );
  const height = Math.round(
    Math.min(PREFERRED.height, area.height * FILL, area.height),
  );
  return {
    bounds: {
      x: Math.round(area.x + (area.width - width) / 2),
      y: Math.round(area.y + (area.height - height) / 2),
      width,
      height,
    },
    ...minimumFor(area),
    maximized: area.width < SMALL.width || area.height < SMALL.height,
  };
}

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

// Accepts anything read from disk; returns null unless it is a sane window.
export function parseSaved(value: unknown): SavedWindow | null {
  if (!value || typeof value !== "object") return null;
  const { x, y, width, height, maximized } = value as Record<string, unknown>;
  if (![x, y, width, height].every(finite)) return null;
  if ((width as number) < 100 || (height as number) < 100) return null;
  return {
    x: Math.round(x as number),
    y: Math.round(y as number),
    width: Math.round(width as number),
    height: Math.round(height as number),
    maximized: maximized === true,
  };
}

/**
 * Restores the saved window only where it still fits: on the monitor it
 * overlaps most, shrunk to that monitor's work area and pulled back inside it.
 * A window that no connected monitor shows enough of falls back to `fallback`.
 */
export function planWindow(
  displays: Area[],
  fallback: Rect,
  saved: SavedWindow | null,
): WindowPlan {
  if (!saved) return freshPlan(fallback);
  let best: { area: Rect; visible: number } | null = null;
  for (const { workArea } of displays) {
    const seen = overlap(saved, workArea);
    const visible = seen.width * seen.height;
    if (
      seen.width >= Math.min(VISIBLE.width, saved.width) &&
      seen.height >= Math.min(VISIBLE.height, saved.height) &&
      (!best || visible > best.visible)
    )
      best = { area: workArea, visible };
  }
  if (!best) return freshPlan(fallback);
  const area = best.area;
  const min = minimumFor(area);
  const width = clamp(saved.width, min.minWidth, area.width);
  const height = clamp(saved.height, min.minHeight, area.height);
  return {
    bounds: {
      x: clamp(saved.x, area.x, area.x + area.width - width),
      y: clamp(saved.y, area.y, area.y + area.height - height),
      width,
      height,
    },
    ...min,
    maximized: saved.maximized,
  };
}

// Readability boost for big screens (TVs, 1440p+ at 100%), never shrinking.
export function zoomFor(contentWidth: number) {
  if (contentWidth >= 2400) return 1.25;
  if (contentWidth >= 2000) return 1.1;
  return 1;
}
