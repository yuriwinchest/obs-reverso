import { screen, type BrowserWindow } from "electron";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  parseSaved,
  planWindow,
  zoomFor,
  type WindowPlan,
} from "./windowBounds";

const fileName = "window-state.json";

// A corrupt or missing file must never stop the studio from opening.
export function initialWindowPlan(userData: string): WindowPlan {
  let saved = null;
  try {
    saved = parseSaved(
      JSON.parse(readFileSync(path.join(userData, fileName), "utf8")),
    );
  } catch {
    saved = null;
  }
  const near = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  return planWindow(screen.getAllDisplays(), near.workArea, saved);
}

export function trackWindow(window: BrowserWindow, userData: string) {
  const file = path.join(userData, fileName);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    clearTimeout(timer);
    if (window.isDestroyed() || window.isMinimized()) return;
    const state = {
      ...window.getNormalBounds(),
      maximized: window.isMaximized(),
    };
    try {
      writeFileSync(`${file}.tmp`, JSON.stringify(state));
      renameSync(`${file}.tmp`, file);
    } catch {
      // Losing the remembered size is harmless; the next start recalculates.
    }
  };
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(save, 600);
  };
  // Zoom changes only when the width crosses a band, so a zoom the user picked
  // with Ctrl +/- survives ordinary resizing.
  let band = 1;
  const rezoom = () => {
    const next = zoomFor(window.getContentBounds().width);
    if (next === band) return;
    band = next;
    window.webContents.setZoomFactor(next);
  };
  window.webContents.on("did-finish-load", () => {
    band = 1;
    rezoom();
  });
  window.on("resize", later);
  window.on("move", later);
  window.on("maximize", later);
  window.on("unmaximize", later);
  window.on("resize", rezoom);
  window.on("close", save);
}
