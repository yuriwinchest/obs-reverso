import { computePipRect, type PipConfig } from "./pip";

export type PresentationLayout = "pip" | "side-by-side" | "screen-focus";

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PresentationBoxes {
  screen: LayoutRect;
  camera: LayoutRect;
}

export interface PresentationConfig extends Partial<PipConfig> {
  presentationLayout?: PresentationLayout;
  swapPresentation?: boolean;
}

/**
 * Computes the screen share and camera box geometry for a given presentation layout.
 *
 * - "pip": Fullscreen screen share with camera floating as a PiP window.
 * - "side-by-side": Two balanced 16:9 boxes side by side, centered vertically.
 * - "screen-focus": Large 16:9 screen presentation box on one side with camera beside it.
 */
export function computePresentationBoxes(
  config: PresentationConfig,
  w: number,
  h: number,
): PresentationBoxes {
  const layout = config.presentationLayout || "pip";
  const swap = !!config.swapPresentation;

  if (layout === "side-by-side") {
    const margin = 16;
    const gap = 16;
    const availableW = w - 2 * margin - gap;
    const bw = Math.floor(availableW / 2);
    const bh = Math.round((bw * 9) / 16);
    const y = Math.round((h - bh) / 2);

    const left: LayoutRect = { x: margin, y, width: bw, height: bh };
    const right: LayoutRect = {
      x: margin + bw + gap,
      y,
      width: bw,
      height: bh,
    };

    return {
      screen: swap ? right : left,
      camera: swap ? left : right,
    };
  }

  if (layout === "screen-focus") {
    // Thin margins and a narrow portrait camera column: the shared screen gets
    // as much of the frame as possible while staying 16:9 (nothing cropped).
    const margin = 16;
    const gap = 16;
    const cw = 240;
    const sw = w - 2 * margin - gap - cw; // 992 at 1280
    const sh = Math.round((sw * 9) / 16); // 558
    const sy = Math.round((h - sh) / 2);
    const screenX = swap ? margin + cw + gap : margin;
    const cameraX = swap ? margin : margin + sw + gap;
    return {
      screen: { x: screenX, y: sy, width: sw, height: sh },
      camera: { x: cameraX, y: sy, width: cw, height: sh },
    };
  }

  // Default: "pip"
  return {
    screen: { x: 0, y: 0, width: w, height: h },
    camera: computePipRect(
      {
        pipPosition: config.pipPosition || "right",
        pipSize: config.pipSize ?? 0.24,
        pipX: config.pipX,
        pipY: config.pipY,
      },
      w,
      h,
    ),
  };
}
