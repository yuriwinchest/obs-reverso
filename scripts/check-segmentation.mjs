import { _electron } from "playwright";
import electron from "electron";
import { mkdir, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(path.join(root, "artifacts"), { recursive: true });
const worker = (await readdir(path.join(root, "dist/assets"))).find((x) =>
  x.startsWith("segment.worker-"),
);
assert.ok(worker, "Build worker ausente");
let app;
const errors = [];
const result = {
  passed: false,
  scope:
    "Worker IA real em mídia sintética; não avalia contorno humano ou webcam física.",
};
try {
  app = await _electron.launch({
    executablePath: electron,
    // Isolated profile: never touches the user's data or their open instance.
    args: [
      `--user-data-dir=${path.join(root, "artifacts", "profile-check-segmentation")}`,
      root,
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
    cwd: root,
    env: { ...process.env, OBS_REVERSO_SMOKE: "1", VITE_DEV_SERVER_URL: "" },
    timeout: 60000,
  });
  const page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForFunction(() => !!document.querySelector(".program-canvas"));
  result.worker = await page.evaluate(async (worker) => {
    const w = new Worker(new URL(`assets/${worker}`, location.href));
    const started = performance.now();
    return await new Promise((resolve, reject) => {
      let frames = 0,
        totalMs = 0,
        lastStats;
      const timeout = setTimeout(() => {
        w.terminate();
        reject(new Error("IA local não respondeu em 45 segundos."));
      }, 45000);
      w.onerror = (event) => {
        clearTimeout(timeout);
        w.terminate();
        reject(new Error(event.message));
      };
      const frame = async () => {
        const canvas = new OffscreenCanvas(256, 144),
          ctx = canvas.getContext("2d");
        ctx.fillStyle = "#234567";
        ctx.fillRect(0, 0, 256, 144);
        const bitmap = canvas.transferToImageBitmap();
        w.postMessage(
          { type: "frame", frame: bitmap, time: performance.now() },
          [bitmap],
        );
      };
      w.onmessage = async ({ data }) => {
        if (data.type === "error") {
          clearTimeout(timeout);
          w.terminate();
          reject(new Error(data.message));
        }
        if (data.type === "ready") await frame();
        if (data.type === "mask") {
          const canvas = new OffscreenCanvas(data.mask.width, data.mask.height);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(data.mask, 0, 0);
          const pixels = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          ).data;
          let min = 255,
            max = 0;
          for (let i = 3; i < pixels.length; i += 4) {
            min = Math.min(min, pixels[i]);
            max = Math.max(max, pixels[i]);
          }
          lastStats = {
            width: canvas.width,
            height: canvas.height,
            minAlpha: min,
            maxAlpha: max,
          };
          data.mask.close();
          frames++;
          totalMs += data.ms;
        }
        if (data.type === "done") {
          if (frames < 12) await frame();
          else {
            clearTimeout(timeout);
            w.terminate();
            resolve({
              frames,
              meanInferenceMs: totalMs / frames,
              elapsedMs: performance.now() - started,
              ...lastStats,
            });
          }
        }
      };
      const base = new URL("./", location.href);
      w.postMessage({
        type: "init",
        wasm: new URL("wasm", base).href,
        model: new URL("models/selfie_segmenter_landscape.tflite", base).href,
      });
    });
  }, worker);
  assert.equal(result.worker.frames, 12);
  await page
    .getByRole("button", { name: "Ativar minha câmera", exact: true })
    .click();
  await page.getByText("Câmera + composição", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Aparência", exact: true }).click();
  await page.getByRole("button", { name: "Dinâmico", exact: true }).click();
  await page
    .getByText("IA local ativa", { exact: true })
    .waitFor({ timeout: 45000 });
  await page.waitForTimeout(3000);
  result.engineMetrics = await page.locator(".performance").innerText();
  assert.match(result.engineMetrics, /máscara [1-9]/);
  await page.screenshot({
    path: path.join(root, "artifacts", "segmentation-ui.png"),
  });
  await page
    .locator(".background-option")
    .filter({ hasText: "Original" })
    .click();
  await page.getByText("Fundo original", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Desligar câmera", exact: true })
    .click();
  result.errors = errors;
  assert.equal(errors.length, 0);
  result.passed = true;
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  result.error = error.message;
  console.error(result.error);
  process.exitCode = 1;
} finally {
  if (app) await app.close();
  await writeFile(
    path.join(root, "artifacts", "segmentation-result.json"),
    JSON.stringify(result, null, 2),
  );
}
