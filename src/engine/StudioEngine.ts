import {
  defaultConfig,
  emptyMetrics,
  type ProgramConfig,
  type Metrics,
} from "../shared/types";

function videoElement(stream: MediaStream) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  return video;
}
export function coverRect(sw: number, sh: number, dw: number, dh: number) {
  const scale = Math.max(dw / sw, dh / sh);
  return {
    x: (dw - sw * scale) / 2,
    y: (dh - sh * scale) / 2,
    w: sw * scale,
    h: sh * scale,
  };
}
function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  w: number,
  h: number,
) {
  if (!sw || !sh) return;
  const r = coverRect(sw, sh, w, h);
  ctx.drawImage(source, r.x, r.y, r.w, r.h);
}

export class StudioEngine {
  config: ProgramConfig = { ...defaultConfig };
  metrics: Metrics = { ...emptyMetrics };
  private ctx: CanvasRenderingContext2D;
  private camera: MediaStream | null = null;
  private mic: MediaStream | null = null;
  private screen: MediaStream | null = null;
  private cameraVideo: HTMLVideoElement | null = null;
  private screenVideo: HTMLVideoElement | null = null;
  private audio: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private silence: ConstantSourceNode | null = null;
  private micNode: MediaStreamAudioSourceNode | null = null;
  private screenNode: MediaStreamAudioSourceNode | null = null;
  private gain: GainNode | null = null;
  private screenGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private output: MediaStream | null = null;
  private timer: number;
  private worker: Worker | null = null;
  private mask: ImageBitmap | null = null;
  private pending = false;
  private lastMaskRequest = 0;
  private lastFrame = 0;
  private lastStats = performance.now();
  private frames = 0;
  private masks = 0;
  private disposed = false;
  private image: HTMLImageElement | null = null;
  private cameraGeneration = 0;
  private micGeneration = 0;
  private maskTime = 0;
  private layer = document.createElement("canvas");
  private small = document.createElement("canvas");
  constructor(
    private canvas: HTMLCanvasElement,
    private onMetrics: (metrics: Metrics) => void,
    private onError: (message: string) => void,
  ) {
    canvas.width = 1280;
    canvas.height = 720;
    this.layer.width = 1280;
    this.layer.height = 720;
    this.small.width = 256;
    this.small.height = 144;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.timer = window.setInterval(() => this.render(), 1000 / 24);
    this.render();
  }
  private ensureAudio() {
    if (!this.audio) {
      this.audio = new AudioContext({ sampleRate: 48000 });
      this.destination = this.audio.createMediaStreamDestination();
      // Keep the output audio clock running when mic and screen audio are off.
      // Chromium may otherwise wait for a first audio sample before writing WebM.
      this.silence = this.audio.createConstantSource();
      this.silence.offset.value = 0;
      this.silence.connect(this.destination);
      this.silence.start();
      this.gain = this.audio.createGain();
      this.analyser = this.audio.createAnalyser();
      this.analyser.fftSize = 512;
      this.gain.connect(this.analyser);
      this.analyser.connect(this.destination);
      this.screenGain = this.audio.createGain();
      this.screenGain.connect(this.destination);
      this.syncGains();
    }
    void this.audio.resume();
  }
  private syncGains() {
    if (this.gain)
      this.gain.gain.value = this.config.muted ? 0 : this.config.micGain;
    if (this.screenGain) this.screenGain.gain.value = this.config.desktopGain;
  }
  async listDevices() {
    return navigator.mediaDevices.enumerateDevices();
  }
  async startCamera(deviceId?: string) {
    const generation = ++this.cameraGeneration;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
        audio: false,
      });
    } catch {
      throw new Error(
        "Não foi possível abrir a câmera. Confira a permissão do Windows e se outro aplicativo está usando o dispositivo.",
      );
    }
    if (this.disposed || generation !== this.cameraGeneration) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stopCameraTracks();
    this.camera = stream;
    this.cameraVideo = videoElement(stream);
    await this.cameraVideo.play();
    stream.getVideoTracks()[0].addEventListener("ended", () => {
      if (this.camera === stream) {
        this.stopCamera();
        this.onError(
          "A câmera foi desconectada. Escolha um dispositivo para continuar.",
        );
      }
    });
    this.metrics.camera = true;
    this.emit();
    this.ensureSegmenter();
  }
  private stopCameraTracks() {
    this.camera?.getTracks().forEach((t) => t.stop());
    if (this.cameraVideo) {
      this.cameraVideo.pause();
      this.cameraVideo.srcObject = null;
    }
    this.camera = null;
    this.cameraVideo = null;
    this.mask?.close();
    this.mask = null;
  }
  stopCamera() {
    this.cameraGeneration++;
    this.stopCameraTracks();
    this.worker?.terminate();
    this.worker = null;
    this.pending = false;
    this.metrics.camera = false;
    this.metrics.segmentation = "off";
    this.emit();
  }
  async startMic(deviceId?: string) {
    const generation = ++this.micGeneration;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
      });
    } catch {
      throw new Error(
        "Não foi possível abrir o microfone. Confira a permissão e selecione a entrada de áudio.",
      );
    }
    if (this.disposed || generation !== this.micGeneration) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stopMicTracks();
    this.ensureAudio();
    this.mic = stream;
    this.micNode = this.audio!.createMediaStreamSource(stream);
    this.micNode.connect(this.gain!);
    stream.getAudioTracks()[0].addEventListener("ended", () => {
      if (this.mic === stream) {
        this.stopMic();
        this.onError(
          "O microfone foi desconectado. A saída continua com o áudio disponível.",
        );
      }
    });
    this.metrics.microphone = true;
    this.emit();
  }
  private stopMicTracks() {
    this.micNode?.disconnect();
    this.micNode = null;
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
  }
  stopMic() {
    this.micGeneration++;
    this.stopMicTracks();
    this.metrics.microphone = false;
    this.metrics.micLevel = 0;
    this.emit();
  }
  async startScreen() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 24, max: 30 } },
        audio: true,
      });
    } catch {
      throw new Error(
        "Compartilhamento não iniciado. Escolha uma tela ou janela e confirme a permissão.",
      );
    }
    if (this.disposed) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stopScreen();
    this.screen = stream;
    this.screenVideo = videoElement(stream);
    await this.screenVideo.play();
    if (stream.getAudioTracks().length) {
      this.ensureAudio();
      this.screenNode = this.audio!.createMediaStreamSource(stream);
      this.screenNode.connect(this.screenGain!);
    }
    stream.getVideoTracks()[0].addEventListener("ended", () => {
      if (this.screen === stream) this.stopScreen();
    });
    this.metrics.screen = true;
    this.emit();
  }
  stopScreen() {
    this.screenNode?.disconnect();
    this.screenNode = null;
    this.screen?.getTracks().forEach((t) => t.stop());
    if (this.screenVideo) {
      this.screenVideo.pause();
      this.screenVideo.srcObject = null;
    }
    this.screen = null;
    this.screenVideo = null;
    this.metrics.screen = false;
    this.emit();
  }
  update(patch: Partial<ProgramConfig>) {
    const oldImage = this.config.imageUrl;
    const wasOriginal = this.config.background === "original";
    this.config = { ...this.config, ...patch };
    this.syncGains();
    if (this.config.background === "original") {
      this.worker?.terminate();
      this.worker = null;
      this.pending = false;
      this.mask?.close();
      this.mask = null;
      this.metrics.segmentation = "off";
      this.emit();
    } else if (wasOriginal && this.metrics.segmentation === "error") {
      this.worker?.terminate();
      this.worker = null;
      this.pending = false;
    }
    if (patch.imageUrl !== undefined && oldImage !== patch.imageUrl) {
      this.image = null;
      if (patch.imageUrl) {
        const image = new Image();
        image.onload = () => {
          if (this.config.imageUrl === patch.imageUrl) this.image = image;
        };
        image.onerror = () =>
          this.onError(
            "Essa imagem não pôde ser aberta. Escolha PNG, JPG ou WebP.",
          );
        image.src = patch.imageUrl;
      }
    }
    this.ensureSegmenter();
  }
  private ensureSegmenter() {
    if (
      this.disposed ||
      !this.camera ||
      this.config.background === "original" ||
      this.worker
    )
      return;
    this.metrics.segmentation = "loading";
    this.emit();
    this.worker = new Worker(new URL("./segment.worker.ts", import.meta.url));
    this.worker.onmessage = ({ data }) => {
      if (this.disposed) {
        data.mask?.close();
        return;
      }
      if (data.type === "ready") {
        this.metrics.segmentation = "ready";
        this.emit();
      }
      if (data.type === "mask") {
        this.mask?.close();
        this.mask = data.mask;
        this.maskTime = performance.now();
        this.metrics.maskMs = data.ms;
        this.masks++;
      }
      if (data.type === "done") this.pending = false;
      if (data.type === "error") {
        this.metrics.segmentation = "error";
        this.pending = false;
        this.onError(data.message);
        this.emit();
      }
    };
    this.worker.onerror = () => {
      this.metrics.segmentation = "error";
      this.pending = false;
      this.onError(
        "A IA local não iniciou. Rode a preparação de recursos e tente novamente.",
      );
      this.emit();
    };
    const base = new URL(import.meta.env.BASE_URL, location.href);
    this.worker.postMessage({
      type: "init",
      wasm: new URL("wasm", base).href,
      model: new URL("models/selfie_segmenter_landscape.tflite", base).href,
    });
  }
  retrySegmentation() {
    this.worker?.terminate();
    this.worker = null;
    this.mask?.close();
    this.mask = null;
    this.pending = false;
    this.ensureSegmenter();
  }
  getStream() {
    this.ensureAudio();
    if (!this.output) {
      this.output = new MediaStream([
        ...this.canvas.captureStream(24).getVideoTracks(),
        ...this.destination!.stream.getAudioTracks(),
      ]);
    }
    return this.output;
  }
  private emit() {
    this.onMetrics({ ...this.metrics });
  }
  private background(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    now: number,
  ) {
    const kind = this.config.background;
    if (kind === "image" && this.image) {
      drawCover(
        ctx,
        this.image,
        this.image.naturalWidth,
        this.image.naturalHeight,
        w,
        h,
      );
      return;
    }
    if (kind === "motion") {
      const palettes = {
        aurora: ["#0e2829", "#326451", "#bdc67a"],
        studio: ["#1d2229", "#535963", "#b19c83"],
        sunset: ["#31233d", "#bf6c50", "#ebc08b"],
      };
      const p = palettes[this.config.motion];
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, p[0]);
      gradient.addColorStop(1, p[1]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) {
        const x = w * (0.18 + i * 0.24) + Math.sin(now / 14000 + i) * w * 0.16;
        const y = h * (0.3 + Math.cos(now / 18000 + i) * 0.2);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, w * 0.48);
        glow.addColorStop(0, p[2] + "42");
        glow.addColorStop(1, p[2] + "00");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
      }
      return;
    }
    if (kind === "blur" && this.cameraVideo) {
      ctx.save();
      ctx.filter = `blur(${this.config.blur}px)`;
      ctx.translate(w / 2, h / 2);
      ctx.scale(1.08, 1.08);
      ctx.translate(-w / 2, -h / 2);
      if (this.config.mirror) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      drawCover(
        ctx,
        this.cameraVideo,
        this.cameraVideo.videoWidth,
        this.cameraVideo.videoHeight,
        w,
        h,
      );
      ctx.restore();
      return;
    }
    ctx.fillStyle = this.config.color;
    ctx.fillRect(0, 0, w, h);
  }
  private foreground = document.createElement("canvas");
  private render() {
    if (this.disposed) return;
    const now = performance.now(),
      ctx = this.ctx,
      w = this.canvas.width,
      h = this.canvas.height;
    this.frames++;
    this.lastFrame = now;
    ctx.fillStyle = "#141e20";
    ctx.fillRect(0, 0, w, h);
    if (this.screenVideo?.readyState && this.screenVideo.readyState >= 2)
      drawCover(
        ctx,
        this.screenVideo,
        this.screenVideo.videoWidth,
        this.screenVideo.videoHeight,
        w,
        h,
      );
    else if (!this.cameraVideo) {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, "#142b29");
      gradient.addColorStop(1, "#32382d");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#ffffff0b";
      for (let x = 0; x < w; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.textAlign = "center";
      ctx.fillStyle = "#eae6d9";
      ctx.font = "500 38px Segoe UI";
      ctx.fillText("Seu próximo ao vivo começa aqui.", w / 2, h / 2 - 8);
      ctx.font = "22px Segoe UI";
      ctx.fillStyle = "#b4c1b6";
      ctx.fillText("Ligue a câmera ou compartilhe sua tela", w / 2, h / 2 + 40);
      ctx.textAlign = "left";
    }
    if (this.cameraVideo && this.cameraVideo.readyState >= 2) {
      const v = this.cameraVideo;
      const layerCtx = this.layer.getContext("2d")!;
      layerCtx.clearRect(0, 0, w, h);
      if (
        this.config.background !== "original" &&
        this.mask &&
        now - this.maskTime >= 2000 &&
        this.metrics.segmentation === "ready"
      ) {
        this.metrics.segmentation = "error";
        this.worker?.terminate();
        this.worker = null;
        this.pending = false;
        this.onError(
          "A IA deixou de acompanhar a câmera. O vídeo voltou ao fundo original; selecione Original e tente o efeito novamente.",
        );
        this.emit();
      }
      const effect =
        this.config.background !== "original" &&
        this.mask &&
        now - this.maskTime < 2000;
      if (effect) {
        this.background(layerCtx, w, h, now);
        if (this.foreground.width !== w) {
          this.foreground.width = w;
          this.foreground.height = h;
        }
        const fg = this.foreground.getContext("2d")!;
        fg.clearRect(0, 0, w, h);
        fg.globalCompositeOperation = "source-over";
        drawCover(fg, v, v.videoWidth, v.videoHeight, w, h);
        fg.globalCompositeOperation = "destination-in";
        fg.filter = "blur(1.5px)";
        fg.drawImage(this.mask!, 0, 0, w, h);
        fg.filter = "none";
        fg.globalCompositeOperation = "source-over";
        layerCtx.save();
        if (this.config.mirror) {
          layerCtx.translate(w, 0);
          layerCtx.scale(-1, 1);
        }
        layerCtx.drawImage(this.foreground, 0, 0);
        layerCtx.restore();
      } else {
        layerCtx.save();
        if (this.config.mirror) {
          layerCtx.translate(w, 0);
          layerCtx.scale(-1, 1);
        }
        drawCover(layerCtx, v, v.videoWidth, v.videoHeight, w, h);
        layerCtx.restore();
      }
      if (this.screen) {
        const pw = w * this.config.pipSize,
          ph = (pw * 9) / 16,
          px = this.config.pipPosition === "right" ? w - pw - 30 : 30,
          py = h - ph - 30;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 16);
        ctx.clip();
        ctx.drawImage(this.layer, px, py, pw, ph);
        ctx.restore();
        ctx.strokeStyle = "#e8e8dc";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 16);
        ctx.stroke();
      } else ctx.drawImage(this.layer, 0, 0);
      if (
        this.config.background !== "original" &&
        this.metrics.segmentation === "ready" &&
        !this.pending &&
        now - this.lastMaskRequest > 90
      ) {
        this.pending = true;
        this.lastMaskRequest = now;
        const small = this.small.getContext("2d")!;
        drawCover(small, v, v.videoWidth, v.videoHeight, 256, 144);
        void createImageBitmap(this.small)
          .then((frame) => {
            if (this.disposed || !this.worker) {
              frame.close();
              return;
            }
            this.worker.postMessage({ type: "frame", frame, time: now }, [
              frame,
            ]);
          })
          .catch(() => {
            this.pending = false;
          });
      }
    }
    if (this.config.title.trim()) {
      const title = this.config.title.slice(0, 70),
        subtitle = this.config.subtitle.slice(0, 100);
      ctx.fillStyle = "#101c21dd";
      ctx.fillRect(40, h - 132, w * 0.65, 92);
      ctx.fillStyle = "#f37643";
      ctx.fillRect(40, h - 132, 5, 92);
      ctx.fillStyle = "#fff9eb";
      ctx.font = "600 30px Segoe UI";
      ctx.fillText(title, 64, h - 92, w * 0.6);
      ctx.fillStyle = "#cbd1ce";
      ctx.font = "21px Segoe UI";
      ctx.fillText(subtitle, 64, h - 60, w * 0.6);
    }
    if (now - this.lastStats >= 500) {
      const elapsed = (now - this.lastStats) / 1000;
      this.metrics.fps = this.frames / elapsed;
      this.metrics.maskFps = this.masks / elapsed;
      this.frames = 0;
      this.masks = 0;
      this.lastStats = now;
      if (this.analyser && this.metrics.microphone && !this.config.muted) {
        const data = new Uint8Array(this.analyser.fftSize);
        this.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const x of data) sum += ((x - 128) / 128) ** 2;
        this.metrics.micLevel = Math.min(1, Math.sqrt(sum / data.length) * 4);
      } else this.metrics.micLevel = 0;
      this.emit();
    }
  }
  destroy() {
    this.disposed = true;
    clearInterval(this.timer);
    this.stopCamera();
    this.stopMic();
    this.stopScreen();
    this.worker?.terminate();
    this.worker = null;
    this.mask?.close();
    this.mask = null;
    this.output?.getTracks().forEach((t) => t.stop());
    this.silence?.stop();
    this.silence?.disconnect();
    this.silence = null;
    void this.audio?.close();
    this.image = null;
  }
}
