import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_RESTARTS,
  RESTART_WINDOW_MS,
  allowRestart,
} from "../src/engine/segmentationRecovery";

test("a stalled AI is restarted quietly a few times", () => {
  const history: number[] = [];
  for (let i = 0; i < MAX_RESTARTS; i++)
    assert.equal(allowRestart(history, 1000 + i * 5000), true);
  assert.equal(allowRestart(history, 20_000), false, "too many in a minute");
});

test("old stalls stop counting after the window", () => {
  const history: number[] = [];
  for (let i = 0; i < MAX_RESTARTS; i++) allowRestart(history, i);
  assert.equal(allowRestart(history, RESTART_WINDOW_MS + MAX_RESTARTS), true);
});
