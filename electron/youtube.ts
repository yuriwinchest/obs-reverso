import { createServer, type Server } from "node:http";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { YouTubeStatus } from "../src/shared/types";
import {
  ThumbnailRefused,
  thumbnailRefusal,
  type ThumbnailMime,
} from "./thumbnail";
type Credentials = { clientId: string; clientSecret: string };
type Tokens = { accessToken: string; refreshToken?: string; expiresAt: number };
type Security = {
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
  available(): boolean;
  open(url: string): Promise<void>;
};
export function oauthStateMatches(received: string, expected: string) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function parseCredentials(text: string): Credentials {
  const json = JSON.parse(text);
  const desktop = json?.installed;
  if (
    !desktop ||
    typeof desktop.client_id !== "string" ||
    !/^[\w.-]+\.apps\.googleusercontent\.com$/.test(desktop.client_id) ||
    typeof desktop.client_secret !== "string" ||
    desktop.client_secret.length > 512
  )
    throw new Error(
      "Selecione o JSON de credenciais OAuth para aplicativo de computador.",
    );
  return { clientId: desktop.client_id, clientSecret: desktop.client_secret };
}
export class YouTube {
  private credentials: Credentials | null = null;
  private tokens: Tokens | null = null;
  private loading: Promise<void> | null = null;
  private sessionStorage: Promise<unknown> = Promise.resolve();
  private channel?: string;
  private cancelAuthorization: (() => void) | null = null;
  private connecting = false;
  private generation = 0;
  constructor(
    private directory: string,
    private security: Security,
  ) {}
  private async load() {
    this.loading ??= (async () => {
      if (!this.security.available()) return;
      try {
        this.credentials = JSON.parse(
          this.security.decrypt(
            await readFile(path.join(this.directory, "youtube-client.enc")),
          ),
        );
      } catch {
        /* Configuration may not exist yet. */
      }
      try {
        this.tokens = JSON.parse(
          this.security.decrypt(
            await readFile(path.join(this.directory, "youtube-session.enc")),
          ),
        );
      } catch {
        /* An expired/removed session is disconnected. */
      }
    })();
    await this.loading;
  }
  private persistSession(tokens: Tokens | null, generation: number) {
    const operation = this.sessionStorage.then(async () => {
      if (generation !== this.generation) return;
      if (tokens) await this.save("youtube-session.enc", tokens);
      else
        await rm(path.join(this.directory, "youtube-session.enc"), {
          force: true,
        });
    });
    this.sessionStorage = operation.catch(() => undefined);
    return operation;
  }
  private async save(name: string, value: unknown) {
    if (!this.security.available())
      throw new Error(
        "O armazenamento protegido do Windows não está disponível.",
      );
    await mkdir(this.directory, { recursive: true });
    await writeFile(
      path.join(this.directory, name),
      this.security.encrypt(JSON.stringify(value)),
      { mode: 0o600 },
    );
  }
  async configure(text: string): Promise<YouTubeStatus> {
    await this.load();
    if (this.connecting)
      throw new Error("Conclua ou cancele a conexão em andamento.");
    const credentials = parseCredentials(text);
    await this.disconnect();
    await this.save("youtube-client.enc", credentials);
    this.credentials = credentials;
    return this.status();
  }
  async status(): Promise<YouTubeStatus> {
    await this.load();
    return {
      connected: !!this.tokens,
      configured: !!this.credentials,
      ...(this.channel ? { channel: this.channel } : {}),
    };
  }
  async connect(): Promise<YouTubeStatus> {
    await this.load();
    if (!this.credentials)
      throw new Error("Importe as credenciais OAuth de computador primeiro.");
    if (this.connecting) throw new Error("Uma conexão já está em andamento.");
    if (!this.security.available())
      throw new Error(
        "O armazenamento protegido do Windows não está disponível.",
      );
    this.connecting = true;
    const generation = ++this.generation;
    const credentials = this.credentials;
    const verifier = randomBytes(48).toString("base64url");
    const state = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    let server: Server | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      let resolveCode!: (code: string) => void;
      let rejectCode!: (error: Error) => void;
      const codePromise = new Promise<string>((resolve, reject) => {
        resolveCode = resolve;
        rejectCode = reject;
      });
      // Attach a handler immediately; browser launch may fail before awaiting it.
      void codePromise.catch(() => undefined);
      server = createServer((request, response) => {
        let callback: URL;
        try {
          callback = new URL(request.url ?? "/", "http://127.0.0.1");
        } catch {
          response.writeHead(400);
          response.end();
          return;
        }
        if (
          request.method !== "GET" ||
          callback.pathname !== "/oauth2callback"
        ) {
          response.writeHead(404);
          response.end();
          return;
        }
        const received = callback.searchParams.get("state") ?? "";
        if (!oauthStateMatches(received, state)) {
          response.writeHead(400);
          response.end("Solicitacao invalida.");
          return;
        }
        response.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": "default-src 'none'",
        });
        response.end("Pode voltar ao OBS Reverso.");
        const code = callback.searchParams.get("code");
        if (callback.searchParams.has("error") || !code)
          rejectCode(new Error("A conexão foi cancelada ou recusada."));
        else resolveCode(code);
      });
      await new Promise<void>((resolve, reject) => {
        server!.once("error", () =>
          reject(new Error("Não foi possível abrir a conexão local.")),
        );
        server!.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Não foi possível abrir a conexão local.");
      const redirect = `http://127.0.0.1:${address.port}/oauth2callback`;
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: credentials.clientId,
        redirect_uri: redirect,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/youtube.force-ssl",
        access_type: "offline",
        prompt: "consent",
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
      }).toString();
      this.cancelAuthorization = () =>
        rejectCode(new Error("Conexão cancelada."));
      timer = setTimeout(
        () =>
          rejectCode(
            new Error("O tempo para conectar terminou. Tente novamente."),
          ),
        120000,
      );
      await this.security.open(url.toString());
      const code = await codePromise;
      const token = await this.tokenRequest({
        code,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: redirect,
        grant_type: "authorization_code",
        code_verifier: verifier,
      });
      if (generation !== this.generation) throw new Error("Conexão cancelada.");
      this.tokens = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + Number(token.expires_in ?? 3600) * 1000,
      };
      await this.persistSession(this.tokens, generation);
      if (generation !== this.generation) throw new Error("Conexão cancelada.");
      const channels = await this.api("channels?part=snippet&mine=true");
      if (generation !== this.generation) throw new Error("Conexão cancelada.");
      this.channel = channels.items?.[0]?.snippet?.title;
      return this.status();
    } catch (error) {
      throw new Error(
        error instanceof Error && !/fetch|https?:|token/i.test(error.message)
          ? error.message
          : "Não foi possível conectar ao YouTube.",
      );
    } finally {
      if (timer) clearTimeout(timer);
      server?.close();
      server?.closeAllConnections();
      this.cancelAuthorization = null;
      this.connecting = false;
    }
  }
  cancel() {
    this.generation++;
    this.cancelAuthorization?.();
  }
  async disconnect() {
    await this.load();
    this.cancel();
    this.tokens = null;
    this.channel = undefined;
    await this.persistSession(null, this.generation);
  }
  private async tokenRequest(body: Record<string, string>) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        `O Google recusou a autorização (${response.status}). Reconecte a conta.`,
      );
    const json = await response.json();
    if (typeof json.access_token !== "string")
      throw new Error("A autorização recebida é inválida.");
    return json;
  }
  private async accessToken() {
    await this.load();
    if (!this.tokens || !this.credentials)
      throw new Error("Conecte sua conta do YouTube.");
    if (this.tokens.expiresAt - Date.now() < 60000) {
      if (!this.tokens.refreshToken)
        throw new Error("A sessão expirou. Reconecte a conta.");
      const generation = this.generation;
      const previous = this.tokens;
      const token = await this.tokenRequest({
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        refresh_token: this.tokens.refreshToken,
        grant_type: "refresh_token",
      });
      if (generation !== this.generation || !this.tokens)
        throw new Error("Conexão cancelada.");
      this.tokens = {
        ...previous,
        accessToken: token.access_token,
        expiresAt: Date.now() + Number(token.expires_in ?? 3600) * 1000,
      };
      await this.persistSession(this.tokens, generation);
      if (generation !== this.generation || !this.tokens)
        throw new Error("Conexão cancelada.");
    }
    return this.tokens.accessToken;
  }
  private async api(
    endpoint: string,
    method = "GET",
    body?: unknown,
  ): Promise<any> {
    const accessToken = await this.accessToken();
    let response: Response;
    try {
      response = await fetch(
        `https://www.googleapis.com/youtube/v3/${endpoint}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch {
      throw new Error("O YouTube não respondeu. Confira sua conexão.");
    }
    if (!response.ok)
      throw new Error(
        `O YouTube recusou a operação (${response.status}). Verifique se seu canal permite transmissões ao vivo.`,
      );
    return response.status === 204 ? {} : response.json();
  }
  async prepare(title: string, privacy: "private" | "unlisted" | "public") {
    if (
      !title.trim() ||
      title.length > 100 ||
      !["private", "unlisted", "public"].includes(privacy)
    )
      throw new Error("Revise título e privacidade da transmissão.");
    let streamId: string | undefined;
    let broadcastId: string | undefined;
    try {
      const stream = await this.api("liveStreams?part=snippet,cdn", "POST", {
        snippet: { title: title.trim() },
        cdn: {
          ingestionType: "rtmp",
          resolution: "variable",
          frameRate: "variable",
        },
      });
      streamId = stream.id;
      const broadcast = await this.api(
        "liveBroadcasts?part=snippet,status,contentDetails",
        "POST",
        {
          snippet: {
            title: title.trim(),
            scheduledStartTime: new Date(Date.now() + 60000).toISOString(),
          },
          status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
          contentDetails: {
            enableAutoStart: false,
            enableAutoStop: false,
            monitorStream: { enableMonitorStream: false },
          },
        },
      );
      broadcastId = broadcast.id;
      await this.api(
        `liveBroadcasts/bind?part=id,contentDetails&id=${encodeURIComponent(broadcastId!)}&streamId=${encodeURIComponent(streamId!)}`,
        "POST",
      );
      const info = stream.cdn?.ingestionInfo;
      if (
        typeof info?.streamName !== "string" ||
        typeof info?.rtmpsIngestionAddress !== "string"
      )
        throw new Error("O YouTube não retornou um destino RTMPS.");
      return {
        broadcastId: broadcastId!,
        streamId: streamId!,
        key: info.streamName as string,
        address: info.rtmpsIngestionAddress as string,
      };
    } catch (error) {
      if (broadcastId)
        await this.api(
          `liveBroadcasts?id=${encodeURIComponent(broadcastId)}`,
          "DELETE",
        ).catch(() => undefined);
      if (streamId)
        await this.api(
          `liveStreams?id=${encodeURIComponent(streamId)}`,
          "DELETE",
        ).catch(() => undefined);
      throw error;
    }
  }
  async setThumbnail(videoId: string, bytes: Buffer, mime: ThumbnailMime) {
    const accessToken = await this.accessToken();
    let response: Response;
    try {
      response = await fetch(
        `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": mime,
          },
          body: new Uint8Array(bytes),
          signal: AbortSignal.timeout(30000),
        },
      );
    } catch {
      throw new ThumbnailRefused(
        "O YouTube não respondeu ao envio da capa. A live continua; defina a capa no YouTube Studio.",
      );
    }
    if (!response.ok)
      throw new ThumbnailRefused(thumbnailRefusal(response.status));
  }
  async ingestActive(streamId: string) {
    const data = await this.api(
      `liveStreams?part=status&id=${encodeURIComponent(streamId)}`,
    );
    return data.items?.[0]?.status?.streamStatus === "active";
  }
  async goLive(broadcastId: string) {
    const data = await this.api(
      `liveBroadcasts/transition?part=status&id=${encodeURIComponent(broadcastId)}&broadcastStatus=live`,
      "POST",
    );
    return data.status?.lifeCycleStatus === "live";
  }
  async isLive(broadcastId: string) {
    const data = await this.api(
      `liveBroadcasts?part=status&id=${encodeURIComponent(broadcastId)}`,
    );
    return data.items?.[0]?.status?.lifeCycleStatus === "live";
  }
  async complete(broadcastId: string) {
    await this.api(
      `liveBroadcasts/transition?part=status&id=${encodeURIComponent(broadcastId)}&broadcastStatus=complete`,
      "POST",
    );
  }
  async discardPrepared(broadcastId: string, streamId: string) {
    await this.api(
      `liveBroadcasts?id=${encodeURIComponent(broadcastId)}`,
      "DELETE",
    );
    await this.api(`liveStreams?id=${encodeURIComponent(streamId)}`, "DELETE");
  }
}
