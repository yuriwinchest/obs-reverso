export type BackgroundKind = "original" | "blur" | "color" | "image" | "motion";
export interface ProgramConfig {
  background: BackgroundKind;
  color: string;
  imageUrl: string;
  motion: "aurora" | "studio" | "sunset";
  blur: number;
  mirror: boolean;
  /** Scale of the camera layer inside its frame (0.5–2). */
  cameraZoom: number;
  /** Camera offset as a fraction of the frame width/height (−0.5–0.5). */
  cameraX: number;
  cameraY: number;
  pipPosition: "left" | "right";
  pipSize: number;
  title: string;
  subtitle: string;
  micGain: number;
  desktopGain: number;
  muted: boolean;
}
export const defaultConfig: ProgramConfig = {
  background: "original",
  color: "#274c43",
  imageUrl: "",
  motion: "aurora",
  blur: 12,
  mirror: true,
  cameraZoom: 1,
  cameraX: 0,
  cameraY: 0,
  pipPosition: "right",
  pipSize: 0.25,
  title: "",
  subtitle: "",
  micGain: 1,
  desktopGain: 0.7,
  muted: false,
};
export interface Metrics {
  fps: number;
  maskFps: number;
  maskMs: number;
  micLevel: number;
  segmentation: "off" | "loading" | "ready" | "error";
  camera: boolean;
  microphone: boolean;
  screen: boolean;
}
export const emptyMetrics: Metrics = {
  fps: 0,
  maskFps: 0,
  maskMs: 0,
  micLevel: 0,
  segmentation: "off",
  camera: false,
  microphone: false,
  screen: false,
};
export interface OutputStatus {
  kind: "recording" | "broadcast" | "thumbnail";
  state:
    "idle" | "starting" | "sending" | "stopping" | "error" | "liveConfirmed";
  message?: string;
  bytes?: number;
  path?: string;
}
export interface YouTubeStatus {
  connected: boolean;
  configured: boolean;
  channel?: string;
}
export interface StudioBridge {
  info(): Promise<{
    version: string;
    ffmpeg: boolean;
    recordingsDirectory: string;
  }>;
  sources(): Promise<Array<{ id: string; name: string; thumbnail: string }>>;
  chooseScreen(id: string): Promise<void>;
  recordingStart(): Promise<{ id: string; path: string } | null>;
  recordingAppend(id: string, seq: number, bytes: ArrayBuffer): Promise<void>;
  recordingStop(id: string): Promise<{ path: string }>;
  broadcastStart(options: {
    mode: "key" | "oauth";
    key?: string;
    title?: string;
    privacy?: "private" | "unlisted" | "public";
  }): Promise<{ id: string }>;
  broadcastAppend(id: string, seq: number, bytes: ArrayBuffer): Promise<void>;
  broadcastStop(id: string): Promise<void>;
  youtubeConfigure(): Promise<YouTubeStatus>;
  youtubeConnect(): Promise<YouTubeStatus>;
  youtubeDisconnect(): Promise<void>;
  youtubeStatus(): Promise<YouTubeStatus>;
  thumbnailChoose(): Promise<{ name: string; preview: string } | null>;
  thumbnailClear(): Promise<void>;
  openExternal(target: "youtube-studio" | "recordings"): Promise<void>;
  onStatus(callback: (status: OutputStatus) => void): () => void;
  onClosing(callback: () => void): () => void;
  finishClose(): Promise<void>;
}
declare global {
  interface Window {
    studio: StudioBridge;
  }
}
