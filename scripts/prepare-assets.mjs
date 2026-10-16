import {
  mkdir,
  copyFile,
  readdir,
  writeFile,
  readFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
const url =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/1/selfie_segmenter_landscape.tflite";
await mkdir("public/models", { recursive: true });
await mkdir("public/wasm", { recursive: true });
for (const name of await readdir("node_modules/@mediapipe/tasks-vision/wasm"))
  if (/\.(wasm|js)$/.test(name))
    await copyFile(
      `node_modules/@mediapipe/tasks-vision/wasm/${name}`,
      `public/wasm/${name}`,
    );
const path = "public/models/selfie_segmenter_landscape.tflite";
let bytes;
try {
  bytes = await readFile(path);
} catch {
  console.log("Baixando modelo local de segmentação (~250 KB)…");
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`Modelo HTTP ${r.status}`);
  bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length < 10000 || bytes.toString("ascii", 4, 8) !== "TFL3")
    throw new Error("Modelo TFLite inválido");
  await writeFile(path, bytes);
}
await writeFile(
  "public/models/manifest.json",
  JSON.stringify(
    {
      model: "MediaPipe Selfie Segmenter Landscape float16 v1",
      source: url,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
    },
    null,
    2,
  ),
);
console.log(`Modelo local pronto: ${bytes.length} bytes; WASM copiado.`);
