/** Without a fresh mask for this long, the AI is treated as stalled. */
export const STALL_MS = 2500;
/** Silent restarts allowed inside the window before the user is told. */
export const MAX_RESTARTS = 3;
export const RESTART_WINDOW_MS = 60_000;

/**
 * A busy PC (TikTok LIVE Studio encoding, a 3D page being shared) can starve
 * the AI worker for a few seconds. One hiccup must not switch the effect off
 * for the rest of the live, so the worker is restarted quietly; only repeated
 * stalls inside a minute are reported. Records the restart when allowed.
 */
export function allowRestart(history: number[], now: number): boolean {
  while (history.length && now - history[0] > RESTART_WINDOW_MS)
    history.shift();
  if (history.length >= MAX_RESTARTS) return false;
  history.push(now);
  return true;
}
