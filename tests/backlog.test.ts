import { test } from "node:test";
import assert from "node:assert/strict";
import { BacklogClock } from "../src/engine/backlog";

test("fila sempre ocupada mas fluindo não acumula atraso", () => {
  const clock = new BacklogClock();
  // A chunk every 500 ms, each taking 700 ms: the queue is never empty.
  let now = 0;
  clock.add(now);
  for (let i = 1; i <= 40; i++) {
    now = i * 500;
    clock.add(now);
    if (now >= 700) clock.done();
    assert.ok(clock.oldestAge(now) < 1500, `idade ${clock.oldestAge(now)}`);
  }
});

test("encoder parado faz a idade do bloco mais antigo crescer", () => {
  const clock = new BacklogClock();
  for (let t = 0; t <= 9000; t += 500) clock.add(t);
  assert.equal(clock.oldestAge(9000), 9000);
  clock.clear();
  assert.equal(clock.oldestAge(9000), 0);
});
