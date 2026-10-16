import test from "node:test";
import assert from "node:assert/strict";
import {
  freshPlan,
  parseSaved,
  planWindow,
  zoomFor,
  type Rect,
} from "../electron/windowBounds";

const inside = (bounds: Rect, area: Rect) =>
  bounds.x >= area.x &&
  bounds.y >= area.y &&
  bounds.x + bounds.width <= area.x + area.width &&
  bounds.y + bounds.height <= area.y + area.height;

// Work areas in DIP for the screens the studio must open on.
const screens: Record<string, Rect> = {
  "notebook 1366x768 100%": { x: 0, y: 0, width: 1366, height: 728 },
  "notebook 1280x800 125%": { x: 0, y: 0, width: 1024, height: 608 },
  "full hd 200%": { x: 0, y: 0, width: 960, height: 516 },
  "tablet 1280x800 160%": { x: 0, y: 0, width: 800, height: 452 },
  "pc/tv full hd 100%": { x: 0, y: 0, width: 1920, height: 1040 },
  "1440p 100%": { x: 0, y: 0, width: 2560, height: 1400 },
  "second monitor on the left": { x: -1920, y: 120, width: 1920, height: 1040 },
};

test("fresh window always fits the work area, minimums included", () => {
  for (const [name, area] of Object.entries(screens)) {
    const plan = freshPlan(area);
    assert.ok(inside(plan.bounds, area), `${name}: window outside screen`);
    assert.ok(plan.minWidth <= area.width, `${name}: minWidth too big`);
    assert.ok(plan.minHeight <= area.height, `${name}: minHeight too big`);
    assert.ok(plan.bounds.width >= Math.min(800, area.width * 0.9), name);
  }
});

test("fresh window is centred, capped at the preferred size on big screens", () => {
  const plan = freshPlan(screens["1440p 100%"]);
  assert.deepEqual(plan.bounds, { x: 560, y: 230, width: 1440, height: 940 });
  assert.equal(plan.maximized, false);
  assert.deepEqual(freshPlan(screens["second monitor on the left"]).bounds, {
    x: -1680,
    y: 170,
    width: 1440,
    height: 940,
  });
});

test("small screens open maximized; Full HD does not", () => {
  assert.equal(freshPlan(screens["notebook 1366x768 100%"]).maximized, true);
  assert.equal(freshPlan(screens["notebook 1280x800 125%"]).maximized, true);
  assert.equal(freshPlan(screens["tablet 1280x800 160%"]).maximized, true);
  assert.equal(freshPlan(screens["pc/tv full hd 100%"]).maximized, false);
  const fullHd = freshPlan(screens["pc/tv full hd 100%"]).bounds;
  assert.deepEqual(fullHd, { x: 240, y: 50, width: 1440, height: 940 });
});

test("saved window on a connected monitor is restored as it was", () => {
  const displays = [{ workArea: screens["pc/tv full hd 100%"] }];
  const saved = { x: 100, y: 50, width: 1300, height: 800, maximized: true };
  const plan = planWindow(displays, displays[0].workArea, saved);
  assert.deepEqual(plan.bounds, { x: 100, y: 50, width: 1300, height: 800 });
  assert.equal(plan.maximized, true);
});

test("saved window from a bigger screen shrinks and moves back inside", () => {
  const area = screens["notebook 1366x768 100%"];
  const saved = { x: 600, y: 300, width: 1800, height: 1000, maximized: false };
  const plan = planWindow([{ workArea: area }], area, saved);
  assert.ok(inside(plan.bounds, area));
  assert.deepEqual(plan.bounds, { x: 0, y: 0, width: 1366, height: 728 });
});

test("window left on a disconnected monitor falls back to a fresh plan", () => {
  const area = screens["pc/tv full hd 100%"];
  const saved = {
    x: -1800,
    y: 100,
    width: 1400,
    height: 900,
    maximized: false,
  };
  const plan = planWindow([{ workArea: area }], area, saved);
  assert.deepEqual(plan, freshPlan(area));
});

test("window barely peeking into a screen is not trusted", () => {
  const area = screens["pc/tv full hd 100%"];
  const saved = { x: 1900, y: 100, width: 1400, height: 900, maximized: false };
  assert.deepEqual(
    planWindow([{ workArea: area }], area, saved),
    freshPlan(area),
  );
});

test("restore picks the monitor that shows most of the window", () => {
  const left = screens["second monitor on the left"];
  const main = screens["pc/tv full hd 100%"];
  const saved = {
    x: -1500,
    y: 200,
    width: 1700,
    height: 900,
    maximized: false,
  };
  const plan = planWindow(
    [{ workArea: main }, { workArea: left }],
    main,
    saved,
  );
  assert.ok(inside(plan.bounds, left));
});

test("corrupt or hostile saved state is rejected", () => {
  for (const value of [
    null,
    "x",
    42,
    [],
    {},
    { x: 0, y: 0, width: "1200", height: 800 },
    { x: 0, y: 0, width: Infinity, height: 800 },
    { x: NaN, y: 0, width: 1200, height: 800 },
    { x: 0, y: 0, width: 10, height: 10 },
  ])
    assert.equal(parseSaved(value), null, JSON.stringify(value));
  assert.deepEqual(
    parseSaved({ x: 10.4, y: 20, width: 1200, height: 800, maximized: "yes" }),
    { x: 10, y: 20, width: 1200, height: 800, maximized: false },
  );
});

test("zoom grows only on very wide windows", () => {
  assert.equal(zoomFor(1366), 1);
  assert.equal(zoomFor(1920), 1);
  assert.equal(zoomFor(2048), 1.1);
  assert.equal(zoomFor(2560), 1.25);
});
