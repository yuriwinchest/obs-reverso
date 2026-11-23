import type { StudioBridge } from "../shared/types";
import { BacklogClock } from "./backlog";
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
  private backlog = new BacklogClock();
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
    this.backlog.clear();
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
        this.backlog.add(performance.now());
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
          .catch((error: unknown) => {
            this.diag(
              `envio do bloco ${seq} falhou: ${(error as Error)?.message}`,
            );
            this.fail(
              this.kind === "recording"
                ? "A gravação falhou. O arquivo parcial foi preservado; verifique o espaço em disco."
                : "O envio foi interrompido. Confira a conexão e a chave no YouTube Studio.",
            );
          })
          .finally(() => {
            this.pendingBytes -= event.data.size;
            this.backlog.done();
          });
      };
      recorder.onerror = (event) => {
        const cause = (event as Event & { error?: DOMException }).error;
        this.diag(
          `MediaRecorder parou: ${cause?.name ?? "?"} ${cause?.message ?? ""}`,
        );
        this.fail(
          "O codificador de vídeo foi interrompido. Encerre esta saída e tente novamente.",
        );
      };
      recorder.start(500);
      this.diag("iniciada");
      let ticks = 0;
      this.watchdog = setInterval(() => {
        if (++ticks % 15 === 0)
          this.diag(
            `atraso ${Math.round(this.backlog.oldestAge(performance.now()))} ms, fila ${this.pendingBytes} bytes, blocos ${this.seq}`,
          );
        if (this.backlog.oldestAge(performance.now()) > 15000)
          this.fail(
            "A saída acumulou mais de 15 segundos de atraso e foi encerrada. O computador não acompanhou a codificação.",
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
  private diag(text: string) {
    void window.studio?.diag?.(`${this.kind}: ${text}`).catch(() => {});
  }
  private fail(message: string) {
    if (this.fault) return;
    this.fault = true;
    this.diag(
      `encerrada: ${message} (atraso ${Math.round(this.backlog.oldestAge(performance.now()))} ms, fila ${this.pendingBytes} bytes)`,
    );
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
