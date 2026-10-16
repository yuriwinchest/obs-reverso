import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";
let segmenter: ImageSegmenter | null = null;
let previous: Float32Array | null = null;
let canvas: OffscreenCanvas;
self.onmessage = async (event: MessageEvent) => {
  const data = event.data;
  if (data.type === "init") {
    try {
      const files = await FilesetResolver.forVisionTasks(data.wasm);
      segmenter = await ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: data.model, delegate: "CPU" },
        runningMode: "VIDEO",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
      self.postMessage({ type: "ready" });
    } catch {
      self.postMessage({
        type: "error",
        message:
          "Não foi possível carregar a IA local. Rode a preparação de recursos e tente novamente.",
      });
    }
    return;
  }
  if (data.type === "frame") {
    const frame = data.frame as ImageBitmap;
    try {
      if (!segmenter) return;
      const started = performance.now();
      segmenter.segmentForVideo(frame, data.time, (result) => {
        const masks = result.confidenceMasks;
        if (!masks?.length) throw new Error("Máscara ausente");
        const person = masks[masks.length - 1];
        const confidence = person.getAsFloat32Array();
        if (
          !canvas ||
          canvas.width !== person.width ||
          canvas.height !== person.height
        ) {
          canvas = new OffscreenCanvas(person.width, person.height);
          previous = null;
        }
        const ctx = canvas.getContext("2d")!;
        const pixels = ctx.createImageData(person.width, person.height);
        if (!previous || previous.length !== confidence.length)
          previous = new Float32Array(confidence);
        for (let i = 0; i < confidence.length; i++) {
          const value = confidence[i] * 0.8 + previous[i] * 0.2;
          previous[i] = value;
          const t = Math.min(1, Math.max(0, (value - 0.25) / 0.5));
          pixels.data[i * 4] = 255;
          pixels.data[i * 4 + 1] = 255;
          pixels.data[i * 4 + 2] = 255;
          pixels.data[i * 4 + 3] = Math.round(t * t * (3 - 2 * t) * 255);
        }
        ctx.putImageData(pixels, 0, 0);
        const mask = canvas.transferToImageBitmap();
        self.postMessage(
          { type: "mask", mask, ms: performance.now() - started },
          [mask],
        );
      });
    } catch {
      self.postMessage({
        type: "error",
        message:
          "A remoção de fundo falhou. O vídeo original continua disponível.",
      });
    } finally {
      frame.close();
      self.postMessage({ type: "done" });
    }
  }
  if (data.type === "stop") {
    segmenter?.close();
    segmenter = null;
    previous = null;
    self.close();
  }
};
