import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DiagLog, redact } from "../electron/diagLog";

const key = "abcd-efgh-ijkl-mnop-qrst";

test("ingest URLs and keys never reach the diagnostic log", () => {
  const ffmpeg = `[tee @ 0x1] Slave '[f=fifo:onfail=ignore]rtmps://a.rtmps.youtube.com/live2/${key}': Connection reset|[f=fifo]rtmp://push.tiktokcdn.com/stage/${key}`;
  const clean = redact(ffmpeg);
  assert.ok(!clean.includes(key), clean);
  assert.ok(!clean.includes("rtmp"), clean);
  assert.match(clean, /Connection reset/);
  assert.equal(redact(`chave ${key} solta`, [key]), "chave [oculto] solta");
});

test("log lines are single-line and capped", () => {
  const clean = redact(`a\r\nb\tc${"x".repeat(2000)}`);
  assert.ok(!/[\r\n\t]/.test(clean));
  assert.ok(clean.length <= 600);
});

test("the log keeps one file per day and only the last week", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "diag-"));
  for (let day = 1; day <= 9; day++)
    writeFileSync(
      path.join(directory, `sessao-2026-10-0${day}.log`),
      "antigo\n",
    );
  const log = new DiagLog(directory);
  log.protect([key]);
  log.write("live", `falhou em rtmps://a.rtmps.youtube.com/live2/${key}`);
  log.write("live", `de novo ${key}`);
  const files = readdirSync(directory).sort();
  assert.equal(files.length, 8, files.join());
  assert.ok(!files.includes("sessao-2026-10-01.log"));
  const today = files.at(-1)!;
  const text = readFileSync(path.join(directory, today), "utf8");
  assert.ok(!text.includes(key), text);
  assert.match(text, /\[live\] falhou em \[destino\]/);
});
