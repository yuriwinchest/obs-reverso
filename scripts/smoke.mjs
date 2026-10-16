import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import electron from "electron";
import ffmpeg from "ffmpeg-static";
import probe from "ffprobe-static";
import { _electron } from "playwright";

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
const soak = process.argv.includes("--soak");
const reportPath = path.join(
  artifacts,
  soak ? "soak-result.json" : "smoke-result.json",
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await mkdir(artifacts, { recursive: true });
const buildHash = createHash("sha256");
for (const file of [
  "dist-electron/main.cjs",
  "dist-electron/preload.cjs",
  "dist/index.html",
  ...(await readdir(path.join(root, "dist/assets")))
    .sort()
    .map((name) => `dist/assets/${name}`),
]) {
  buildHash.update(file).update(await readFile(path.join(root, file)));
}
const digest = buildHash.digest("hex");
if (soak) {
  const short = JSON.parse(
    await readFile(path.join(artifacts, "smoke-result.json"), "utf8"),
  );
  assert.equal(
    short.passed,
    true,
    "Execute o smoke curto antes do ensaio sustentado.",
  );
  assert.equal(
    short.buildDigest,
    digest,
    "O build mudou; valide o smoke curto novamente.",
  );
}
let app;
const result = {
  passed: false,
  buildDigest: digest,
  date: new Date().toISOString(),
  scope:
    "Mídia sintética em Electron real, IPC real, arquivo local FFmpeg; sem dispositivos físicos, segmentação ou YouTube.",
  scenarios: [],
};
try {
  app = await _electron.launch({
    executablePath: electron,
    // Isolated profile: never touches the user's data or their open instance.
    args: [
      root,
      `--user-data-dir=${path.join(root, "artifacts", "profile-smoke")}`,
    ],
    cwd: root,
    env: { ...process.env, OBS_REVERSO_SMOKE: "1", VITE_DEV_SERVER_URL: "" },
    timeout: 60000,
  });
  const page = await app.firstWindow();
  await page.waitForFunction(
    () => window.studio && document.querySelector("#root")?.children.length,
    { timeout: 30000 },
  );
  await page.screenshot({
    path: path.join(artifacts, soak ? "soak-ui.png" : "smoke-ui.png"),
  });
  assert.equal(
    await page.evaluate(() => typeof window.require),
    "undefined",
    "Renderer não pode expor Node require.",
  );
  assert.equal(
    (await page.evaluate(() => window.studio.info())).ffmpeg,
    true,
    "Encoder ausente.",
  );
  for (const scenario of soak
    ? [{ name: "soak", seconds: 300 }]
    : [
        { name: "pipeline", seconds: 10 },
        { name: "failure-isolation", seconds: 10, failAt: 4 },
      ]) {
    console.log(
      `Ensaio ${scenario.name}: ${scenario.seconds}s; saídas locais.`,
    );
    await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      canvas.style.cssText =
        "position:fixed;inset:0;width:100vw;height:100vh;z-index:99999;background:#204080";
      document.body.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      const audio = new AudioContext({ sampleRate: 48000 });
      await audio.resume();
      const oscillator = audio.createOscillator();
      oscillator.frequency.value = 440;
      const gain = audio.createGain();
      gain.gain.value = 0.1;
      const audioOut = audio.createMediaStreamDestination();
      oscillator.connect(gain).connect(audioOut);
      oscillator.start();
      const stream = canvas.captureStream(24);
      for (const track of audioOut.stream.getAudioTracks())
        stream.addTrack(track);
      const metrics = {
        frames: 0,
        eventLoopMaxMs: 0,
        maxPendingBytes: 0,
        samples: [],
        errors: [],
        broadcastErrors: 0,
        statuses: [],
        bytesAfterFailure: 0,
      };
      let previousTick = performance.now();
      let previousFrame = 0;
      let stopped = false;
      const tick = setInterval(() => {
        const now = performance.now();
        metrics.eventLoopMaxMs = Math.max(
          metrics.eventLoopMaxMs,
          now - previousTick - 100,
        );
        previousTick = now;
      }, 100);
      const paint = (now) => {
        if (stopped) return;
        if (now - previousFrame >= 1000 / 24) {
          previousFrame = now;
          metrics.frames++;
          ctx.fillStyle = "#204080";
          ctx.fillRect(0, 0, 1280, 720);
          ctx.fillStyle = "#f5a020";
          ctx.fillRect(640, 0, 640, 720);
          ctx.fillStyle = "#ffffff";
          ctx.font = "48px sans-serif";
          ctx.fillText(`OBS Reverso · ${metrics.frames}`, 80, 110);
          ctx.fillStyle = "#32d6a0";
          ctx.fillRect(80 + (metrics.frames % 500), 400, 80, 80);
        }
        requestAnimationFrame(paint);
      };
      requestAnimationFrame(paint);
      const unsubscribe = window.studio.onStatus((status) => {
        metrics.statuses.push({ kind: status.kind, state: status.state });
        if (metrics.statuses.length > 100) metrics.statuses.shift();
        if (status.kind === "broadcast" && status.state === "error")
          metrics.broadcastErrors++;
      });
      const recording = await window.studio.recordingStart();
      if (!recording) throw new Error("Modo smoke não dispensou o diálogo.");
      const broadcast = await window.studio.broadcastStart({ mode: "key" });
      const createSink = (kind, id) => {
        const recorder = new MediaRecorder(stream, {
          mimeType: "video/webm;codecs=vp8,opus",
          videoBitsPerSecond: 3000000,
          audioBitsPerSecond: 128000,
        });
        const sink = {
          recorder,
          queue: Promise.resolve(),
          seq: 0,
          pending: 0,
          bytes: 0,
          failed: false,
          failureExpected: false,
        };
        recorder.ondataavailable = (event) => {
          if (!event.data.size || sink.failed) return;
          sink.pending += event.data.size;
          metrics.maxPendingBytes = Math.max(
            metrics.maxPendingBytes,
            sink.pending,
          );
          const seq = sink.seq++;
          sink.queue = sink.queue
            .then(async () => {
              if (sink.failed) return;
              const bytes = await event.data.arrayBuffer();
              if (kind === "recording")
                await window.studio.recordingAppend(id, seq, bytes);
              else await window.studio.broadcastAppend(id, seq, bytes);
              sink.bytes += bytes.byteLength;
            })
            .catch(() => {
              sink.failed = true;
              if (!sink.failureExpected)
                metrics.errors.push(`${kind}: IPC de saída falhou`);
            })
            .finally(() => {
              sink.pending -= event.data.size;
            });
        };
        recorder.onerror = () =>
          metrics.errors.push(`${kind}: MediaRecorder falhou`);
        recorder.start(500);
        return sink;
      };
      const recordSink = createSink("recording", recording.id);
      const broadcastSink = createSink("broadcast", broadcast.id);
      window.__smoke = {
        metrics,
        recordSink,
        broadcastSink,
        recording,
        broadcast,
        snapshot: () => ({
          ...metrics,
          recordingBytes: recordSink.bytes,
          pendingBytes: recordSink.pending + broadcastSink.pending,
          audioState: audio.state,
        }),
        expectFailure: () => {
          broadcastSink.failureExpected = true;
          metrics.bytesAfterFailure = recordSink.bytes;
        },
        finish: async () => {
          for (const sink of [recordSink, broadcastSink])
            if (sink.recorder.state !== "inactive")
              await new Promise((resolve) => {
                sink.recorder.addEventListener("stop", resolve, { once: true });
                sink.recorder.stop();
              });
          await Promise.all([recordSink.queue, broadcastSink.queue]);
          const saved = await window.studio.recordingStop(recording.id);
          await window.studio.broadcastStop(broadcast.id).catch(() => {
            if (!broadcastSink.failureExpected)
              metrics.errors.push("broadcast: parada falhou");
          });
          stopped = true;
          clearInterval(tick);
          unsubscribe();
          stream.getTracks().forEach((track) => track.stop());
          oscillator.stop();
          await audio.close();
          canvas.remove();
          return {
            ...metrics,
            recordingBytes: recordSink.bytes,
            bytesAfterFailure: metrics.bytesAfterFailure
              ? recordSink.bytes - metrics.bytesAfterFailure
              : 0,
            finalPendingBytes: recordSink.pending + broadcastSink.pending,
            recordingPath: saved.path,
          };
        },
      };
    });
    const start = Date.now();
    let killed = false;
    const samples = [];
    while (Date.now() - start < scenario.seconds * 1000) {
      await sleep(1000);
      const elapsed = (Date.now() - start) / 1000;
      if (scenario.failAt && !killed && elapsed >= scenario.failAt) {
        await page.evaluate(() => window.__smoke.expectFailure());
        // The debugger owns main-process test access; no process-control capability enters renderer IPC.
        const count = await app.evaluate(() => {
          const children = process
            ._getActiveHandles()
            .filter(
              (handle) =>
                handle.constructor?.name === "ChildProcess" &&
                /[\\/]ffmpeg(?:\.exe)?$/i.test(handle.spawnfile || "") &&
                handle.exitCode === null,
            );
          if (children.length === 1) children[0].kill();
          return children.length;
        });
        assert.equal(
          count,
          1,
          "Encoder ativo não identificado unicamente no main.",
        );
        killed = true;
      }
      if (Math.round(elapsed) % 15 === 0 || samples.length === 0) {
        const main = await app.evaluate(({ app }) => ({
          rssBytes: process.memoryUsage().rss,
          processes: app.getAppMetrics().map((item) => ({
            type: item.type,
            cpuPercent: item.cpu.percentCPUUsage,
            workingSetKiB: item.memory.workingSetSize,
          })),
        }));
        const renderer = await page.evaluate(() => window.__smoke.snapshot());
        samples.push({
          elapsedSeconds: elapsed,
          mainRssBytes: main.rssBytes,
          electronProcesses: main.processes,
          ...renderer,
        });
        result.active = {
          name: scenario.name,
          elapsedSeconds: elapsed,
          metrics: renderer,
        };
        if (soak && Math.round(elapsed) % 60 === 0)
          console.log(
            `Ensaio sustentado: ${Math.round(elapsed)}s, ${renderer.frames} frames, fila ${renderer.pendingBytes} bytes.`,
          );
      }
    }
    const metrics = await page.evaluate(() => window.__smoke.finish());
    assert.deepEqual(metrics.errors, [], "Erros inesperados de saída.");
    assert.equal(
      metrics.finalPendingBytes,
      0,
      "Fila deve esvaziar ao finalizar.",
    );
    assert.ok(
      metrics.maxPendingBytes <= 16 * 1024 * 1024,
      "Fila excedeu o teto.",
    );
    assert.ok(
      metrics.frames >= scenario.seconds * 10,
      "Compositor sintético abaixo de 10 FPS.",
    );
    if (scenario.failAt) {
      assert.ok(
        metrics.broadcastErrors > 0,
        "Falha do encoder não foi sinalizada.",
      );
      assert.ok(
        metrics.bytesAfterFailure > 10000,
        "Gravação não continuou após falha.",
      );
    }
    const recordingPath = path.join(
      artifacts,
      `${scenario.name}-recording.webm`,
    );
    await copyFile(metrics.recordingPath, recordingPath);
    const files = [await validateMedia(recordingPath, scenario.seconds - 1)];
    if (!scenario.failAt) {
      const livePath = path.join(artifacts, `${scenario.name}-live.flv`);
      await copyFile(path.join(artifacts, "smoke-live.flv"), livePath);
      files.push(await validateMedia(livePath, scenario.seconds - 1));
    }
    result.scenarios.push({
      ...scenario,
      elapsedSeconds: (Date.now() - start) / 1000,
      metrics,
      samples,
      files,
    });
    delete result.active;
    await writeFile(reportPath, JSON.stringify(result, null, 2));
    console.log(
      `${scenario.name}: vídeo/áudio decodificados e filas encerradas${scenario.failAt ? "; gravação continuou após encoder encerrado" : ""}.`,
    );
  }
  result.passed = true;
} catch (error) {
  result.error = String(error?.message ?? error).replace(
    /rtmps?:\/\/\S+/gi,
    "[destino omitido]",
  );
  process.exitCode = 1;
} finally {
  if (app) await app.close().catch(() => {});
  await writeFile(reportPath, JSON.stringify(result, null, 2));
  console.log(
    result.passed
      ? `PASS: ${path.basename(reportPath)}.`
      : `FAIL: ${result.error}`,
  );
}

