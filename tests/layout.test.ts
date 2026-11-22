import test from "node:test";
import assert from "node:assert/strict";
import {
  computePresentationBoxes,
  type PresentationConfig,
} from "../src/engine/layout";

const W = 1280;
const H = 720;

test("pip layout sets fullscreen screen and pip camera rect", () => {
  const boxes = computePresentationBoxes(
    { presentationLayout: "pip", pipSize: 0.25 },
    W,
    H,
  );
  assert.deepEqual(boxes.screen, { x: 0, y: 0, width: W, height: H });
  assert.equal(boxes.camera.width, 320);
  assert.equal(boxes.camera.height, 180);
});

test("side-by-side default gives two equal full-height panels", () => {
  const boxes = computePresentationBoxes(
    { presentationLayout: "side-by-side" },
    W,
    H,
  );
  // Both boxes should have equal dimensions
  assert.equal(boxes.screen.width, boxes.camera.width);
  assert.equal(boxes.screen.height, boxes.camera.height);
  assert.equal(boxes.screen.y, boxes.camera.y);

  // Boxes should be placed horizontally next to each other
  assert.ok(boxes.screen.x < boxes.camera.x);
  assert.ok(boxes.camera.x >= boxes.screen.x + boxes.screen.width);

  // Full height, portrait panels
  assert.equal(boxes.screen.height, H - 32);
  assert.ok(boxes.screen.width < boxes.screen.height);

  // Both should be within canvas bounds
  assert.ok(boxes.screen.x >= 0);
  assert.ok(boxes.camera.x + boxes.camera.width <= W);
  assert.ok(boxes.screen.y >= 0);
  assert.ok(boxes.screen.y + boxes.screen.height <= H);
});

test("side-by-side swapPresentation inverts left and right positions", () => {
  const normal = computePresentationBoxes(
    { presentationLayout: "side-by-side", swapPresentation: false },
    W,
    H,
  );
  const swapped = computePresentationBoxes(
    { presentationLayout: "side-by-side", swapPresentation: true },
    W,
    H,
  );

  assert.equal(swapped.screen.x, normal.camera.x);
  assert.equal(swapped.camera.x, normal.screen.x);
});

test("screen-focus layout provides large 16:9 screen presentation and side camera", () => {
  const boxes = computePresentationBoxes(
    { presentationLayout: "screen-focus" },
    W,
    H,
  );
  // Screen takes most of the frame (992x558, 16:9)
  assert.equal(boxes.screen.width, 992);
  assert.equal(boxes.screen.height, 558);

  // Camera box is beside it
  assert.ok(boxes.camera.x > boxes.screen.x);
  assert.equal(boxes.camera.height, boxes.screen.height);

  // Fits within canvas
  assert.ok(boxes.camera.x + boxes.camera.width <= W);
});

test("side-by-side splitRatio gives more room to the screen and is clamped", () => {
  const big = computePresentationBoxes(
    { presentationLayout: "side-by-side", splitRatio: 0.75 },
    W,
    H,
  );
  assert.ok(big.screen.width > big.camera.width * 2.5);
  assert.equal(big.screen.width + big.camera.width, W - 48);
  const tooSmall = computePresentationBoxes(
    { presentationLayout: "side-by-side", splitRatio: 0.01 },
    W,
    H,
  );
  assert.equal(tooSmall.screen.width, Math.round((W - 48) * 0.25));
});
