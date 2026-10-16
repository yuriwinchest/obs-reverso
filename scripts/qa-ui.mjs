import assert from "node:assert/strict";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import electron from "electron";
import probe from "ffprobe-static";
import { _electron } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "artifacts");
await mkdir(directory, { recursive: true });
const result = {
  passed: false,
  scope:
    "Interface Electron real sem dispositivos, segredo real ou transmissão.",
  layouts: [],
};
let app;
try {
  app = await _electron.launch({
    executablePath: electron,
    // Isolated profile: never touches the user's data or their open instance.
    args: [
      root,
      `--user-data-dir=${path.join(root, "artifacts", "profile-qa-ui")}`,
    ],
    cwd: root,
    env: { ...process.env, OBS_REVERSO_SMOKE: "1", VITE_DEV_SERVER_URL: "" },
    timeout: 60000,
  });
  const page = await app.firstWindow();
  await page.waitForFunction(
    () => window.studio && document.querySelector(".transport"),
  );
  for (const view of [
    { name: "1280x800", width: 1280, height: 800, zoom: 1 },
    { name: "1100x720", width: 1100, height: 720, zoom: 1 },
    { name: "1100x720-at150", width: 1650, height: 1080, zoom: 1.5 },
  ]) {
    await app.evaluate(({ BrowserWindow }, size) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.webContents.setZoomFactor(size.zoom);
      window.setContentSize(size.width, size.height);
    }, view);
    await page.waitForTimeout(500);
    const geometry = await page.evaluate(() => {
      const rect = (selector) => {
        const node = document.querySelector(selector);
        const box = node.getBoundingClientRect();
        return {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          bottom: box.bottom,
          right: box.right,
        };
      };
      return {
        width: innerWidth,
        height: innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        transport: rect(".transport"),
        primaryCta: rect(".live-button"),
        cameraCta: rect(".preview-idle button"),
        preview: rect(".preview-shell"),
        stage: rect(".stage-column"),
      };
    });
    assert.ok(
      geometry.documentWidth <= geometry.width + 1,
      `${view.name}: overflow horizontal.`,
    );
    assert.ok(
      geometry.primaryCta.bottom <= geometry.height &&
        geometry.primaryCta.right <= geometry.width,
      `${view.name}: ação live fora da janela.`,
    );
    assert.ok(
      geometry.cameraCta.bottom < geometry.transport.y,
      `${view.name}: CTA câmera coberto pelo rodapé.`,
    );
    await page.screenshot({
      path: path.join(directory, `ui-${view.name}.png`),
    });
    result.layouts.push({ ...view, geometry });
  }
  await page.getByRole("button", { name: "Destino", exact: true }).click();
  assert.equal(
    await page.locator("#privacy").inputValue(),
    "private",
    "Visibilidade inicial deve ser privada.",
  );
  await page
    .getByRole("button", { name: "Chave de transmissão", exact: true })
    .click();
  assert.equal(
    await page.locator("#stream-key").getAttribute("type"),
    "password",
  );
  await page.locator("#stream-key").fill("smoke-key-never-external");
  await page
    .getByRole("button", { name: "Entrar ao vivo", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  assert.equal(
    await dialog
      .getByText("Confira no YouTube Studio", { exact: true })
      .count(),
    1,
    "Revisão por chave precisa explicar privacidade externa.",
  );
  for (let step = 0; step < 9; step++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() =>
        document
          .querySelector('[role="dialog"]')
          .contains(document.activeElement),
      ),
      true,
      "Foco escapou da confirmação.",
    );
  }
  await page.screenshot({ path: path.join(directory, "ui-confirmation.png") });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    await page
      .getByRole("button", { name: "Entrar ao vivo", exact: true })
      .evaluate((node) => node === document.activeElement),
    true,
    "Foco não retornou ao botão que abriu diálogo.",
  );
  if (process.argv.includes("--recording")) {
    await page.evaluate(() => {
      window.__uiStatuses = [];
      window.studio.onStatus((status) => window.__uiStatuses.push(status));
    });
    await page.getByRole("button", { name: "Gravar", exact: true }).click();
    await page
      .getByRole("button", { name: "Parar gravação", exact: true })
      .waitFor();
    await page.waitForTimeout(2200);
    await page
      .getByRole("button", { name: "Parar gravação", exact: true })
      .click();
    await page.getByRole("button", { name: "Gravar", exact: true }).waitFor();
    const statuses = await page.evaluate(() => window.__uiStatuses);
    result.recordingStatuses = statuses;
    result.recordingUiMessage = await page
      .locator(".toast")
      .innerText()
      .catch(() => "");
    await page.screenshot({
      path: path.join(directory, "ui-recording-status.png"),
    });
    assert.equal(
      statuses.some((status) => status.state === "error"),
      false,
      "A gravação pela interface sinalizou erro.",
    );
    const saved = statuses.findLast(
      (status) =>
        status.kind === "recording" && status.state === "idle" && status.path,
    );
    assert.ok(saved, "Fluxo UI não finalizou arquivo.");
    const file = path.join(directory, "ui-recording.webm");
    await copyFile(saved.path, file);
    const { stdout } = await promisify(execFile)(
      probe.path,
      ["-v", "error", "-show_format", "-show_streams", "-of", "json", file],
      { windowsHide: true, timeout: 30000 },
    );
    const media = JSON.parse(stdout);
    assert.ok(
      Number(media.format.duration) >= 2,
      "Gravação pela UI não contém duração finalizada.",
    );
    assert.ok(
      media.streams.some((stream) => stream.codec_type === "video"),
      "Gravação pela UI sem vídeo.",
    );
    result.recordingFlow = {
      durationSeconds: Number(media.format.duration),
      codecs: media.streams.map((stream) => stream.codec_name),
      file: "ui-recording.webm",
      scope:
        "Tela de espera real → OutputController real → main → remux; sem câmera e sem validação de som físico.",
    };
  }
  result.passed = true;
} catch (error) {
  result.error = String(error.message ?? error);
  process.exitCode = 1;
} finally {
  if (app) await app.close().catch(() => {});
  await writeFile(
    path.join(directory, "ui-result.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(
    result.passed
      ? "PASS: interface, janela mínima, zoom 150%, revisão, privacidade, chave protegida e foco."
      : `FAIL: ${result.error}`,
  );
}
