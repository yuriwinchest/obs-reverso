import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  Camera,
  Mic,
  MicOff,
  MonitorUp,
  Radio,
  Circle,
  Square,
  ChevronRight,
  Check,
  X,
  SlidersHorizontal,
  ImagePlus,
  Link,
  ExternalLink,
  FolderOpen,
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
  Volume2,
  Sparkles,
  VideoOff,
  LoaderCircle,
} from "lucide-react";
import { StudioEngine } from "./engine/StudioEngine";
import { OutputController } from "./engine/OutputController";
import {
  clampFraming,
  containPoint,
  zoomAt,
  type Framing,
} from "./engine/framing";
import {
  defaultConfig,
  emptyMetrics,
  type ProgramConfig,
  type Metrics,
  type YouTubeStatus,
} from "./shared/types";

type Panel = "sources" | "appearance" | "destination";
type Source = { id: string; name: string; thumbnail: string };
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const isBusyState = (state: string) =>
  state === "starting" || state === "stopping";
const centered: Framing = { zoom: 1, x: 0, y: 0 };
const offsetText = (value: number, negative: string, positive: string) =>
  Math.abs(value) < 0.005
    ? "Centro"
    : `${Math.round(Math.abs(value) * 100)}% ${value < 0 ? negative : positive}`;

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<StudioEngine | null>(null);
  const recording = useRef<OutputController | null>(null);
  const broadcast = useRef<OutputController | null>(null);
  const imageUrl = useRef("");
  const operationLock = useRef(new Set<string>());
  const comparisonActive = useRef(false);
  const [config, setConfig] = useState<ProgramConfig>(defaultConfig);
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [panel, setPanel] = useState<Panel>("sources");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [micId, setMicId] = useState("");
  const [busy, setBusy] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recordState, setRecordState] = useState("idle");
  const [broadcastState, setBroadcastState] = useState("idle");
  const [youtube, setYoutube] = useState<YouTubeStatus>({
    connected: false,
    configured: false,
  });
  const [mode, setMode] = useState<"key" | "oauth">("oauth");
  const [streamKey, setStreamKey] = useState("");
  const [liveTitle, setLiveTitle] = useState("");
  const [privacy, setPrivacy] = useState<"private" | "unlisted" | "public">(
    "private",
  );
  const [screenSources, setScreenSources] = useState<Source[] | null>(null);
  const [confirm, setConfirm] = useState<"start" | "stop" | null>(null);
  const [info, setInfo] = useState<{
    version: string;
    ffmpeg: boolean;
    recordingsDirectory: string;
  } | null>(null);
  const [recordedPath, setRecordedPath] = useState("");
  const [comparing, setComparing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogReturnFocus = useRef<HTMLElement | null>(null);

  async function refreshDevices() {
    setDevices(await navigator.mediaDevices.enumerateDevices());
  }
  useEffect(() => {
    const instance = new StudioEngine(canvas.current!, setMetrics, setError);
    engine.current = instance;
    recording.current = new OutputController(
      "recording",
      setRecordState,
      setError,
    );
    broadcast.current = new OutputController(
      "broadcast",
      setBroadcastState,
      setError,
    );
    refreshDevices().catch((e) => setError(message(e)));
    let alive = true;
    if (window.studio) {
      window.studio
        .info()
        .then((v) => {
          if (alive) setInfo(v);
        })
        .catch((e) => {
          if (alive) setError(message(e));
        });
      window.studio
        .youtubeStatus()
        .then((v) => {
          if (alive) setYoutube(v);
        })
        .catch((e) => {
          if (alive) setError(message(e));
        });
    } else
      setError(
        "A integração do aplicativo não está disponível. Abra o OBS Reverso pelo iniciador do Windows.",
      );
    const unsubscribe = window.studio?.onStatus((status) => {
      if (status.kind === "recording" && status.path)
        setRecordedPath(status.path);
      if (status.kind === "broadcast") setBroadcastState(status.state);
      if (status.kind === "recording" && status.state === "error")
        setRecordState("error");
      if (status.state === "error")
        setError(
          status.message ||
            "A saída foi interrompida. Confira o destino e tente novamente.",
        );
    });
    const unsubscribeClosing = window.studio?.onClosing(() => {
      void (async () => {
        await Promise.allSettled([
          recording.current?.stop(),
          broadcast.current?.stop(),
        ]);
        instance.destroy();
        await window.studio.finishClose();
      })().catch((e) => setError(message(e)));
    });
    const changed = () => {
      refreshDevices().catch((e) => setError(message(e)));
    };
    navigator.mediaDevices.addEventListener("devicechange", changed);
    return () => {
      alive = false;
      unsubscribe?.();
      unsubscribeClosing?.();
      navigator.mediaDevices.removeEventListener("devicechange", changed);
      instance.destroy();
      engine.current = null;
    };
  }, []);

  const modalOpen = screenSources !== null || confirm !== null;
  useEffect(() => {
    if (!modalOpen) return;
    dialogReturnFocus.current = document.activeElement as HTMLElement;
    requestAnimationFrame(() =>
      dialogRef.current
        ?.querySelector<HTMLElement>("button,input,select")
        ?.focus(),
    );
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && operationLock.current.size === 0) {
        setScreenSources(null);
        setConfirm(null);
      }
      if (event.key !== "Tab") return;
      const nodes = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ) || [],
      );
      if (!nodes.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) {
        event.preventDefault();
        nodes[nodes.length - 1].focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === nodes[nodes.length - 1]
      ) {
        event.preventDefault();
        nodes[0].focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      dialogReturnFocus.current?.focus();
    };
  }, [modalOpen]);
  useEffect(
    () => () => {
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    },
    [],
  );

  const update = (partial: Partial<ProgramConfig>) => {
    setConfig((previous) => ({ ...previous, ...partial }));
    engine.current?.update(partial);
  };
  // Latest framing, ahead of React state while a drag or wheel is coalesced.
  const framing = useRef<Framing>({
    zoom: defaultConfig.cameraZoom,
    x: defaultConfig.cameraX,
    y: defaultConfig.cameraY,
  });
  const framingFrame = useRef(0);
  const framingDrag = useRef<{
    pointer: number;
    clientX: number;
    clientY: number;
    start: Framing;
  } | null>(null);
  const framingEnabled = useRef(false);
  const [dragging, setDragging] = useState(false);
  const setFraming = (next: Framing, immediate = false) => {
    framing.current = clampFraming(next);
    const commit = () => {
      framingFrame.current = 0;
      const { zoom, x, y } = framing.current;
      update({ cameraZoom: zoom, cameraX: x, cameraY: y });
    };
    if (immediate) {
      cancelAnimationFrame(framingFrame.current);
      commit();
    } else if (!framingFrame.current)
      framingFrame.current = requestAnimationFrame(commit);
  };
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    // Native listener: React registers wheel as passive, so it cannot stop
    // the panel from scrolling while zooming.
    const onWheel = (event: WheelEvent) => {
      if (!framingEnabled.current) return;
      event.preventDefault();
      const point = containPoint(
        event.clientX,
        event.clientY,
        node.getBoundingClientRect(),
        node.width,
        node.height,
      );
      const current = framing.current;
      setFraming(
        zoomAt(
          current,
          current.zoom * Math.exp(-event.deltaY * 0.0015),
          point.x,
          point.y,
          node.width,
          node.height,
        ),
      );
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(framingFrame.current);
    };
  }, []);
  async function run(name: string, task: () => Promise<unknown>) {
    if (operationLock.current.has(name)) return;
    operationLock.current.add(name);
    setBusy(Array.from(operationLock.current));
    setError("");
    try {
      await task();
    } catch (e) {
      setError(message(e));
    } finally {
      operationLock.current.delete(name);
      setBusy(Array.from(operationLock.current));
    }
  }
  const cameraToggle = () =>
    run("camera", async () => {
      if (metrics.camera) engine.current?.stopCamera();
      else await engine.current?.startCamera(cameraId || undefined);
      await refreshDevices();
    });
  const micToggle = () =>
    run("mic", async () => {
      if (metrics.microphone) engine.current?.stopMic();
      else await engine.current?.startMic(micId || undefined);
      await refreshDevices();
    });
  const screenToggle = () =>
    run("screen", async () => {
      if (metrics.screen) {
        engine.current?.stopScreen();
        return;
      }
      const sources = await window.studio.sources();
      if (!sources.length)
        throw new Error(
          "Nenhuma tela ou janela está disponível para compartilhar.",
        );
      setScreenSources(sources);
    });
  const chooseScreen = (id: string) =>
    run("screen", async () => {
      await window.studio.chooseScreen(id);
      await engine.current?.startScreen();
      setScreenSources(null);
    });
  const recordToggle = () =>
    run("record", async () => {
      if (!recording.current || !engine.current) return;
      if (recording.current.active) {
        await recording.current.stop();
        setNotice("Gravação encerrada. Abra a pasta para conferir o arquivo.");
      } else {
        setRecordedPath("");
        if (await recording.current.start(engine.current.getStream()))
          setNotice(
            "Gravação iniciada. O arquivo está sendo salvo neste computador.",
          );
      }
    });
  const startLive = () =>
    run("broadcast", async () => {
      if (!broadcast.current || !engine.current) return;
      const started = await broadcast.current.start(
        engine.current.getStream(),
        {
          mode,
          key: mode === "key" ? streamKey : undefined,
          title: liveTitle.trim(),
          privacy,
        },
      );
      if (started) {
        setConfirm(null);
        setNotice(
          mode === "key"
            ? "Vídeo sendo enviado. Confira a transmissão no YouTube Studio."
            : "Saída iniciada. Aguarde a confirmação do YouTube.",
        );
      }
    });
  const stopLive = () =>
    run("broadcast", async () => {
      await broadcast.current?.stop();
      setConfirm(null);
      setNotice("Transmissão encerrada.");
    });
  const youtubeAction = (action: "configure" | "connect" | "disconnect") =>
    run("youtube", async () => {
      if (action === "configure")
        setYoutube(await window.studio.youtubeConfigure());
      if (action === "connect")
        setYoutube(await window.studio.youtubeConnect());
      if (action === "disconnect") {
        await window.studio.youtubeDisconnect();
        setYoutube(await window.studio.youtubeStatus());
      }
    });
  const recordingActive = ["sending", "recording", "liveConfirmed"].includes(
    recordState,
  );
  const liveActive = ["sending", "liveConfirmed", "live"].includes(
    broadcastState,
  );
  const livePending = isBusyState(broadcastState) || busy.includes("broadcast");
  const liveLabel =
    broadcastState === "liveConfirmed"
      ? "Ao vivo · YouTube confirmado"
      : liveActive
        ? mode === "key"
          ? "Enviando · confira YouTube Studio"
          : "Enviando · aguardando YouTube"
        : broadcastState === "error"
          ? "Falha na transmissão"
          : "Fora do ar";
  const canBroadcast =
    info?.ffmpeg === true &&
    (mode === "key"
      ? streamKey.trim().length > 0
      : youtube.connected && liveTitle.trim().length > 0);
  const segmentationLabel = {
    off: "Fundo original",
    loading: "Preparando IA local…",
    ready: "IA local ativa",
    error: "Falha no fundo virtual",
  }[metrics.segmentation];
  const canFrame = metrics.camera && !metrics.screen;
  framingEnabled.current = canFrame;
  const isCentered =
    config.cameraZoom === 1 && config.cameraX === 0 && config.cameraY === 0;
  const endDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (framingDrag.current?.pointer !== event.pointerId) return;
    framingDrag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const compareOriginal = () => {
    if (recording.current?.active || broadcast.current?.active) return;
    comparisonActive.current = true;
    setComparing(true);
    engine.current?.update({ background: "original" });
  };
  const restoreBackground = () => {
    if (!comparisonActive.current) return;
    comparisonActive.current = false;
    setComparing(false);
    engine.current?.update({ background: config.background });
  };

  return (
    <div className="studio-app">
      <header className="app-header">
        <a className="brand" href="#studio" aria-label="OBS Reverso, estúdio">
          <span className="brand-symbol">
            <Radio size={22} />
          </span>
          <span>
            OBS <b>Reverso</b>
            <small>SEU ESTÚDIO. DIRETO AO PONTO.</small>
          </span>
        </a>
        <div className="header-state" aria-live="polite">
          <span className={`status-dot ${liveActive ? "live" : ""}`} />
          {liveLabel}
        </div>
        <span className="version">
          ESTÚDIO LOCAL <span>{info ? `v${info.version}` : "—"}</span>
        </span>
      </header>

      <main id="studio" className="workspace">
        <section className="stage-column" aria-label="Composição do vídeo">
          <h1 className="sr-only">Estúdio OBS Reverso</h1>
          <div className="preview-shell">
            <div className="preview-toolbar">
              <span>
                <span
                  className={`status-dot ${metrics.camera || metrics.screen ? "ready" : ""}`}
                />
                {metrics.screen
                  ? "Tela + composição"
                  : metrics.camera
                    ? "Câmera + composição"
                    : "Sua composição"}
              </span>
              <span>
                16:9 <span className="toolbar-divider">/</span> 720p
              </span>
            </div>
            <canvas
              ref={canvas}
              width={1280}
              height={720}
              aria-label="Prévia da composição final de vídeo"
              className={`program-canvas${canFrame ? " framable" : ""}${dragging ? " dragging" : ""}`}
              title={
                canFrame
                  ? "Arraste para mover a câmera; roda do mouse aumenta ou diminui"
                  : undefined
              }
              onPointerDown={(event) => {
                if (!canFrame || event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                framingDrag.current = {
                  pointer: event.pointerId,
                  clientX: event.clientX,
                  clientY: event.clientY,
                  start: framing.current,
                };
                setDragging(true);
              }}
              onPointerMove={(event) => {
                const drag = framingDrag.current;
                if (drag?.pointer !== event.pointerId) return;
                const node = event.currentTarget;
                const { scale } = containPoint(
                  0,
                  0,
                  node.getBoundingClientRect(),
                  node.width,
                  node.height,
                );
                setFraming({
                  zoom: drag.start.zoom,
                  x:
                    drag.start.x +
                    ((event.clientX - drag.clientX) * scale) / node.width,
                  y:
                    drag.start.y +
                    ((event.clientY - drag.clientY) * scale) / node.height,
                });
              }}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onDoubleClick={() => {
                if (canFrame) setFraming(centered, true);
              }}
            />
            {!metrics.camera &&
              !metrics.screen &&
              !recordingActive &&
              !liveActive && (
                <div className="preview-idle">
                  <span className="idle-mark">
                    <Camera size={30} strokeWidth={1.4} />
                  </span>
                  <h2>O palco é seu.</h2>
                  <p>
                    Ative a câmera ou compartilhe uma tela.
                    <br />
                    Sua composição aparece aqui.
                  </p>
                  <button
                    className="button primary"
                    onClick={cameraToggle}
                    disabled={busy.includes("camera")}
                  >
                    {busy.includes("camera") ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <Camera size={16} />
                    )}
                    Ativar minha câmera
                  </button>
                </div>
              )}
            <div className="preview-bottom">
              <span className="preview-label">
                PRÉVIA DA SAÍDA
                {recordingActive && <b className="rec-indicator">● GRAVANDO</b>}
                {liveActive && <b className="live-indicator">● ENVIANDO</b>}
              </span>
              <span className="stage-info">
                <span
                  className={
                    metrics.segmentation === "error" ? "text-danger" : ""
                  }
                >
                  <span
                    className={`status-dot ${metrics.segmentation === "ready" ? "ready" : ""}`}
                  />
                  {segmentationLabel}
                </span>
                <span className="performance">
                  {metrics.fps > 0
                    ? `${Math.round(metrics.fps)} fps`
                    : "Aguardando vídeo"}
                  {metrics.segmentation === "ready" &&
                    ` · máscara ${Math.round(metrics.maskFps)} fps`}
                </span>
              </span>
            </div>
          </div>

          <div className="stage-dock">
            <div className="layout-actions" aria-label="Apresentação">
              <button
                className={`layout-option ${!metrics.screen ? "selected" : ""}`}
                onClick={() => {
                  if (metrics.screen) engine.current?.stopScreen();
                  if (!metrics.camera) cameraToggle();
                }}
                disabled={busy.includes("camera")}
              >
                <Camera size={17} /> Só câmera
                {!metrics.screen && <Check size={14} />}
              </button>
              <button
                className={`layout-option ${metrics.screen ? "selected" : ""}`}
                onClick={screenToggle}
                disabled={busy.includes("screen")}
              >
                <MonitorUp size={17} />
                {metrics.screen
                  ? "Parar de compartilhar"
                  : "Mostrar minha tela"}
                {metrics.screen && <Check size={14} />}
              </button>
            </div>
            <div className="readiness">
              <div>
                <span
                  className={`check-icon ${metrics.camera || metrics.screen ? "checked" : ""}`}
                >
                  <Check size={13} />
                </span>
                <span>
                  {metrics.camera || metrics.screen
                    ? "Vídeo pronto"
                    : "Ative uma fonte de vídeo"}
                </span>
              </div>
              <div>
                <span
                  className={`check-icon ${metrics.microphone && !config.muted ? "checked" : ""}`}
                >
                  <Check size={13} />
                </span>
                <span>
                  {metrics.microphone
                    ? config.muted
                      ? "Microfone silenciado"
                      : "Microfone conectado"
                    : "Microfone desativado"}
                </span>
              </div>
              <button onClick={() => setPanel("destination")}>
                Conferir destino <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
          {metrics.microphone && !config.muted && metrics.micLevel < 0.005 && (
            <p className="quiet-hint">
              <Volume2 size={14} /> Faça um teste de voz e confira o medidor
              antes de começar.
            </p>
          )}
        </section>

        <aside className="control-panel" aria-label="Controles do estúdio">
          <div className="panel-top">
            <span className="eyebrow">MONTE DO SEU JEITO</span>
            <SlidersHorizontal size={17} />
          </div>
          <nav className="panel-tabs" aria-label="Configuração">
            <button
              aria-current={panel === "sources" ? "page" : undefined}
              onClick={() => setPanel("sources")}
            >
              Fontes
            </button>
            <button
              aria-current={panel === "appearance" ? "page" : undefined}
              onClick={() => setPanel("appearance")}
            >
              Aparência
            </button>
            <button
              aria-current={panel === "destination" ? "page" : undefined}
              onClick={() => setPanel("destination")}
            >
              Destino
            </button>
          </nav>
          <div className="panel-content">
            {panel === "sources" && (
              <>
                <div className="panel-title">
                  <h2>O que você vai mostrar?</h2>
                  <p>Câmera, som e tela. Tudo aqui.</p>
                </div>
                <div className="control-group">
                  <div className="control-heading">
                    <Camera size={17} />
                    <h3>Câmera</h3>
                    <span
                      className={`mini-status ${metrics.camera ? "on" : ""}`}
                    >
                      {metrics.camera ? "Ativa" : "Desligada"}
                    </span>
                  </div>
                  <label className="field-label" htmlFor="camera">
                    Dispositivo
                  </label>
                  <select
                    id="camera"
                    value={cameraId}
                    disabled={busy.includes("camera")}
                    onChange={(event) => {
                      setCameraId(event.target.value);
                      if (metrics.camera)
                        run("camera", async () => {
                          await engine.current?.startCamera(
                            event.target.value || undefined,
                          );
                        });
                    }}
                  >
                    <option value="">Câmera padrão</option>
                    {devices
                      .filter((d) => d.kind === "videoinput")
                      .map((device, index) => (
                        <option
                          key={device.deviceId || index}
                          value={device.deviceId}
                        >
                          {device.label || `Câmera ${index + 1}`}
                        </option>
                      ))}
                  </select>
                  <div className="row-between">
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={config.mirror}
                        onChange={(e) => update({ mirror: e.target.checked })}
                      />{" "}
                      Espelhar câmera
                    </label>
                    <button
                      className="text-button"
                      disabled={busy.includes("camera")}
                      onClick={cameraToggle}
                    >
                      {metrics.camera ? "Desligar" : "Ativar"}
                    </button>
                  </div>
                  <div
                    className="framing-controls"
                    role="group"
                    aria-labelledby="framing-title"
                  >
                    <div className="row-between">
                      <span className="field-label" id="framing-title">
                        Enquadramento
                      </span>
                      <button
                        className="text-button"
                        disabled={isCentered}
                        onClick={() => setFraming(centered, true)}
                      >
                        Centralizar
                      </button>
                    </div>
                    <label className="range-label" htmlFor="camera-zoom">
                      Tamanho{" "}
                      <span>{Math.round(config.cameraZoom * 100)}%</span>
                    </label>
                    <input
                      id="camera-zoom"
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.01"
                      value={config.cameraZoom}
                      aria-valuetext={`${Math.round(config.cameraZoom * 100)}%`}
                      onChange={(e) =>
                        setFraming(
                          { ...framing.current, zoom: Number(e.target.value) },
                          true,
                        )
                      }
                    />
                    <label className="range-label" htmlFor="camera-x">
                      Horizontal{" "}
                      <span>
                        {offsetText(config.cameraX, "à esquerda", "à direita")}
                      </span>
                    </label>
                    <input
                      id="camera-x"
                      type="range"
                      min="-0.5"
                      max="0.5"
                      step="0.01"
                      value={config.cameraX}
                      aria-valuetext={offsetText(
                        config.cameraX,
                        "à esquerda",
                        "à direita",
                      )}
                      onChange={(e) =>
                        setFraming(
                          { ...framing.current, x: Number(e.target.value) },
                          true,
                        )
                      }
                    />
                    <label className="range-label" htmlFor="camera-y">
                      Vertical{" "}
                      <span>
                        {offsetText(config.cameraY, "acima", "abaixo")}
                      </span>
                    </label>
                    <input
                      id="camera-y"
                      type="range"
                      min="-0.5"
                      max="0.5"
                      step="0.01"
                      value={config.cameraY}
                      aria-valuetext={offsetText(
                        config.cameraY,
                        "acima",
                        "abaixo",
                      )}
                      onChange={(e) =>
                        setFraming(
                          { ...framing.current, y: Number(e.target.value) },
                          true,
                        )
                      }
                    />
                    <p className="field-help">
                      {metrics.screen
                        ? "Com a tela compartilhada, o enquadramento vale dentro do quadrinho da câmera."
                        : "Na prévia: arraste para mover, use a roda do mouse para aumentar ou diminuir e dê dois cliques para centralizar."}
                    </p>
                  </div>
                </div>
                <div className="control-group">
                  <div className="control-heading">
                    <Mic size={17} />
                    <h3>Microfone</h3>
                    <span
                      className={`mini-status ${metrics.microphone ? "on" : ""}`}
                    >
                      {metrics.microphone ? "Conectado" : "Desligado"}
                    </span>
                  </div>
                  <label className="field-label" htmlFor="microphone">
                    Dispositivo
                  </label>
                  <select
                    id="microphone"
                    value={micId}
                    disabled={busy.includes("mic")}
                    onChange={(event) => {
                      setMicId(event.target.value);
                      if (metrics.microphone)
                        run("mic", async () => {
                          await engine.current?.startMic(
                            event.target.value || undefined,
                          );
                        });
                    }}
                  >
                    <option value="">Microfone padrão</option>
                    {devices
                      .filter((d) => d.kind === "audioinput")
                      .map((device, index) => (
                        <option
                          key={device.deviceId || index}
                          value={device.deviceId}
                        >
                          {device.label || `Microfone ${index + 1}`}
                        </option>
                      ))}
                  </select>
                  <div
                    className="audio-meter"
                    role="meter"
                    aria-label="Nível do microfone"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(
                      Math.min(1, metrics.micLevel) * 100,
                    )}
                  >
                    <span
                      style={{
                        width: `${Math.min(100, metrics.micLevel * 220)}%`,
                      }}
                    />
                  </div>
                  <div className="row-between">
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={config.muted}
                        onChange={(e) => update({ muted: e.target.checked })}
                      />{" "}
                      Silenciar
                    </label>
                    <button
                      className="text-button"
                      disabled={busy.includes("mic")}
                      onClick={micToggle}
                    >
                      {metrics.microphone ? "Desconectar" : "Ativar microfone"}
                    </button>
                  </div>
                  <label className="range-label" htmlFor="mic-gain">
                    Volume <span>{Math.round(config.micGain * 100)}%</span>
                  </label>
                  <input
                    id="mic-gain"
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={config.micGain}
                    onChange={(e) =>
                      update({ micGain: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="control-group">
                  <div className="control-heading">
                    <MonitorUp size={17} />
                    <h3>Compartilhamento</h3>
                  </div>
                  <p className="muted-copy">
                    Escolha uma tela ou janela. Sua câmera pode aparecer no
                    canto.
                  </p>
                  <button
                    className="button secondary full"
                    onClick={screenToggle}
                    disabled={busy.includes("screen")}
                  >
                    <MonitorUp size={16} />
                    {metrics.screen
                      ? "Parar compartilhamento"
                      : "Escolher tela ou janela"}
                  </button>
                  {metrics.screen && (
                    <>
                      <label className="range-label" htmlFor="desktop-gain">
                        Áudio da tela{" "}
                        <span>{Math.round(config.desktopGain * 100)}%</span>
                      </label>
                      <input
                        id="desktop-gain"
                        type="range"
                        min="0"
                        max="1.5"
                        step="0.05"
                        value={config.desktopGain}
                        onChange={(e) =>
                          update({ desktopGain: Number(e.target.value) })
                        }
                      />
                      <p className="field-help">
                        O áudio depende da fonte compartilhada e da
                        disponibilidade no Windows.
                      </p>
                      <div className="row-between">
                        <span className="field-label">Câmera no canto</span>
                        <div className="segmented">
                          <button
                            aria-pressed={config.pipPosition === "left"}
                            onClick={() => update({ pipPosition: "left" })}
                          >
                            Esquerda
                          </button>
                          <button
                            aria-pressed={config.pipPosition === "right"}
                            onClick={() => update({ pipPosition: "right" })}
                          >
                            Direita
                          </button>
                        </div>
                      </div>
                      <label className="range-label" htmlFor="pip-size">
                        Tamanho da câmera{" "}
                        <span>{Math.round(config.pipSize * 100)}%</span>
                      </label>
                      <input
                        id="pip-size"
                        type="range"
                        min="0.15"
                        max="0.4"
                        step="0.01"
                        value={config.pipSize}
                        onChange={(e) =>
                          update({ pipSize: Number(e.target.value) })
                        }
                      />
                    </>
                  )}
                </div>
              </>
            )}
            {panel === "appearance" && (
              <>
                <div className="panel-title">
                  <h2>Seu espaço, sua cara.</h2>
                  <p>Troque o fundo. Sem tela verde.</p>
                </div>
                <div className="control-group">
                  <div className="control-heading">
                    <Sparkles size={17} />
                    <h3>Fundo da câmera</h3>
                  </div>
                  <div className="background-options">
                    {(
                      [
                        {
                          id: "original",
                          label: "Original",
                          cls: "original-swatch",
                        },
                        { id: "blur", label: "Desfoque", cls: "blur-swatch" },
                        { id: "color", label: "Cor", cls: "color-swatch" },
                        {
                          id: "image",
                          label: "Sua imagem",
                          cls: "image-swatch",
                        },
                        {
                          id: "motion",
                          label: "Dinâmico",
                          cls: "motion-swatch",
                        },
                      ] as const
                    ).map((bg) => (
                      <button
                        key={bg.id}
                        className={`background-option ${config.background === bg.id ? "selected" : ""}`}
                        aria-pressed={config.background === bg.id}
                        onClick={() => update({ background: bg.id })}
                      >
                        <span
                          className={`background-swatch ${bg.cls}`}
                          style={
                            bg.id === "color"
                              ? { background: config.color }
                              : bg.id === "image" && config.imageUrl
                                ? {
                                    backgroundImage: `url("${config.imageUrl}")`,
                                  }
                                : undefined
                          }
                        >
                          {bg.id === "image" && !config.imageUrl && (
                            <ImagePlus size={21} />
                          )}
                          {config.background === bg.id && (
                            <span className="swatch-check">
                              <Check size={12} />
                            </span>
                          )}
                        </span>
                        {bg.label}
                      </button>
                    ))}
                  </div>
                  {config.background === "color" && (
                    <label className="color-picker">
                      Cor do fundo
                      <input
                        aria-label="Cor do fundo"
                        type="color"
                        value={config.color}
                        onChange={(e) => update({ color: e.target.value })}
                      />
                      <span>{config.color.toUpperCase()}</span>
                    </label>
                  )}
                  {config.background === "image" && (
                    <label className="upload-button">
                      <ImagePlus size={16} />
                      {config.imageUrl
                        ? "Trocar imagem"
                        : "Escolher imagem do computador"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 25 * 1024 * 1024) {
                            setError("Escolha uma imagem com até 25 MB.");
                            return;
                          }
                          const next = URL.createObjectURL(file);
                          if (imageUrl.current)
                            URL.revokeObjectURL(imageUrl.current);
                          imageUrl.current = next;
                          update({ imageUrl: next, background: "image" });
                        }}
                      />
                    </label>
                  )}
                  {config.background === "blur" && (
                    <>
                      <label className="range-label" htmlFor="blur">
                        Intensidade do desfoque{" "}
                        <span>
                          {config.blur < 10
                            ? "Suave"
                            : config.blur < 19
                              ? "Média"
                              : "Forte"}
                        </span>
                      </label>
                      <input
                        id="blur"
                        type="range"
                        min="4"
                        max="26"
                        step="1"
                        value={config.blur}
                        onChange={(e) =>
                          update({ blur: Number(e.target.value) })
                        }
                      />
                    </>
                  )}
                  {config.background === "motion" && (
                    <>
                      <label className="field-label" htmlFor="motion">
                        Ambiente em movimento
                      </label>
                      <select
                        id="motion"
                        value={config.motion}
                        onChange={(e) =>
                          update({
                            motion: e.target.value as ProgramConfig["motion"],
                          })
                        }
                      >
                        <option value="aurora">Aurora · verde e luz</option>
                        <option value="studio">Estúdio · linhas sutis</option>
                        <option value="sunset">Horizonte · tons quentes</option>
                      </select>
                    </>
                  )}
                  {metrics.camera && config.background !== "original" && (
                    <>
                      <button
                        className="button secondary full compare-button"
                        disabled={
                          recordingActive ||
                          liveActive ||
                          livePending ||
                          isBusyState(recordState)
                        }
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          compareOriginal();
                        }}
                        onPointerUp={restoreBackground}
                        onPointerCancel={restoreBackground}
                        onLostPointerCapture={restoreBackground}
                        onBlur={restoreBackground}
                        onKeyDown={(e) => {
                          if (
                            (e.key === " " || e.key === "Enter") &&
                            !e.repeat
                          ) {
                            e.preventDefault();
                            compareOriginal();
                          }
                        }}
                        onKeyUp={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            restoreBackground();
                          }
                        }}
                      >
                        {comparing
                          ? "Solte para voltar ao seu fundo"
                          : "Segure para comparar com o original"}
                      </button>
                      <p className="field-help">
                        Comparação disponível antes de gravar ou transmitir.
                      </p>
                    </>
                  )}
                  <p className="field-help">
                    {config.background === "original"
                      ? "Sua câmera aparece com o ambiente original."
                      : "A IA roda neste computador. Boa iluminação e contraste ajudam a definir o contorno."}
                  </p>
                  {metrics.segmentation === "loading" && (
                    <p className="inline-status">
                      <LoaderCircle size={14} className="spin" /> Preparando o
                      modelo local…
                    </p>
                  )}
                  {metrics.segmentation === "error" && (
                    <button
                      className="text-button"
                      onClick={() => {
                        update({ background: "original" });
                        setNotice(
                          "Fundo original selecionado. Você pode tentar o fundo virtual novamente.",
                        );
                      }}
                    >
                      Voltar ao fundo original
                    </button>
                  )}
                </div>
                <div className="control-group">
                  <div className="control-heading">
                    <span className="type-icon">T</span>
                    <h3>Seu nome no vídeo</h3>
                  </div>
                  <label className="field-label" htmlFor="lower-title">
                    Nome ou título
                  </label>
                  <input
                    id="lower-title"
                    value={config.title}
                    maxLength={70}
                    placeholder="Ex.: Yuri Winchester"
                    onChange={(e) => update({ title: e.target.value })}
                  />
                  <label className="field-label" htmlFor="subtitle">
                    Complemento
                  </label>
                  <input
                    id="subtitle"
                    value={config.subtitle}
                    maxLength={100}
                    placeholder="Ex.: Tecnologia sem complicar"
                    onChange={(e) => update({ subtitle: e.target.value })}
                  />
                  <p className="field-help">
                    Aparece na composição. Deixe vazio para remover.
                  </p>
                </div>
                <div className="tip-card">
                  <span>UM TOQUE DE ESTÚDIO</span>
                  <p>
                    Olhe para a câmera, ilumine o rosto e deixe um pouco de
                    espaço acima da cabeça.
                  </p>
                </div>
              </>
            )}
            {panel === "destination" && (
              <>
                <div className="panel-title">
                  <h2>Próxima parada: YouTube.</h2>
                  <p>Conecte, confira e entre ao vivo.</p>
                </div>
                <div className="connection-mode segmented">
                  <button
                    aria-pressed={mode === "oauth"}
                    disabled={liveActive || livePending}
                    onClick={() => setMode("oauth")}
                  >
                    Conta YouTube
                  </button>
                  <button
                    aria-pressed={mode === "key"}
                    disabled={liveActive || livePending}
                    onClick={() => setMode("key")}
                  >
                    Chave de transmissão
                  </button>
                </div>
                {mode === "oauth" ? (
                  <div className="control-group">
                    <div className="control-heading">
                      <Link size={17} />
                      <h3>Sua conta</h3>
                      <span
                        className={`mini-status ${youtube.connected ? "on" : ""}`}
                      >
                        {youtube.connected ? "Conectada" : "Não conectada"}
                      </span>
                    </div>
                    {youtube.connected ? (
                      <>
                        <div className="channel-card">
                          <span className="channel-icon">
                            <Radio size={20} />
                          </span>
                          <div>
                            <strong>
                              {youtube.channel || "Canal conectado"}
                            </strong>
                            <span>Autorização salva neste Windows</span>
                          </div>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => youtubeAction("disconnect")}
                          disabled={
                            busy.includes("youtube") ||
                            liveActive ||
                            livePending
                          }
                        >
                          Desconectar conta
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="muted-copy">
                          Autorize seu canal pelo navegador. A primeira conexão
                          precisa de credenciais OAuth do Google.
                        </p>
                        <button
                          className="button secondary full"
                          onClick={() =>
                            youtubeAction(
                              youtube.configured ? "connect" : "configure",
                            )
                          }
                          disabled={busy.includes("youtube")}
                        >
                          {busy.includes("youtube") ? (
                            <LoaderCircle size={16} className="spin" />
                          ) : (
                            <Link size={16} />
                          )}
                          {youtube.configured
                            ? "Conectar meu YouTube"
                            : "Configurar conexão Google"}
                        </button>
                        {!youtube.configured && (
                          <p className="field-help">
                            Selecione o arquivo JSON de cliente OAuth para
                            aplicativo desktop, obtido no Google Cloud. Ele
                            permanece neste computador.
                          </p>
                        )}
                        {youtube.configured && (
                          <button
                            className="text-button"
                            disabled={busy.includes("youtube")}
                            onClick={() => youtubeAction("configure")}
                          >
                            Trocar configuração OAuth
                          </button>
                        )}
                      </>
                    )}
                    <label className="field-label" htmlFor="live-title">
                      Título da transmissão
                    </label>
                    <input
                      id="live-title"
                      maxLength={100}
                      value={liveTitle}
                      disabled={liveActive || livePending}
                      onChange={(e) => setLiveTitle(e.target.value)}
                      placeholder="Sobre o que vamos conversar?"
                    />
                    <label className="field-label" htmlFor="privacy">
                      Visibilidade
                    </label>
                    <select
                      id="privacy"
                      value={privacy}
                      disabled={liveActive || livePending}
                      onChange={(e) =>
                        setPrivacy(e.target.value as typeof privacy)
                      }
                    >
                      <option value="unlisted">
                        Não listada · só quem tem o link
                      </option>
                      <option value="private">Privada · teste reservado</option>
                      <option value="public">
                        Pública · disponível no canal
                      </option>
                    </select>
                    <p className="field-help">
                      O canal precisa ter a transmissão ao vivo ativada no
                      YouTube.
                    </p>
                  </div>
                ) : (
                  <div className="control-group">
                    <div className="control-heading">
                      <Radio size={17} />
                      <h3>Enviar com chave</h3>
                    </div>
                    <label className="field-label" htmlFor="stream-key">
                      Chave de transmissão
                    </label>
                    <input
                      id="stream-key"
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      value={streamKey}
                      disabled={liveActive || livePending}
                      onChange={(e) => setStreamKey(e.target.value)}
                      placeholder="Cole a chave do YouTube Studio"
                    />
                    <p className="field-help">
                      A chave fica apenas nesta sessão. Título e privacidade são
                      definidos no YouTube Studio.
                    </p>
                    <button
                      className="text-button"
                      onClick={() =>
                        run("external", () =>
                          window.studio.openExternal("youtube-studio"),
                        )
                      }
                    >
                      Abrir YouTube Studio <ExternalLink size={13} />
                    </button>
                  </div>
                )}
                <div className="control-group">
                  <div className="control-heading">
                    <FolderOpen size={17} />
                    <h3>Gravação neste PC</h3>
                  </div>
                  <p className="muted-copy">
                    Grave com ou sem transmissão. Cada saída funciona de forma
                    independente.
                  </p>
                  <button
                    className="button secondary full"
                    onClick={() =>
                      run("folder", () =>
                        window.studio.openExternal("recordings"),
                      )
                    }
                  >
                    <FolderOpen size={16} /> Abrir minhas gravações
                  </button>
                  {recordedPath && (
                    <p className="file-path" title={recordedPath}>
                      Último arquivo: {recordedPath}
                    </p>
                  )}
                </div>
                {info && !info.ffmpeg && (
                  <div className="inline-warning">
                    <AlertTriangle size={17} />
                    <p>
                      O codificador de transmissão não foi encontrado. A
                      gravação continua disponível; reinstale os componentes do
                      aplicativo para transmitir.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="panel-foot">
            <span className="status-dot ready" />
            Seu vídeo é composto localmente.
          </div>
        </aside>
      </main>

      <footer className="transport">
        <div className="transport-sources">
          <button
            className={`transport-icon ${metrics.camera ? "enabled" : ""}`}
            onClick={cameraToggle}
            disabled={busy.includes("camera")}
            aria-label={metrics.camera ? "Desligar câmera" : "Ativar câmera"}
            aria-pressed={metrics.camera}
          >
            {metrics.camera ? <Camera size={20} /> : <VideoOff size={20} />}
            <span>Câmera</span>
          </button>
          <button
            className={`transport-icon ${metrics.microphone && !config.muted ? "enabled" : ""}`}
            onClick={() =>
              metrics.microphone
                ? update({ muted: !config.muted })
                : micToggle()
            }
            disabled={busy.includes("mic")}
            aria-label={
              metrics.microphone
                ? config.muted
                  ? "Reativar microfone"
                  : "Silenciar microfone"
                : "Ativar microfone"
            }
            aria-pressed={metrics.microphone && !config.muted}
          >
            {metrics.microphone && !config.muted ? (
              <Mic size={20} />
            ) : (
              <MicOff size={20} />
            )}
            <span>{config.muted ? "Mudo" : "Microfone"}</span>
          </button>
          <div className="footer-audio" aria-hidden="true">
            {Array.from({ length: 17 }, (_, i) => (
              <i
                key={i}
                className={
                  metrics.microphone &&
                  !config.muted &&
                  metrics.micLevel * 44 > i
                    ? "lit"
                    : ""
                }
              />
            ))}
          </div>
          <button
            className={`transport-icon ${metrics.screen ? "enabled" : ""}`}
            onClick={screenToggle}
            disabled={busy.includes("screen")}
            aria-pressed={metrics.screen}
          >
            <MonitorUp size={20} />
            <span>Tela</span>
          </button>
        </div>
        <div className="output-actions">
          <div className="record-wrap">
            <span className="output-caption" aria-live="polite">
              {isBusyState(recordState)
                ? "Processando gravação…"
                : recordingActive
                  ? "Salvando neste computador"
                  : recordState === "error"
                    ? "Falha na gravação"
                    : "Seu arquivo, neste PC"}
            </span>
            <button
              className={`button record-button ${recordingActive ? "recording" : ""}`}
              onClick={recordToggle}
              disabled={
                comparing || busy.includes("record") || isBusyState(recordState)
              }
            >
              {busy.includes("record") || isBusyState(recordState) ? (
                <LoaderCircle size={16} className="spin" />
              ) : recordingActive ? (
                <Square size={14} fill="currentColor" />
              ) : (
                <Circle size={15} />
              )}
              {recordingActive ? "Parar gravação" : "Gravar"}
            </button>
          </div>
          <div className="live-wrap">
            <span className="output-caption" aria-live="polite">
              {livePending
                ? "Processando transmissão…"
                : liveActive
                  ? liveLabel
                  : "Tudo pronto? Seu público espera."}
            </span>
            <button
              className={`button primary live-button ${liveActive ? "is-live" : ""}`}
              disabled={comparing || livePending}
              onClick={() => {
                if (liveActive) setConfirm("stop");
                else if (!canBroadcast) {
                  setPanel("destination");
                  setNotice(
                    "Configure o destino e confira os dados antes de entrar ao vivo.",
                  );
                } else setConfirm("start");
              }}
            >
              {livePending ? (
                <LoaderCircle size={17} className="spin" />
              ) : liveActive ? (
                <Square size={15} fill="currentColor" />
              ) : (
                <Radio size={18} />
              )}
              {liveActive ? "Encerrar live" : "Entrar ao vivo"}
              {!liveActive && !livePending && <ChevronRight size={15} />}
            </button>
          </div>
        </div>
      </footer>

      {(error || notice) && (
        <div
          className={`toast ${error ? "error" : ""}`}
          role={error ? "alert" : "status"}
        >
          {error ? <AlertTriangle size={19} /> : <Check size={19} />}
          <p>{error || notice}</p>
          <button
            aria-label="Fechar aviso"
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {modalOpen && (
        <div className="modal-backdrop">
          <div
            className={`modal ${screenSources ? "screen-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            ref={dialogRef}
          >
            <button
              className="modal-close"
              aria-label="Fechar"
              disabled={busy.includes("screen") || livePending}
              onClick={() => {
                setScreenSources(null);
                setConfirm(null);
              }}
            >
              <X size={20} />
            </button>
            {screenSources ? (
              <>
                <span className="eyebrow">COMPARTILHAMENTO</span>
                <h2 id="modal-title">O que vai para o vídeo?</h2>
                <p>
                  Escolha uma tela ou janela. Feche informações privadas antes
                  de compartilhar.
                </p>
                <div className="screen-grid">
                  {screenSources.map((source) => (
                    <button
                      key={source.id}
                      disabled={busy.includes("screen")}
                      onClick={() => chooseScreen(source.id)}
                    >
                      {source.thumbnail ? (
                        <img src={source.thumbnail} alt="" />
                      ) : (
                        <div className="screen-placeholder">
                          <MonitorUp size={30} />
                        </div>
                      )}
                      <span>{source.name}</span>
                    </button>
                  ))}
                </div>
                <p className="field-help">
                  {busy.includes("screen")
                    ? "Iniciando compartilhamento…"
                    : "A fonte escolhida aparece imediatamente na composição."}
                </p>
                <button
                  className="text-button"
                  disabled={busy.includes("screen")}
                  onClick={() =>
                    run("screen", async () =>
                      setScreenSources(await window.studio.sources()),
                    )
                  }
                >
                  <RefreshCw size={14} /> Atualizar lista
                </button>
              </>
            ) : confirm === "start" ? (
              <>
                <span className="modal-icon">
                  <Radio size={27} />
                </span>
                <span className="eyebrow">ANTES DO PRIMEIRO OLÁ</span>
                <h2 id="modal-title">Vamos entrar ao vivo?</h2>
                <p>
                  Confira a saída. O vídeo e o áudio da composição serão
                  enviados ao YouTube.
                </p>
                <dl className="live-review">
                  <div>
                    <dt>Destino</dt>
                    <dd>
                      {mode === "oauth"
                        ? youtube.channel || "Canal conectado"
                        : "YouTube · chave de transmissão"}
                    </dd>
                  </div>
                  <div>
                    <dt>Título</dt>
                    <dd>
                      {mode === "oauth"
                        ? liveTitle
                        : "Definido no YouTube Studio"}
                    </dd>
                  </div>
                  <div>
                    <dt>Visibilidade</dt>
                    <dd>
                      {mode === "key"
                        ? "Confira no YouTube Studio"
                        : {
                            private: "Privada",
                            unlisted: "Não listada",
                            public: "Pública",
                          }[privacy]}
                    </dd>
                  </div>
                  <div>
                    <dt>Microfone</dt>
                    <dd>
                      {metrics.microphone && !config.muted
                        ? "Ativado"
                        : "Desativado / mudo"}
                    </dd>
                  </div>
                </dl>
                {!metrics.camera && !metrics.screen && (
                  <p className="inline-warning">
                    <AlertTriangle size={16} /> Você está sem câmera e sem tela.
                    A tela de espera da composição será enviada.
                  </p>
                )}
                {mode === "key" && (
                  <p className="field-help">
                    Com chave, o aplicativo confirma o envio. Confira no YouTube
                    Studio quando a live estiver pública.
                  </p>
                )}
                <div className="modal-actions">
                  <button
                    className="button secondary"
                    disabled={livePending}
                    onClick={() => setConfirm(null)}
                  >
                    Revisar
                  </button>
                  <button
                    className="button primary"
                    disabled={livePending || !canBroadcast}
                    onClick={startLive}
                  >
                    {livePending ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : (
                      <Radio size={16} />
                    )}
                    Iniciar transmissão
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="eyebrow">TRANSMISSÃO</span>
                <h2 id="modal-title">Encerrar a live?</h2>
                <p>
                  O envio de vídeo ao YouTube será encerrado. Se houver uma
                  gravação em andamento, ela continuará.
                </p>
                <div className="modal-actions">
                  <button
                    className="button secondary"
                    disabled={livePending}
                    onClick={() => setConfirm(null)}
                  >
                    Continuar live
                  </button>
                  <button
                    className="button danger"
                    disabled={livePending}
                    onClick={stopLive}
                  >
                    {livePending ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : (
                      <Square size={14} />
                    )}
                    Encerrar transmissão
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
