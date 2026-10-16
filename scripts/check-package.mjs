import { _electron } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import probe from "ffprobe-static";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "artifacts");
await mkdir(directory, { recursive: true });
const result = {
  passed: false,
  scope:
    "Executável Windows empacotado real; câmera e áudio sintéticos; IA local; gravação com engine e ponte de produção. Sem YouTube ou câmera física.",
};
let app;
try {
  app = await _electron.launch({
    executablePath: path.join(root, "release/win-unpacked/OBS Reverso.exe"),
    // Isolated profile: never touches the user's data or their open instance.
    args: [
      `--user-data-dir=${path.join(root, "artifacts", "profile-check-package")}`,
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
    cwd: root,
    env: { ...process.env, VITE_DEV_SERVER_URL: "", OBS_REVERSO_SMOKE: "" },
    timeout: 60000,
  });
  const page = await app.firstWindow();
  await page.waitForFunction(
    () => window.studio && document.querySelector(".program-canvas"),
  );
  assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);
  result.info = await page.evaluate(() => window.studio.info());
  assert.equal(result.info.ffmpeg, true);
  const finalPath = path.join(directory, "packaged-recording.webm");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, finalPath);
  await page
    .getByRole("button", { name: "Ativar minha câmera", exact: true })
    .click();
  await page.getByText("Câmera + composição", { exact: true }).waitFor();
  // The Sources panel and the transport bar both expose this action.
  await page
    .locator(".transport")
    .getByRole("button", { name: "Ativar microfone", exact: true })
    .click();
  await page.getByRole("button", { name: "Aparência", exact: true }).click();
  await page.getByRole("button", { name: "Dinâmico", exact: true }).click();
  await page
    .getByText("IA local ativa", { exact: true })
    .waitFor({ timeout: 45000 });
  await page.waitForTimeout(2000);
  result.metrics = await page.locator(".performance").innerText();
  assert.match(result.metrics, /máscara [1-9]/);
  await page.getByRole("button", { name: "Gravar", exact: true }).click();
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: /Parar gravação/ }).click();
  await page
    .getByRole("button", { name: "Gravar", exact: true })
    .waitFor({ timeout: 30000 });
  await page.screenshot({ path: path.join(directory, "packaged-studio.png") });
  const { stdout } = await promisify(execFile)(
    probe.path,
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", finalPath],
    { windowsHide: true, timeout: 30000 },
  );
  const media = JSON.parse(stdout);
  result.recording = {
    duration: Number(media.format.duration),
    codecs: media.streams.map((s) => s.codec_name),
    width: media.streams.find((s) => s.codec_type === "video")?.width,
  };
  assert.ok(result.recording.duration >= 2.5);
  assert.equal(result.recording.width, 1280);
  assert.ok(result.recording.codecs.includes("opus"));
  result.passed = true;
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  result.error = error.message;
  console.error(result.error);
  process.exitCode = 1;
} finally {
  if (app) await app.close();
  await writeFile(
    path.join(directory, "package-result.json"),
    JSON.stringify(result, null, 2),
  );
}
