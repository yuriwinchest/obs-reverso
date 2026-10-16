import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { YouTube } from "../electron/youtube";
import {
  applyThumbnail,
  maxThumbnailBytes,
  thumbnailMime,
  thumbnailName,
  type Thumbnail,
} from "../electron/thumbnail";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const security = {
  available: () => true,
  encrypt: (value: string) => Buffer.from(value),
  decrypt: (value: Buffer) => value.toString(),
  open: async (_url: string) => undefined,
};
async function connected() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "obs-reverso-cover-"));
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
      expiresAt: Date.now() + 3600000,
    }),
  );
  return directory;
}

test("cover type comes from the leading bytes, not the file name", () => {
  assert.equal(thumbnailMime(jpeg), "image/jpeg");
  assert.equal(thumbnailMime(png), "image/png");
  assert.throws(
    () => thumbnailMime(Buffer.from("GIF89a-not-allowed")),
    /JPG ou PNG/,
  );
  assert.throws(
    () => thumbnailMime(Buffer.from("<svg onload=x>")),
    /JPG ou PNG/,
  );
  assert.throws(() => thumbnailMime(Buffer.alloc(0)), /JPG ou PNG/);
});

test("cover larger than 2 MB is refused even with a valid signature", () => {
  const exact = Buffer.alloc(maxThumbnailBytes);
  jpeg.copy(exact);
  assert.equal(thumbnailMime(exact), "image/jpeg");
  const over = Buffer.alloc(maxThumbnailBytes + 1);
  jpeg.copy(over);
  assert.throws(() => thumbnailMime(over), /2 MB/);
});

test("only the file name reaches the renderer", () => {
  assert.equal(thumbnailName("C:\\Users\\yuri\\Fotos\\capa.png"), "capa.png");
  assert.equal(thumbnailName("/home/x/capa.jpg"), "capa.jpg");
  assert.equal(thumbnailName(`${"a".repeat(200)}.png`).length, 78);
});

test("cover upload posts the image bytes for the broadcast video id", async () => {
  const directory = await connected();
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(
      JSON.stringify({ kind: "youtube#thumbnailSetResponse" }),
      {
        status: 200,
      },
    );
  };
  try {
    await new YouTube(directory, security).setThumbnail(
      "abc_123-XY",
      png,
      "image/png",
    );
    assert.equal(calls.length, 1);
    const url = new URL(calls[0].url);
    assert.equal(
      url.origin + url.pathname,
      "https://www.googleapis.com/upload/youtube/v3/thumbnails/set",
    );
    assert.equal(url.searchParams.get("videoId"), "abc_123-XY");
    assert.equal(calls[0].init?.method, "POST");
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers["Content-Type"], "image/png");
    assert.equal(headers.Authorization, "Bearer fixture-access");
    assert.deepEqual(Buffer.from(calls[0].init?.body as Uint8Array), png);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(directory, { recursive: true, force: true });
  }
});

test("a refused cover is reported in Portuguese and never rejects", async () => {
  const directory = await connected();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 403 });
  const cover: Thumbnail = {
    name: "capa.jpg",
    bytes: jpeg,
    mime: "image/jpeg",
  };
  const reports: Array<[boolean, string]> = [];
  try {
    await applyThumbnail(
      new YouTube(directory, security),
      "video-id",
      cover,
      (ok, message) => reports.push([ok, message]),
      () => true,
    );
    assert.equal(reports.length, 1);
    assert.equal(reports[0][0], false);
    assert.match(reports[0][1], /canal verificado/);
    assert.match(reports[0][1], /A live continua/);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(directory, { recursive: true, force: true });
  }
});

test("network failure or unexpected error on the cover leaves the live untouched", async () => {
  const cover: Thumbnail = { name: "capa.png", bytes: png, mime: "image/png" };
  const reports: Array<[boolean, string]> = [];
  await applyThumbnail(
    {
      setThumbnail: async () => {
        throw new Error("socket hang up https://internal");
      },
    },
    "video-id",
    cover,
    (ok, message) => reports.push([ok, message]),
    () => true,
  );
  assert.deepEqual(reports, [
    [
      false,
      "Não foi possível enviar a capa. A live continua; defina a capa no YouTube Studio.",
    ],
  ]);
});

test("a cover result for a finished broadcast is not reported", async () => {
  const reports: unknown[] = [];
  const cover: Thumbnail = { name: "capa.png", bytes: png, mime: "image/png" };
  await applyThumbnail(
    { setThumbnail: async () => undefined },
    "video-id",
    cover,
    (...args) => reports.push(args),
    () => false,
  );
  await applyThumbnail(
    {
      setThumbnail: async () => {
        throw new Error("x");
      },
    },
    "video-id",
    cover,
    (...args) => reports.push(args),
    () => false,
  );
  assert.equal(reports.length, 0);
});
