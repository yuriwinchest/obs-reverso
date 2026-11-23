import assert from "node:assert/strict";
import test from "node:test";
import { broadcastOutputArgs } from "../electron/outputs";

test("live output never blocks the encoder and reconnects by itself", () => {
  const args = broadcastOutputArgs("rtmps://ingest.example/live/KEY");
  const opt = (name: string) => args[args.indexOf(name) + 1];
  assert.equal(opt("-f"), "fifo");
  assert.equal(opt("-fifo_format"), "flv");
  assert.equal(opt("-drop_pkts_on_overflow"), "1");
  assert.equal(opt("-attempt_recovery"), "1");
  assert.ok(Number(opt("-max_recovery_attempts")) > 0, "wrong key must still fail");
  assert.equal(args.at(-1), "rtmps://ingest.example/live/KEY");
});
