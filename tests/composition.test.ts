import test from "node:test";
import assert from "node:assert/strict";
import { coverRect } from "../src/engine/StudioEngine";
test("cover preserves proportions and fills output without stretching portrait", () => {
  const r = coverRect(720, 1280, 1280, 720);
  assert.equal(r.w, 1280);
  assert.ok(r.h > 720);
  assert.equal(r.x, 0);
  assert.ok(r.y < 0);
  assert.ok(Math.abs(r.w / r.h - 720 / 1280) < 1e-8);
});
test("cover keeps 16:9 input aligned with mask", () => {
  assert.deepEqual(coverRect(1920, 1080, 256, 144), {
    x: 0,
    y: 0,
    w: 256,
    h: 144,
  });
});
