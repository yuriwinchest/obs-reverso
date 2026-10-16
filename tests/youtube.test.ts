import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { YouTube } from "../electron/youtube";

// Identity encryption is restricted to isolated fixtures; production injects Electron safeStorage.
const security = {
  available: () => true,
  encrypt: (value: string) => Buffer.from(value),
  decrypt: (value: Buffer) => value.toString(),
  open: async (_url: string) => undefined,
};
async function fixture(expiresAt: number) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "obs-reverso-oauth-"));
  await writeFile(
    path.join(directory, "youtube-client.enc"),
    JSON.stringify({
      clientId: "test.apps.googleusercontent.com",
      clientSecret: "test-fixture",
    }),
  );
  await writeFile(
    path.join(directory, "youtube-session.enc"),
    JSON.stringify({
      accessToken: "fixture-access",
      refreshToken: "fixture-refresh",
      expiresAt,
    }),
  );
  return directory;
}

test("concurrent initial status requests await the complete protected session load", async () => {
  const directory = await fixture(Date.now() + 3600000);
  try {
    const youtube = new YouTube(directory, security);
    const statuses = await Promise.all(
      Array.from({ length: 10 }, () => youtube.status()),
    );
    assert.ok(statuses.every((value) => value.connected && value.configured));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("disconnect during token refresh cannot restore credentials or send the cancelled request", async () => {
  const directory = await fixture(0);
  const originalFetch = globalThis.fetch;
  let resolveRefresh!: (response: Response) => void;
  let refreshStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    refreshStarted = resolve;
  });
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    assert.equal(String(input), "https://oauth2.googleapis.com/token");
    refreshStarted();
    return new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
  };
  try {
    const youtube = new YouTube(directory, security);
    const refreshing = youtube.ingestActive("fixture-stream");
    await started;
    await youtube.disconnect();
    resolveRefresh(
      new Response(
        JSON.stringify({ access_token: "fixture-new", expires_in: 3600 }),
        { status: 200 },
      ),
    );
    await assert.rejects(refreshing, /cancelada/);
    assert.equal((await youtube.status()).connected, false);
    await assert.rejects(
      readFile(path.join(directory, "youtube-session.enc")),
      { code: "ENOENT" },
    );
    assert.equal(requests.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(directory, { recursive: true, force: true });
  }
});

test("OAuth callback rejects an invalid state and permits a subsequent refused consent to settle cleanly", async () => {
  const directory = await fixture(Date.now() + 3600000);
  const realFetch = globalThis.fetch;
  let opened = 0;
  const youtube = new YouTube(directory, {
    ...security,
    open: async (url) => {
      opened++;
      const consent = new URL(url);
      assert.equal(consent.origin, "https://accounts.google.com");
      assert.equal(consent.searchParams.get("code_challenge_method"), "S256");
      const callback = new URL(consent.searchParams.get("redirect_uri")!);
      assert.equal(callback.hostname, "127.0.0.1");
      callback.searchParams.set("state", "wrong-state");
      callback.searchParams.set("error", "access_denied");
      const invalid = await realFetch(callback);
      assert.equal(invalid.status, 400);
      callback.searchParams.set("state", consent.searchParams.get("state")!);
      const refused = await realFetch(callback);
      assert.equal(refused.status, 200);
      assert.equal(refused.headers.get("cache-control"), "no-store");
      assert.equal(await refused.text(), "Pode voltar ao OBS Reverso.");
    },
  });
  try {
    await assert.rejects(youtube.connect(), /cancelada ou recusada/);
    await assert.rejects(youtube.connect(), /cancelada ou recusada/);
    assert.equal(opened, 2);
  } finally {
    youtube.cancel();
    await rm(directory, { recursive: true, force: true });
  }
});
