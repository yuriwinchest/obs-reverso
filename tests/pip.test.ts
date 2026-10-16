import test from "node:test";
import assert from "node:assert/strict";
import {
  computePipRect,
  isPointInPip,
  clampPipPosition,
  PIP_MARGIN,
} from "../src/engine/pip";

const W = 1280;
const H = 720;

test("default PiP anchors to bottom right with margin", () => {
  const rect = computePipRect({ pipSize: 0.25 }, W, H);
  assert.equal(rect.width, 320);
  assert.equal(rect.height, 180);
  assert.equal(rect.x, W - 320 - PIP_MARGIN);
  assert.equal(rect.y, H - 180 - PIP_MARGIN);
});

test("left preset PiP anchors to bottom left with margin", () => {
  const rect = computePipRect(
    { pipSize: 0.25, pipPosition: "left" },
    W,
    H,
  );
  assert.equal(rect.width, 320);
  assert.equal(rect.height, 180);
  assert.equal(rect.x, PIP_MARGIN);
  assert.equal(rect.y, H - 180 - PIP_MARGIN);
});

test("custom pipX and pipY position PiP freely across the screen", () => {
  // Move to top-left corner
  const topLeft = computePipRect(
    { pipSize: 0.25, pipX: 0.05, pipY: 0.05 },
    W,
    H,
  );
  assert.equal(topLeft.x, Math.round(0.05 * W));
  assert.equal(topLeft.y, Math.round(0.05 * H));

  // Move to center of screen
  const center = computePipRect(
    { pipSize: 0.25, pipX: 0.375, pipY: 0.375 },
    W,
    H,
  );
  assert.equal(center.x, Math.round(0.375 * W));
  assert.equal(center.y, Math.round(0.375 * H));
});

test("PiP coordinates are clamped within the frame boundary", () => {
  // Attempting to push past right and bottom
  const pushedBottomRight = computePipRect(
    { pipSize: 0.25, pipX: 1.5, pipY: 2.0 },
    W,
    H,
  );
  assert.equal(pushedBottomRight.x, W - 320);
  assert.equal(pushedBottomRight.y, H - 180);

  // Attempting to push past top and left
  const pushedTopLeft = computePipRect(
    { pipSize: 0.25, pipX: -0.5, pipY: -1.0 },
    W,
    H,
  );
  assert.equal(pushedTopLeft.x, 0);
  assert.equal(pushedTopLeft.y, 0);
});

test("isPointInPip detects points inside and outside the PiP box", () => {
  const rect = { x: 100, y: 100, width: 300, height: 200 };
  assert.equal(isPointInPip({ x: 100, y: 100 }, rect), true);
  assert.equal(isPointInPip({ x: 250, y: 200 }, rect), true);
  assert.equal(isPointInPip({ x: 400, y: 300 }, rect), true);

  assert.equal(isPointInPip({ x: 99, y: 100 }, rect), false);
  assert.equal(isPointInPip({ x: 401, y: 200 }, rect), false);
  assert.equal(isPointInPip({ x: 200, y: 99 }, rect), false);
  assert.equal(isPointInPip({ x: 200, y: 301 }, rect), false);
});

test("clampPipPosition clamps drag coordinates and converts to normalized fractions", () => {
  const pw = 320;
  const ph = 180;
  const clamped = clampPipPosition(500, 300, pw, ph, W, H);
  assert.equal(clamped.px, 500);
  assert.equal(clamped.py, 300);
  assert.equal(clamped.pipX, 500 / W);
  assert.equal(clamped.pipY, 300 / H);

  const overflow = clampPipPosition(2000, 1000, pw, ph, W, H);
  assert.equal(overflow.px, W - pw);
  assert.equal(overflow.py, H - ph);
  assert.equal(overflow.pipX, (W - pw) / W);
  assert.equal(overflow.pipY, (H - ph) / H);
});
