import type { StudioBridge } from "../shared/types";
const MAX_PENDING = 16 * 1024 * 1024;
const MIME = "video/webm;codecs=vp8,opus";
type StartOptions = Parameters<StudioBridge["broadcastStart"]>[0];

export class OutputController {
  private recorder: MediaRecorder | null = null;
  private session: string | null = null;
  private queue: Promise<void> = Promise.resolve();
  private pendingBytes = 0;
  private seq = 0;
  private starting = false;
  private stopping: Promise<void> | null = null;
  private fault = false;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private oldestAt = 0;
  constructor(
    private kind: "recording" | "broadcast",
    private onChange: (state: string) => void,
    private onError: (message: string) => void,
  ) {}
  get active() {
    return this.starting || this.recorder !== null;
  }
  async start(stream: MediaStream, options?: StartOptions): Promise<boolean> {
    if (this.active || this.stopping) return false;
    if (!MediaRecorder.isTypeSupported(MIME))
      throw new Error(
        "Este computador não disponibilizou o codificador de vídeo VP8/Opus.",
      );
    this.starting = true;
    this.onChange("starting");
    this.fault = false;
    this.seq = 0;
    this.pendingBytes = 0;
    this.oldestAt = 0;
    this.queue = Promise.resolve();
    try {
      const result =
        this.kind === "recording"
          ? await window.studio.recordingStart()
          : await window.studio.broadcastStart(options ?? { mode: "key" });
      if (!result) {
        this.onChange("idle");
        return false;
      }
      this.session = result.id;
      const recorder = new MediaRecorder(stream, {
        mimeType: MIME,
        videoBitsPerSecond: 3_000_000,
        audioBitsPerSecond: 128000,
      });
      this.recorder = recorder;
      recorder.ondataavailable = (event) => {
        if (!event.data.size || this.fault) return;
        if (this.pendingBytes + event.data.size > MAX_PENDING) {
          this.fail(
            "A saída não acompanhou o vídeo. A sessão foi encerrada para evitar atraso; confira o destino e tente novamente.",
          );
          return;
        }
        this.pendingBytes += event.data.size;
        if (!this.oldestAt) this.oldestAt = performance.now();
        const seq = this.seq++,
          id = this.session!;
        this.queue = this.queue
          .then(async () => {
            if (this.fault) return;
            const bytes = await event.data.arrayBuffer();
            if (this.kind === "recording")
              await window.studio.recordingAppend(id, seq, bytes);
            else await window.studio.broadcastAppend(id, seq, bytes);
          })
          .catch(() =>
            this.fail(
              this.kind === "recording"
                ? "A gravação falhou. O arquivo parcial foi preservado; verifique o espaço em disco."
                : "O envio foi interrompido. Confira a conexão e a chave no YouTube Studio.",
            ),
          )
          .finally(() => {
            this.pendingBytes -= event.data.size;
            if (!this.pendingBytes) this.oldestAt = 0;
          });
      };
      recorder.onerror = () =>
        this.fail(
          "O codificador de vídeo foi interrompido. Encerre esta saída e tente novamente.",
        );
      recorder.start(500);
      this.watchdog = setInterval(() => {
        if (this.oldestAt && performance.now() - this.oldestAt > 8000)
          this.fail(
            "A saída acumulou mais de 8 segundos de atraso e foi encerrada.",
          );
      }, 1000);
      if (this.kind === "recording") this.onChange("recording");
      return true;
    } catch (error) {
      if (this.session) {
        try {
          if (this.kind === "recording")
            await window.studio.recordingStop(this.session);
          else await window.studio.broadcastStop(this.session);
        } catch {
          /* Keep recoverable partials when setup cannot finish. */
        }
      }
      this.session = null;
      this.recorder = null;
      this.onChange("error");
      throw error;
    } finally {
      this.starting = false;
    }
  }
  private fail(message: string) {
    if (this.fault) return;
    this.fault = true;
    this.onError(message);
    this.onChange("error");
    void this.stop().catch(() => {});
  }
  async stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    if (!this.recorder || !this.session) return;
    const recorder = this.recorder,
      id = this.session;
    this.stopping = (async () => {
      if (this.watchdog) {
        clearInterval(this.watchdog);
        this.watchdog = null;
      }
      if (!this.fault) this.onChange("stopping");
      try {
        if (recorder.state !== "inactive")
          await new Promise<void>((resolve) => {
            recorder.addEventListener("stop", () => resolve(), { once: true });
            recorder.stop();
          });
        await this.queue;
        if (this.kind === "recording") await window.studio.recordingStop(id);
        else await window.studio.broadcastStop(id);
        if (!this.fault) this.onChange("idle");
      } finally {
        this.recorder = null;
        this.session = null;
        this.stopping = null;
      }
    })();
    return this.stopping;
  }
}
