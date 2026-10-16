import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  safeStorage,
  session,
  shell,
  type IpcMainInvokeEvent,
} from "electron";
import { existsSync } from "node:fs";
import { readFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Outputs, youtubeDestination } from "./outputs";
import { YouTube } from "./youtube";
import {
  applyThumbnail,
  maxThumbnailBytes,
  thumbnailMime,
  thumbnailName,
  type Thumbnail,
} from "./thumbnail";
import type { OutputStatus } from "../src/shared/types";

let window: BrowserWindow;
let selectedScreen: string | null = null;
let outputs: Outputs;
let youtube: YouTube;
let closing = false;
let canClose = false;
let acknowledgeClose: (() => void) | null = null;
let startingBroadcast = false;
let broadcastStartDone: Promise<void> | null = null;
// Cover bytes stay in the main process; the renderer only receives a preview data URL.
let thumbnail: Thumbnail | null = null;
let broadcastSession: {
  id: string;
  broadcastId?: string;
  streamId?: string;
  live: boolean;
  timer?: ReturnType<typeof setTimeout>;
  confirmation?: Promise<void>;
} | null = null;
const devUrl =
  !app.isPackaged && process.env.VITE_DEV_SERVER_URL === "http://127.0.0.1:5173"
    ? process.env.VITE_DEV_SERVER_URL
    : null;
const indexPath = path.join(__dirname, "../dist/index.html");
const appUrl =
  devUrl ?? new URL(`file:///${indexPath.replace(/\\/g, "/")}`).href;
const recordingsDirectory = path.join(app.getPath("videos"), "OBS Reverso");
function trustedUrl(url: string) {
  return url === appUrl || (devUrl ? url === `${devUrl}/` : false);
}
function validateSender(event: IpcMainInvokeEvent) {
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    !trustedUrl(event.senderFrame?.url ?? "")
  )
    throw new Error("Origem não permitida.");
}
function idValue(id: unknown): asserts id is string {
  if (typeof id !== "string" || !/^[\da-f-]{36}$/.test(id))
    throw new Error("Sessão inválida.");
}
function emit(status: OutputStatus) {
  if (window && !window.isDestroyed())
    window.webContents.send("studio:status", status);
}
function handle(name: string, callback: (...args: any[]) => unknown) {
  ipcMain.handle(`studio:${name}`, async (event, ...args) => {
    validateSender(event);
    return callback(...args);
  });
}

function confirmLive(current: NonNullable<typeof broadcastSession>) {
  if (current.confirmation) return current.confirmation;
  const operation = checkLive(current).finally(() => {
    if (current.confirmation === operation) current.confirmation = undefined;
  });
  current.confirmation = operation;
  return operation;
}
async function checkLive(current: NonNullable<typeof broadcastSession>) {
  if (
    broadcastSession !== current ||
    !outputs.hasBroadcast(current.id) ||
    !current.streamId ||
    !current.broadcastId
  )
    return;
  try {
    const active =
      !current.live && (await youtube.ingestActive(current.streamId));
    if (broadcastSession !== current || !outputs.hasBroadcast(current.id))
      return;
    if (active) current.live = await youtube.goLive(current.broadcastId);
    if (broadcastSession !== current) return;
    if (!current.live) current.live = await youtube.isLive(current.broadcastId);
    if (broadcastSession !== current) return;
    if (current.live) {
      emit({
        kind: "broadcast",
        state: "liveConfirmed",
        message: "O YouTube confirmou que você está ao vivo.",
      });
      return;
    }
  } catch {
    if (broadcastSession === current)
      emit({
        kind: "broadcast",
        state: "sending",
        message:
          "Sinal enviado. A confirmação do YouTube ainda não chegou; confira no Studio.",
      });
  }
  if (broadcastSession === current)
    current.timer = setTimeout(() => {
      void confirmLive(current);
    }, 5000);
}
async function stopBroadcast(id: string) {
  idValue(id);
  const current = broadcastSession;
  if (current?.id === id) {
    broadcastSession = null;
    if (current.timer) clearTimeout(current.timer);
  }
  await outputs.stopBroadcast(id);
  if (current?.id === id && current.broadcastId) {
    try {
      // A transition already requested must settle before deciding whether to complete it.
      await current.confirmation;
      if (current.live || (await youtube.isLive(current.broadcastId)))
        await youtube.complete(current.broadcastId);
    } catch {
      const message =
        "Encoder parado. Confira o encerramento da transmissão no YouTube Studio.";
      emit({ kind: "broadcast", state: "error", message });
      throw new Error(message);
    }
  }
}

