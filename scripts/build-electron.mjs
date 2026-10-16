import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
await mkdir("dist-electron", { recursive: true });
await build({
  entryPoints: ["electron/main.ts"],
  outfile: "dist-electron/main.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron", "ffmpeg-static"],
  sourcemap: true,
});
await build({
  entryPoints: ["electron/preload.ts"],
  outfile: "dist-electron/preload.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
});
