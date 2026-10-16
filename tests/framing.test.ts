import test from "node:test";
import assert from "node:assert/strict";
import {
  clampFraming,
  containPoint,
  framingMatrix,
  zoomAt,
} from "../src/engine/framing";

const W = 1280,
  H = 720;
const apply = (
  m: { scale: number; e: number; f: number },
  x: number,
  y: number,
) => ({
  x: m.e + m.scale * x,
  y: m.f + m.scale * y,
});
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test("default framing is the identity", () => {
  assert.deepEqual(framingMatrix({ zoom: 1, x: 0, y: 0 }, W, H), {
    scale: 1,
    e: 0,
    f: 0,
  });
});

test("zoom scales around the frame center", () => {
  const m = framingMatrix({ zoom: 2, x: 0, y: 0 }, W, H);
  const center = apply(m, W / 2, H / 2);
  close(center.x, W / 2);
  close(center.y, H / 2);
  const corner = apply(m, 0, 0);
  close(corner.x, -W / 2);
  close(corner.y, -H / 2);
  const half = framingMatrix({ zoom: 0.5, x: 0, y: 0 }, W, H);
  close(apply(half, 0, 0).x, W / 4);
  close(apply(half, W, H).y, (H * 3) / 4);
});

test("offset is a fraction of the frame and applies after zoom", () => {
  const m = framingMatrix({ zoom: 1.5, x: 0.25, y: -0.1 }, W, H);
  const center = apply(m, W / 2, H / 2);
  close(center.x, W / 2 + 0.25 * W);
  close(center.y, H / 2 - 0.1 * H);
});

test("values are clamped to the allowed ranges", () => {
  assert.deepEqual(clampFraming({ zoom: 9, x: -3, y: 0.7 }), {
    zoom: 2,
    x: -0.5,
    y: 0.5,
  });
  assert.deepEqual(clampFraming({ zoom: 0.1, x: NaN, y: 0 }), {
    zoom: 0.5,
    x: 0,
    y: 0,
  });
});

test("wheel zoom keeps the point under the cursor fixed", () => {
  const before = { zoom: 1.2, x: 0.1, y: -0.05 };
  const qx = 900,
    qy = 200;
  const m0 = framingMatrix(before, W, H);
  // Source point currently under the cursor.
  const px = (qx - m0.e) / m0.scale,
    py = (qy - m0.f) / m0.scale;
  const after = zoomAt(before, 1.6, qx, qy, W, H);
  assert.equal(after.zoom, 1.6);
  const q = apply(framingMatrix(after, W, H), px, py);
  close(q.x, qx);
  close(q.y, qy);
});

test("pointer maps to bitmap coordinates through object-fit: contain", () => {
  // 1000×800 box shows the 16:9 bitmap 1000×562.5, letterboxed vertically.
  const box = { left: 100, top: 50, width: 1000, height: 800 };
  const top = 50 + (800 - 562.5) / 2;
  const p = containPoint(600, top + 562.5 / 2, box, W, H);
  close(p.x, W / 2);
  close(p.y, H / 2);
  close(p.scale, W / 1000);
  const origin = containPoint(100, top, box, W, H);
  close(origin.x, 0);
  close(origin.y, 0);
});
