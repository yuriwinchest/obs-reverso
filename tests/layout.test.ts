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

test("side-by-side layout computes twin 16:9 boxes side by side", () => {
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

  // Both should be 16:9
  const ratio = boxes.screen.width / boxes.screen.height;
  assert.ok(Math.abs(ratio - 16 / 9) < 0.02, `Expected ~16/9, got ${ratio}`);

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
  // Screen width is large (880px)
  assert.equal(boxes.screen.width, 880);
  assert.equal(boxes.screen.height, 495);

  // Camera box is beside it
  assert.ok(boxes.camera.x > boxes.screen.x);
  assert.equal(boxes.camera.height, boxes.screen.height);

  // Fits within canvas
  assert.ok(boxes.camera.x + boxes.camera.width <= W);
});