// A second copy would compete for the camera, the encoder and the OAuth loopback port.
if (!app.requestSingleInstanceLock()) app.exit(0);
app.on("second-instance", () => {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.focus();
});
app.whenReady().then(async () => {
  const ffmpeg = app.isPackaged
    ? path.join(process.resourcesPath, "ffmpeg.exe")
    : path.join(
        app.getAppPath(),
        "node_modules",
        "ffmpeg-static",
        "ffmpeg.exe",
      );
  youtube = new YouTube(path.join(app.getPath("userData"), "credentials"), {
    available: () => safeStorage.isEncryptionAvailable(),
    encrypt: (value) => safeStorage.encryptString(value),
    decrypt: (value) => safeStorage.decryptString(value),
    open: (url) => shell.openExternal(url),
  });
  outputs = new Outputs(ffmpeg, (status) => {
    emit(status);
    if (
      status.kind === "broadcast" &&
      status.state === "sending" &&
      broadcastSession?.broadcastId &&
      !broadcastSession.timer &&
      !broadcastSession.live
    ) {
      const current = broadcastSession;
      current.timer = setTimeout(() => {
        void confirmLive(current);
      }, 2000);
    }
  });
  window = new BrowserWindow({
    title: "OBS Reverso",
    width: 1440,
    height: 940,
    minWidth: 1060,
    minHeight: 720,
    backgroundColor: "#111a18",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!trustedUrl(url)) event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  session.defaultSession.setPermissionCheckHandler(
    (contents, permission, origin, details) =>
      contents === window.webContents &&
      trustedUrl(details?.requestingUrl ?? origin) &&
      ["media", "display-capture"].includes(permission),
  );
  session.defaultSession.setPermissionRequestHandler(
    (contents, permission, callback, details) =>
      callback(
        contents === window.webContents &&
          trustedUrl(details.requestingUrl) &&
          ["media", "display-capture"].includes(permission),
      ),
  );
  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      if (
        !request.frame ||
        request.frame !== window.webContents.mainFrame ||
        !trustedUrl(request.frame.url) ||
        !selectedScreen
      ) {
        callback({});
        return;
      }
      const id = selectedScreen;
      selectedScreen = null;
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen", "window"],
          thumbnailSize: { width: 0, height: 0 },
        });
        const source = sources.find((item) => item.id === id);
        if (!source) callback({});
        else
          callback({
            video: source,
            ...(request.audioRequested ? { audio: "loopback" } : {}),
          });
      } catch {
        callback({});
      }
    },
  );
  handle("info", () => ({
    version: app.getVersion(),
    ffmpeg: existsSync(ffmpeg),
    recordingsDirectory,
  }));
  handle("sources", async () =>
    (
      await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 240, height: 135 },
      })
    ).map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    })),
  );
  handle("choose-screen", async (id: unknown) => {
    if (typeof id !== "string" || id.length > 200)
      throw new Error("Fonte de tela inválida.");
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 0, height: 0 },
    });
    if (!sources.some((source) => source.id === id))
      throw new Error("A janela selecionada não está mais disponível.");
    selectedScreen = id;
  });
  handle("recording-start", async () => {
    if (closing) throw new Error("O aplicativo está encerrando.");
    if (process.env.OBS_REVERSO_SMOKE === "1" && !app.isPackaged)
      return outputs.startRecording(
        path.join(app.getAppPath(), "artifacts", "smoke-recording.webm"),
      );
    await mkdir(recordingsDirectory, { recursive: true });
    const choice = await dialog.showSaveDialog(window, {
      title: "Salvar gravação",
      defaultPath: path.join(
        recordingsDirectory,
        `OBS-Reverso-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`,
      ),
      filters: [{ name: "Vídeo WebM", extensions: ["webm"] }],
    });
    if (choice.canceled || !choice.filePath) return null;
    if (closing) throw new Error("O aplicativo está encerrando.");
    return outputs.startRecording(choice.filePath);
  });
  handle("recording-append", (id: unknown, seq: number, bytes: ArrayBuffer) => {
    idValue(id);
    return outputs.appendRecording(id, seq, bytes);
  });
  handle("recording-stop", (id: unknown) => {
    idValue(id);
    return outputs.stopRecording(id);
  });
  handle("broadcast-start", async (options: unknown) => {
    if (closing) throw new Error("O aplicativo está encerrando.");
    if (startingBroadcast || broadcastSession)
      throw new Error("Uma transmissão já está em andamento.");
    if (!options || typeof options !== "object")
      throw new Error("Revise as opções da transmissão.");
    const { mode, key, title, privacy } = options as Record<string, unknown>;
    if (mode !== "key" && mode !== "oauth")
      throw new Error("Modo de conexão inválido.");
    const cover = mode === "oauth" ? thumbnail : null;
    startingBroadcast = true;
    let finishStart!: () => void;
    broadcastStartDone = new Promise<void>((resolve) => {
      finishStart = resolve;
    });
    let prepared: Awaited<ReturnType<YouTube["prepare"]>> | undefined;
    try {
      if (!existsSync(ffmpeg))
        throw new Error("O encoder FFmpeg não foi encontrado.");
      let destination: string;
      if (process.env.OBS_REVERSO_SMOKE === "1" && !app.isPackaged) {
        const directory = path.join(app.getAppPath(), "artifacts");
        await mkdir(directory, { recursive: true });
        destination = path.join(directory, "smoke-live.flv");
      } else if (mode === "key") destination = youtubeDestination(key);
      else {
        if (
          typeof title !== "string" ||
          !["private", "unlisted", "public"].includes(String(privacy))
        )
          throw new Error("Revise título e privacidade.");
        prepared = await youtube.prepare(
          title,
          privacy as "private" | "unlisted" | "public",
        );
        destination = youtubeDestination(prepared.key, prepared.address);
      }
      if (closing) throw new Error("O aplicativo está encerrando.");
      const result = outputs.startBroadcast(
        destination,
        process.env.OBS_REVERSO_SMOKE === "1" && !app.isPackaged,
      );
      broadcastSession = {
        id: result.id,
        ...(prepared
          ? { broadcastId: prepared.broadcastId, streamId: prepared.streamId }
          : {}),
        live: false,
      };
      if (prepared && cover) {
        const current = broadcastSession;
        // Runs beside the encoder: a refused cover must never stop the live.
        void applyThumbnail(
          youtube,
          prepared.broadcastId,
          cover,
          (ok, message) =>
            emit({ kind: "thumbnail", state: ok ? "idle" : "error", message }),
          () => broadcastSession === current,
        );
      }
      return result;
    } catch (error) {
      if (prepared)
        await youtube
          .discardPrepared(prepared.broadcastId, prepared.streamId)
          .catch(() => {
            emit({
              kind: "broadcast",
              state: "error",
              message:
                "A preparação foi interrompida. Confira a transmissão pendente no YouTube Studio.",
            });
          });
      throw error;
    } finally {
      startingBroadcast = false;
      finishStart();
      broadcastStartDone = null;
    }
  });
  handle("broadcast-append", (id: unknown, seq: number, bytes: ArrayBuffer) => {
    idValue(id);
    return outputs.appendBroadcast(id, seq, bytes);
  });
  handle("broadcast-stop", stopBroadcast);
  handle("youtube-configure", async () => {
    if (startingBroadcast || broadcastSession)
      throw new Error("Encerre a transmissão antes de alterar a conexão.");
    const choice = await dialog.showOpenDialog(window, {
      title: "Credenciais OAuth de aplicativo para computador",
      filters: [{ name: "Credenciais Google", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (choice.canceled || !choice.filePaths[0]) return youtube.status();
    if ((await stat(choice.filePaths[0])).size > 64 * 1024)
      throw new Error("Arquivo de credenciais muito grande.");
    try {
      return await youtube.configure(
        await readFile(choice.filePaths[0], "utf8"),
      );
    } catch {
      throw new Error(
        "Não foi possível importar. Use o JSON OAuth de aplicativo para computador.",
      );
    }
  });
  handle("youtube-connect", () => {
    if (startingBroadcast || broadcastSession)
      throw new Error("Encerre a transmissão antes de alterar a conexão.");
    return youtube.connect();
  });
  handle("youtube-disconnect", () => {
    if (startingBroadcast || broadcastSession)
      throw new Error("Encerre a transmissão antes de desconectar.");
    return youtube.disconnect();
  });
  handle("youtube-status", () => youtube.status());
  handle("thumbnail-choose", async () => {
    if (startingBroadcast || broadcastSession)
      throw new Error("Encerre a transmissão antes de trocar a capa.");
    const choice = await dialog.showOpenDialog(window, {
      title: "Capa da transmissão",
      filters: [
        { name: "Imagem JPG ou PNG", extensions: ["jpg", "jpeg", "png"] },
      ],
      properties: ["openFile"],
    });
    if (choice.canceled || !choice.filePaths[0]) return null;
    const file = choice.filePaths[0];
    if ((await stat(file)).size > maxThumbnailBytes)
      throw new Error("A capa precisa ter até 2 MB.");
    const bytes = await readFile(file);
    const mime = thumbnailMime(bytes);
    if (startingBroadcast || broadcastSession)
      throw new Error("Encerre a transmissão antes de trocar a capa.");
    thumbnail = { name: thumbnailName(file), bytes, mime };
    return {
      name: thumbnail.name,
      preview: `data:${mime};base64,${bytes.toString("base64")}`,
    };
  });
  handle("thumbnail-clear", () => {
    if (startingBroadcast || broadcastSession)
      throw new Error("Encerre a transmissão antes de remover a capa.");
    thumbnail = null;
  });
  handle("finish-close", () => {
    acknowledgeClose?.();
  });
  handle("open-external", async (target: unknown) => {
    if (target === "youtube-studio")
      await shell.openExternal("https://studio.youtube.com/");
    else if (target === "recordings") {
      await mkdir(recordingsDirectory, { recursive: true });
      const error = await shell.openPath(recordingsDirectory);
      if (error)
        throw new Error("Não foi possível abrir a pasta de gravações.");
    } else throw new Error("Destino inválido.");
  });
  window.on("close", (event) => {
    if (canClose) return;
    event.preventDefault();
    if (closing) return;
    closing = true;
    void (async () => {
      emit({
        kind: "recording",
        state: "stopping",
        message: "Encerrando saídas e salvando arquivos.",
      });
      // Final chunks are produced asynchronously by MediaRecorder.stop().
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          acknowledgeClose = null;
          resolve();
        }, 12000);
        acknowledgeClose = () => {
          clearTimeout(timer);
          acknowledgeClose = null;
          resolve();
        };
        window.webContents.send("studio:closing");
      });
      await broadcastStartDone;
      if (broadcastSession)
        await stopBroadcast(broadcastSession.id).catch(() => undefined);
      await outputs.close();
      youtube.cancel();
      canClose = true;
      window.close();
    })();
  });
  if (devUrl) await window.loadURL(devUrl);
  else await window.loadFile(indexPath);
});
app.on("window-all-closed", () => app.quit());
