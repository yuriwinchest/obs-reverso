import { _electron } from "playwright";
import electron from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "artifacts");
await mkdir(directory, { recursive: true });
const result = {
  passed: false,
  scope:
    "Câmera simulada do Chromium; no fundo Dinâmico a máscara da IA é trocada por uma elipse sintética porque o vídeo falso não tem pessoa. Não substitui teste com webcam física.",
  checks: {},
};
const errors = [];
let app;
const dark = (p) =>
  Math.abs(p[0] - 20) + Math.abs(p[1] - 30) + Math.abs(p[2] - 32) < 12;
const distance = (a, b) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
try {
  app = await _electron.launch({
    executablePath: electron,
    // Isolated profile: never touches the user's data or their open instance.
    args: [
      `--user-data-dir=${path.join(directory, "profile-check-framing")}`,
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
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1440, 900),
  );
  await page.waitForFunction(() => !!document.querySelector(".program-canvas"));
  const canvas = page.locator(".program-canvas");
  const pixel = (x, y) =>
    page.evaluate(
      ([x, y]) =>
        Array.from(
          document
            .querySelector(".program-canvas")
            .getContext("2d")
            .getImageData(x, y, 1, 1).data,
        ),
      [x, y],
    );
  const setRange = async (id, value) => {
    await page.locator(`#${id}`).fill(String(value));
    await page.waitForTimeout(250);
  };
  const shoot = async (name) => {
    await canvas.screenshot({ path: path.join(directory, `${name}.png`) });
    await page.screenshot({ path: path.join(directory, `${name}-janela.png`) });
  };

  await page
    .getByRole("button", { name: "Ativar minha câmera", exact: true })
    .click();
  await page.getByText("Câmera + composição", { exact: true }).waitFor();
  await page.waitForTimeout(800);
  await shoot("framing-1-original-centro");

  // Fundo Original: menor e deslocada; a sobra fica escura, não transparente.
  await setRange("camera-zoom", 0.6);
  await setRange("camera-x", 0.2);
  await setRange("camera-y", -0.1);
  await shoot("framing-2-original-menor-deslocada");
  const leftGap = await pixel(300, 360);
  assert.ok(dark(leftGap), `sobra à esquerda deveria ser escura: ${leftGap}`);
  assert.ok(!dark(await pixel(896, 324)), "centro deslocado sem vídeo");
  result.checks.originalShrunk = { leftGap };

  await setRange("camera-zoom", 1.6);
  await setRange("camera-x", 0);
  await setRange("camera-y", 0.15);
  await shoot("framing-3-original-maior-abaixo");
  assert.ok(!dark(await pixel(10, 10)), "zoom maior deveria cobrir o canto");

  // Arrastar e roda do mouse na prévia.
  await page.getByRole("button", { name: "Centralizar", exact: true }).click();
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(cx + i * 16, cy + i * 6);
  await page.mouse.up();
  await page.waitForTimeout(250);
  const dragged = {
    x: Number(await page.locator("#camera-x").inputValue()),
    y: Number(await page.locator("#camera-y").inputValue()),
  };
  assert.ok(dragged.x > 0.05, `arrastar para a direita: ${dragged.x}`);
  assert.ok(dragged.y > 0.02, `arrastar para baixo: ${dragged.y}`);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(300);
  const wheelZoom = Number(await page.locator("#camera-zoom").inputValue());
  assert.ok(wheelZoom > 1.1, `roda para cima aumenta: ${wheelZoom}`);
  await shoot("framing-4-arrastada-roda");
  await page.mouse.dblclick(cx, cy);
  await page.waitForTimeout(250);
  assert.equal(await page.locator("#camera-zoom").inputValue(), "1");
  assert.equal(await page.locator("#camera-x").inputValue(), "0");
  result.checks.pointer = { dragged, wheelZoom, doubleClickCentered: true };

  // Fundo Dinâmico com máscara sintética (elipse no centro do quadro).
  await page.evaluate(() => {
    const Native = window.Worker;
    window.Worker = class extends Native {
      set onmessage(handler) {
        super.onmessage = (event) => {
          if (event.data?.type !== "mask") return handler(event);
          event.data.mask.close();
          const c = new OffscreenCanvas(256, 144),
            x = c.getContext("2d");
          x.fillStyle = "#fff";
          x.beginPath();
          x.ellipse(128, 80, 46, 60, 0, 0, Math.PI * 2);
          x.fill();
          handler({ data: { ...event.data, mask: c.transferToImageBitmap() } });
        };
      }
      get onmessage() {
        return super.onmessage;
      }
    };
  });
  await page.getByRole("button", { name: "Aparência", exact: true }).click();
  await page.getByRole("button", { name: "Dinâmico", exact: true }).click();
  await page
    .getByText("IA local ativa", { exact: true })
    .waitFor({ timeout: 45000 });
  await page.waitForTimeout(1500);
  await shoot("framing-5-dinamico-centro");
  // (896, 384) fica fora da elipse centrada e dentro dela após o enquadramento.
  const before = await pixel(896, 384);
  await page.getByRole("button", { name: "Fontes", exact: true }).click();
  await setRange("camera-zoom", 0.6);
  await setRange("camera-x", 0.2);
  await page.waitForTimeout(500);
  await shoot("framing-6-dinamico-menor-direita");
  const after = await pixel(896, 384);
  const corner = await pixel(10, 10);
  assert.ok(!dark(corner), `fundo deveria cobrir o canto: ${corner}`);
  assert.ok(
    distance(before, after) > 30,
    `pessoa recortada deveria ter ido para a direita: ${before} → ${after}`,
  );
  result.checks.dynamic = { before, after, corner };
  await setRange("camera-zoom", 1.5);
  await setRange("camera-x", -0.15);
  await setRange("camera-y", 0.1);
  await shoot("framing-7-dinamico-maior-esquerda");

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
    path.join(directory, "framing-result.json"),
    JSON.stringify(result, null, 2),
  );
}
