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
    const margin = 24;
    const gap = 20;
    const availableW = w - 2 * margin - gap;
    const bw = Math.floor(availableW / 2);
    const bh = Math.round((bw * 9) / 16);
    const y = Math.round((h - bh) / 2);

    const left: LayoutRect = { x: margin, y, width: bw, height: bh };
    const right: LayoutRect = { x: margin + bw + gap, y, width: bw, height: bh };

    return {
      screen: swap ? right : left,
      camera: swap ? left : right,
    };
  }

  if (layout === "screen-focus") {
    const margin = 24;
    const gap = 20;
    // 880x495 is exactly 16:9, leaving 332px for the presenter box
    const sw = 880;
    const sh = Math.round((sw * 9) / 16); // 495
    const sy = Math.round((h - sh) / 2); // 112
    const cw = w - 2 * margin - gap - sw; // 332
    const ch = sh;

    const left: LayoutRect = { x: margin, y: sy, width: sw, height: sh };
    const right: LayoutRect = { x: margin + sw + gap, y: sy, width: cw, height: ch };

    return {
      screen: swap ? { x: margin + cw + gap, y: sy, width: sw, height: sh } : left,
      camera: swap ? { x: margin, y: sy, width: cw, height: ch } : right,
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
