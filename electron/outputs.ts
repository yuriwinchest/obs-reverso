import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { open, rename, mkdir, rm, type FileHandle } from "node:fs/promises";
import path from "node:path";
import type { OutputStatus } from "../src/shared/types";

export const MAX_CHUNK = 4 * 1024 * 1024;
export const MAX_BACKLOG = 16 * 1024 * 1024;
export function youtubeDestination(
  key: unknown,
  address = "rtmps://a.rtmps.youtube.com:443/live2",
): string {
  if (typeof key !== "string" || !/^[a-zA-Z0-9_-]{8,256}$/.test(key))
    throw new Error("Chave de transmissão inválida.");
  const url = new URL(address);
  if (
    url.protocol !== "rtmps:" ||
    !["a.rtmps.youtube.com", "b.rtmps.youtube.com"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["", "443"].includes(url.port) ||
    !/^\/live2\/?$/.test(url.pathname)
  )
    throw new Error("Servidor de transmissão não permitido.");
  return `${url.toString().replace(/\/$/, "")}/${key}`;
}
export function validChunk(bytes: unknown): Buffer {
  if (
    !(bytes instanceof ArrayBuffer) ||
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_CHUNK
  )
    throw new Error("Bloco de mídia inválido.");
  return Buffer.from(bytes);
}
class OrderedSink {
  next = 0;
  queued = 0;
  bytes = 0;
  accepting = true;
  failed: Error | null = null;
  private tail: Promise<void> = Promise.resolve();
  append(
    seq: number,
    bytes: ArrayBuffer,
    write: (data: Buffer, timeout: number) => Promise<void>,
  ) {
    if (!this.accepting || this.failed)
      return Promise.reject(this.failed ?? new Error("Saída encerrada."));
    if (!Number.isSafeInteger(seq) || seq !== this.next)
      return Promise.reject(new Error("Sequência de mídia inválida."));
    let data: Buffer;
    try {
      data = validChunk(bytes);
    } catch (error) {
      return Promise.reject(error);
    }
    if (this.queued + data.length > MAX_BACKLOG) {
      this.failed = new Error("A saída ficou lenta demais. Reinicie a saída.");
      this.accepting = false;
      return Promise.reject(this.failed);
    }
    this.next++;
    this.queued += data.length;
    const deadline = Date.now() + 8000;
    const result = this.tail
      .then(async () => {
        if (this.failed) throw this.failed;
        const timeout = deadline - Date.now();
        if (timeout <= 0)
          throw new Error("A fila de mídia ultrapassou oito segundos.");
        await write(data, timeout);
        this.bytes += data.length;
      })
      .catch((error: unknown) => {
        this.failed =
          error instanceof Error ? error : new Error("Falha na saída.");
        this.accepting = false;
        throw this.failed;
      })
      .finally(() => {
        this.queued -= data.length;
      });
    this.tail = result.catch(() => undefined);
    return result;
  }
  async finish() {
    this.accepting = false;
    await this.tail;
    if (this.failed) throw this.failed;
  }
}
export { OrderedSink };
type Recording = {
  id: string;
  sink: OrderedSink;
  handle: FileHandle;
  partial: string;
  final: string;
  stopping?: boolean;
  finishing?: Promise<{ path: string }>;
};
type Broadcast = {
  id: string;
  sink: OrderedSink;
  child: ChildProcessWithoutNullStreams;
  closed: Promise<number | null>;
  stopping: boolean;
  sending: boolean;
};
export class Outputs {
  private recording: Recording | null = null;
  private broadcast: Broadcast | null = null;
  private recordingStarting = false;
  constructor(
    private ffmpeg: string,
    private emit: (status: OutputStatus) => void,
    private finalizeRecording?: (
      input: string,
      output: string,
    ) => Promise<void>,
  ) {}
  private remux(input: string, output: string): Promise<void> {
    if (this.finalizeRecording) return this.finalizeRecording(input, output);
    // MediaRecorder writes a streaming WebM without a seek index or duration.
    // A copy remux makes the finished recording seekable without re-encoding.
    return new Promise((resolve, reject) => {
      const child = spawn(
        this.ffmpeg,
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-nostdin",
          "-i",
          input,
          "-map",
          "0:v:0",
          "-map",
          "0:a:0?",
          "-c",
          "copy",
          "-f",
          "webm",
          "-y",
          output,
        ],
        { windowsHide: true, shell: false, stdio: "ignore" },
      );
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("A finalização do vídeo excedeu o tempo limite."));
      }, 60000);
      child.once("error", () => {
        clearTimeout(timer);
        reject(new Error("O encoder não iniciou para finalizar o vídeo."));
      });
      child.once("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error("O vídeo parcial não pôde ser finalizado."));
      });
    });
  }
  async startRecording(finalPath: string) {
    if (this.recording || this.recordingStarting)
      throw new Error("Já existe uma gravação em andamento.");
    this.recordingStarting = true;
    try {
      const final = finalPath.toLowerCase().endsWith(".webm")
        ? finalPath
        : `${finalPath}.webm`;
      const partial = `${final.slice(0, -5)}.${randomUUID()}.partial.webm`;
      await mkdir(path.dirname(final), { recursive: true });
      const handle = await open(partial, "wx");
      const recording = {
        id: randomUUID(),
        sink: new OrderedSink(),
        handle,
        partial,
        final,
      };
      this.recording = recording;
      this.emit({ kind: "recording", state: "starting", path: final });
      return { id: recording.id, path: final };
    } finally {
      this.recordingStarting = false;
    }
  }
  appendRecording(id: string, seq: number, bytes: ArrayBuffer) {
    const current = this.recording;
    if (!current || current.id !== id)
      return Promise.reject(new Error("Gravação não encontrada."));
    return current.sink
      .append(seq, bytes, async (data) => {
        let offset = 0;
        while (offset < data.length) {
          const result = await current.handle.write(
            data,
            offset,
            data.length - offset,
          );
          if (!result.bytesWritten)
            throw new Error("Falha ao gravar no disco.");
          offset += result.bytesWritten;
        }
        this.emit({
          kind: "recording",
          state: "sending",
          bytes: current.sink.bytes + data.length,
          path: current.final,
        });
      })
      .catch(() => {
        this.emit({
          kind: "recording",
          state: "error",
          message: "Falha ao gravar. O arquivo parcial foi preservado.",
        });
        throw new Error("Falha ao gravar. O arquivo parcial foi preservado.");
      });
  }
  async stopRecording(id: string) {
    const current = this.recording;
    if (!current || current.id !== id)
      throw new Error("Gravação não encontrada.");
    if (current.finishing) return current.finishing;
    current.stopping = true;
    this.emit({ kind: "recording", state: "stopping" });
    current.finishing = (async () => {
      try {
        await current.sink.finish();
        if (!current.sink.bytes) throw new Error("A gravação ficou vazia.");
        await current.handle.sync();
        await current.handle.close();
        const finalized = `${current.partial}.finalizing.webm`;
        try {
          await this.remux(current.partial, finalized);
          await rename(finalized, current.final);
        } catch (error) {
          await rm(finalized, { force: true }).catch(() => undefined);
          throw error;
        }
        await rm(current.partial, { force: true }).catch(() => undefined);
        this.emit({
          kind: "recording",
          state: "idle",
          path: current.final,
          bytes: current.sink.bytes,
        });
        return { path: current.final };
      } catch {
        await current.handle.close().catch(() => undefined);
        this.emit({
          kind: "recording",
          state: "error",
          path: current.partial,
          message: "Gravação incompleta. O arquivo parcial foi preservado.",
        });
        throw new Error(
          "Gravação incompleta. O arquivo parcial foi preservado.",
        );
      } finally {
        if (this.recording === current) this.recording = null;
      }
    })();
    return current.finishing;
  }
  startBroadcast(destination: string, smoke = false) {
    if (this.broadcast)
      throw new Error("Já existe uma transmissão em andamento.");
    if (!smoke) {
      const split = destination.lastIndexOf("/");
      youtubeDestination(
        destination.slice(split + 1),
        destination.slice(0, split),
      );
    }
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-fflags",
      "+genpts",
      "-i",
      "pipe:0",
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-tune",
      "zerolatency",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "24",
      "-g",
      "48",
      "-b:v",
      "3000k",
      "-maxrate",
      "3000k",
      "-bufsize",
      "6000k",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      "48000",
      "-progress",
      "pipe:1",
      "-stats_period",
      "0.5",
      "-f",
      "flv",
      "-y",
      destination,
    ];
    const child = spawn(this.ffmpeg, args, {
      windowsHide: true,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const closed = new Promise<number | null>((resolve) => {
      child.once("close", resolve);
    });
    const current: Broadcast = {
      id: randomUUID(),
      sink: new OrderedSink(),
      child,
      closed,
      stopping: false,
      sending: false,
    };
    this.broadcast = current;
    const fail = () => {
      if (current.stopping) return;
      current.sink.failed = new Error(
        "O encoder ou a conexão de transmissão falhou.",
      );
      current.sink.accepting = false;
      this.emit({
        kind: "broadcast",
        state: "error",
        message: current.sink.failed.message,
      });
    };
    child.on("error", fail);
    child.stdin.on("error", fail);
    // FFmpeg diagnostics may contain the full ingestion URL; never forward them.
    child.stderr.on("data", () => undefined);
    let progress = "";
    child.stdout.on("data", (data) => {
      progress += data.toString();
      const lines = progress.split("\n");
      progress = lines.pop() ?? "";
      for (const line of lines)
        if (
          /^out_time_us=\d+/.test(line) &&
          Number(line.split("=")[1]) > 0 &&
          !current.sending &&
          !current.stopping
        ) {
          current.sending = true;
          this.emit({
            kind: "broadcast",
            state: "sending",
            message: smoke
              ? "Encoder em ensaio local."
              : "Sinal enviado. Confirme o recebimento no YouTube Studio.",
          });
        }
      if (progress.length > 8192) progress = "";
    });
    child.on("close", () => {
      if (!current.stopping) fail();
    });
    this.emit({ kind: "broadcast", state: "starting" });
    return { id: current.id };
  }
  appendBroadcast(id: string, seq: number, bytes: ArrayBuffer) {
    const current = this.broadcast;
    if (!current || current.id !== id)
      return Promise.reject(new Error("Transmissão não encontrada."));
    return current.sink
      .append(
        seq,
        bytes,
        (data, remainingTime) =>
          new Promise<void>((resolve, reject) => {
            if (current.child.stdin.destroyed) {
              reject(new Error("Encoder encerrado."));
              return;
            }
            const timeout = setTimeout(() => {
              current.child.kill();
              reject(new Error("O encoder não respondeu."));
            }, remainingTime);
            current.child.stdin.write(data, (error) => {
              clearTimeout(timeout);
              if (error) reject(new Error("O encoder não recebeu a mídia."));
              else resolve();
            });
          }),
      )
      .catch(() => {
        current.child.kill();
        this.emit({
          kind: "broadcast",
          state: "error",
          message: "Transmissão interrompida. A gravação é independente.",
        });
        throw new Error("Transmissão interrompida. A gravação é independente.");
      });
  }
  async stopBroadcast(id: string) {
    const current = this.broadcast;
    if (!current || current.id !== id)
      throw new Error("Transmissão não encontrada.");
    if (current.stopping) {
      await current.closed;
      return;
    }
    current.stopping = true;
    this.emit({ kind: "broadcast", state: "stopping" });
    let failed = false;
    try {
      await current.sink.finish();
    } catch {
      failed = true;
    }
    current.child.stdin.end();
    const timer = setTimeout(() => current.child.kill(), 5000);
    const code = await current.closed;
    clearTimeout(timer);
    if (this.broadcast === current) this.broadcast = null;
    this.emit({
      kind: "broadcast",
      state: failed || code !== 0 ? "error" : "idle",
      ...(failed || code !== 0
        ? { message: "Transmissão encerrada com falha." }
        : {}),
    });
  }
  hasBroadcast(id: string) {
    return (
      this.broadcast?.id === id &&
      !this.broadcast.stopping &&
      !this.broadcast.sink.failed
    );
  }
  async close() {
    await Promise.allSettled([
      this.recording
        ? this.stopRecording(this.recording.id)
        : Promise.resolve(),
      this.broadcast
        ? this.stopBroadcast(this.broadcast.id)
        : Promise.resolve(),
    ]);
  }
}
