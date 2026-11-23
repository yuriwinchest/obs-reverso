import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { TikTokStatus } from "../src/shared/types";
import { tiktokDestination } from "./outputs";

type Security = {
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
  available(): boolean;
};
type Saved = { server: string; key: string };
const FILE = "tiktok-stream.enc";

/**
 * Keeps the last TikTok server + key encrypted with the Windows account
 * (safeStorage/DPAPI). The key never leaves the main process again: the
 * renderer only learns whether one is saved and which server it points to.
 */
export class TikTokKey {
  constructor(
    private directory: string,
    private security: Security,
  ) {}
  private async read(): Promise<Saved | null> {
    if (!this.security.available()) return null;
    try {
      const saved = JSON.parse(
        this.security.decrypt(await readFile(path.join(this.directory, FILE))),
      ) as Saved;
      tiktokDestination(saved.key, saved.server);
      return saved;
    } catch {
      return null;
    }
  }
  async status(): Promise<TikTokStatus> {
    const saved = await this.read();
    return {
      available: this.security.available(),
      saved: !!saved,
      ...(saved ? { server: saved.server } : {}),
    };
  }
  async save(server: unknown, key: unknown): Promise<TikTokStatus> {
    if (!this.security.available())
      throw new Error(
        "O armazenamento protegido do Windows não está disponível.",
      );
    tiktokDestination(key, server);
    const saved: Saved = {
      server: (server as string).trim().replace(/\/$/, ""),
      key: (key as string).trim(),
    };
    await mkdir(this.directory, { recursive: true });
    await writeFile(
      path.join(this.directory, FILE),
      this.security.encrypt(JSON.stringify(saved)),
      { mode: 0o600 },
    );
    return this.status();
  }
  async clear() {
    await rm(path.join(this.directory, FILE), { force: true });
  }
  async destination(): Promise<string> {
    const saved = await this.read();
    if (!saved)
      throw new Error("Salve o servidor e a chave do TikTok antes de iniciar.");
    return tiktokDestination(saved.key, saved.server);
  }
}