async function validateMedia(file, minimumSeconds) {
  const { stdout } = await exec(
    probe.path,
    [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-show_packets",
      "-show_entries",
      "packet=stream_index,pts_time,duration_time:stream:format",
      "-of",
      "json",
      file,
    ],
    { maxBuffer: 16 * 1024 * 1024, windowsHide: true, timeout: 60000 },
  );
  const info = JSON.parse(stdout);
  const video = info.streams.find((stream) => stream.codec_type === "video");
  const audio = info.streams.find((stream) => stream.codec_type === "audio");
  assert.ok(video && audio, "Arquivo deve conter vídeo e áudio.");
  assert.equal(video.width, 1280);
  assert.equal(video.height, 720);
  // MediaRecorder WebM is a stream without a duration header; packet timestamps prove its actual extent.
  const packetDuration = Math.max(
    ...info.packets.map(
      (packet) =>
        Number(packet.pts_time || 0) + Number(packet.duration_time || 0),
    ),
  );
  const duration = Number(info.format.duration) || packetDuration;
  assert.ok(duration >= minimumSeconds, `Duração insuficiente: ${duration}.`);
  if (file.endsWith(".webm"))
    assert.ok(
      Number(info.format.duration) >= minimumSeconds,
      "WebM finalizado deve fornecer duração para reprodução/seek.",
    );
  const { stdout: frame } = await exec(
    ffmpeg,
    [
      "-v",
      "error",
      "-ss",
      "1",
      "-i",
      file,
      "-frames:v",
      "1",
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      "pipe:1",
    ],
    { encoding: "buffer", maxBuffer: 8 * 1024 * 1024, windowsHide: true },
  );
  const pixel = (x, y) => [
    ...frame.subarray((y * 1280 + x) * 3, (y * 1280 + x) * 3 + 3),
  ];
  const left = pixel(20, 600);
  const right = pixel(1000, 600);
  assert.ok(
    left.length === 3 && left[2] > left[0] * 2 && right[0] > right[2] * 3,
    "Pixels não preservaram a composição conhecida.",
  );
  const { stdout: pcm } = await exec(
    ffmpeg,
    [
      "-v",
      "error",
      "-ss",
      "1",
      "-i",
      file,
      "-t",
      "1",
      "-vn",
      "-ac",
      "1",
      "-ar",
      "48000",
      "-f",
      "f32le",
      "pipe:1",
    ],
    { encoding: "buffer", maxBuffer: 1024 * 1024, windowsHide: true },
  );
  let squares = 0;
  let crossings = 0;
  let previous = 0;
  const count = pcm.length / 4;
  for (let i = 0; i < count; i++) {
    const value = pcm.readFloatLE(i * 4);
    squares += value * value;
    if (previous <= 0 && value > 0) crossings++;
    previous = value;
  }
  const rms = Math.sqrt(squares / count);
  const frequency = crossings / (count / 48000);
  assert.ok(
    rms > 0.02 && rms < 0.2,
    "Áudio não contém o tom no volume esperado.",
  );
  assert.ok(
    frequency > 430 && frequency < 450,
    "Tom de 440 Hz não foi preservado.",
  );
  await exec(
    ffmpeg,
    [
      "-v",
      "error",
      "-ss",
      "1",
      "-i",
      file,
      "-frames:v",
      "1",
      "-y",
      `${file}.png`,
    ],
    { windowsHide: true },
  );
  return {
    file: path.basename(file),
    durationSeconds: duration,
    durationHeaderSeconds: Number(info.format.duration) || null,
    videoCodec: video.codec_name,
    audioCodec: audio.codec_name,
    width: video.width,
    height: video.height,
    frameRate: video.avg_frame_rate,
    pixels: { left, right },
    audioRms: rms,
    audioFrequencyHz: frequency,
  };
}
