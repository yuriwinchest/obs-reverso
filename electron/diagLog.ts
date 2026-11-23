import { appendFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const KEEP_DAYS = 7;
const MAX_LINE = 600;

/**
 * Removes anything that could carry a stream key: full ingest URLs, the
 * tee slave lists FFmpeg echoes back, and every secret handed in explicitly.
 */
export function redact(text: string, secrets: readonly string[] = []) {
  let clean = text;
  for (const secret of secrets)
    if (secret.length >= 6) clean = clean.split(secret).join("[oculto]");
  return clean
    .replace(/rtmps?:\/\/[^\s|'"\]]+/gi, "[destino]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, MAX_LINE);
}

/**
 * Plain-text session log under userData/logs, one file per day, last 7 kept.
 * Exists so a live that drops at home can be explained afterwards: the error
 * on screen disappears, this file stays.
 */
export class DiagLog {
  private secrets: string[] = [];
  constructor(private directory: string) {
    try {
      mkdirSync(directory, { recursive: true });
      const files = readdirSync(directory)
        .filter((name) => /^sessao-\d{4}-\d{2}-\d{2}\.log$/.test(name))
        .sort();
      for (const old of files.slice(0, Math.max(0, files.length - KEEP_DAYS)))
        rmSync(path.join(directory, old), { force: true });
    } catch {
      /* Diagnostics must never stop the studio. */
    }
  }
  /** Keys of the running live; redacted from every later line. */
  protect(secrets: string[]) {
    this.secrets = secrets.filter(Boolean);
  }
  write(source: string, text: string) {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const line = `${now.toISOString()} [${source}] ${redact(text, this.secrets)}\n`;
    try {
      appendFileSync(path.join(this.directory, `sessao-${day}.log`), line);
    } catch {
      /* Disk full or locked: keep streaming without the log. */
    }
  }
}
