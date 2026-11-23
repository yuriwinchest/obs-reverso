import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  broadcastOutputArgs,
  checkTarget,
  tiktokDestination,
} from "../electron/outputs";
import { TikTokKey } from "../electron/tiktokKey";

const KEY = "stream-7123456789012345678?expire=1764000000&sign=0a1b2c3d4e5f";

test("tiktok accepts rtmp(s) servers on TikTok-owned domains", () => {
  assert.equal(
    tiktokDestination(KEY, "rtmp://push-rtmp-l11-va01.tiktokcdn.com/game"),
    `rtmp://push-rtmp-l11-va01.tiktokcdn.com/game/${KEY}`,
  );
  assert.equal(
    tiktokDestination(` ${KEY} `, " rtmps://push.live.tiktok.com:443/live/ "),
    `rtmps://push.live.tiktok.com:443/live/${KEY}`,
  );
  assert.equal(
    tiktokDestination("abcdefgh", "rtmp://PUSH.TikTokCDN-EU.com:1935/stage"),
    "rtmp://PUSH.TikTokCDN-EU.com:1935/stage/abcdefgh",
  );
});

test("tiktok refuses foreign hosts, lookalikes and odd URLs", () => {
  for (const address of [
    "rtmp://evil.example/live",
    "rtmp://tiktok.com.evil.example/live",
    "rtmp://eviltiktok.com/live",
    "rtmp://evil.example%2F.tiktokcdn.com/live",
    "https://push.tiktokcdn.com/live",
    "srt://push.tiktokcdn.com/live",
    "rtmp://user:pass@push.tiktokcdn.com/live",
    "rtmp://push.tiktokcdn.com:8080/live",
    "rtmp://push.tiktokcdn.com/live?x=1",
    "rtmp://push.tiktokcdn.com/live#x",
    "rtmp://push.tiktokcdn.com/li ve",
    "rtmp://push.tiktokcdn.com/live|rtmp://evil.example/x",
    "not a url",
    42,
  ])
    assert.throws(() => tiktokDestination(KEY, address), String(address));
});

test("tiktok key cannot smuggle a second destination or path", () => {
  for (const key of [
    "",
    "short",
    "abcdefgh|[f=flv]rtmp://evil.example/x",
    "abcdefgh/../../x",
    "abcd efgh",
    "abcdefgh'x",
    "abcdefgh\\x",
    "abcdefgh]x",
    "a".repeat(513),
    null,
  ])
    assert.throws(
      () => tiktokDestination(key, "rtmp://push.tiktokcdn.com/game"),
      String(key),
    );
});

test("every destination is re-checked by its own platform rules", () => {
  checkTarget({
    url: `rtmp://push.tiktokcdn.com/game/${KEY}`,
    label: "TikTok",
  });
  checkTarget({
    url: "rtmps://a.rtmps.youtube.com/live2/aaaa-bbbb",
    label: "YouTube",
  });
  // A TikTok server labelled as YouTube (or vice versa) is refused.
  assert.throws(() =>
    checkTarget({
      url: `rtmp://push.tiktokcdn.com/game/${KEY}`,
      label: "YouTube",
    }),
  );
  assert.throws(() =>
    checkTarget({
      url: "rtmps://a.rtmps.youtube.com/live2/aaaa-bbbb",
      label: "TikTok",
    }),
  );
});

test("two destinations share one encode, each with its own fifo", () => {
  const youtube = "rtmps://a.rtmps.youtube.com/live2/aaaa-bbbb";
  const tiktok = `rtmp://push.tiktokcdn.com/game/${KEY}`;
  const args = broadcastOutputArgs([youtube, tiktok]);
  assert.deepEqual(args.slice(0, 2), ["-f", "tee"]);
  const slaves = args[2].split("|");
  assert.equal(slaves.length, 2);
  for (const [i, url] of [youtube, tiktok].entries()) {
    const [, options, target] = /^\[([^\]]+)\](.+)$/.exec(slaves[i])!;
    assert.equal(target, url);
    const opts = options.split(":");
    assert.ok(opts.includes("f=fifo"));
    assert.ok(opts.includes("fifo_format=flv"));
    assert.ok(opts.includes("drop_pkts_on_overflow=1"));
    assert.ok(opts.includes("attempt_recovery=1"));
    assert.ok(
      opts.includes("onfail=ignore"),
      "one drop must not end the other",
    );
  }
  assert.throws(() => broadcastOutputArgs([youtube, "rtmp://a/b|c"]));
  assert.throws(() => broadcastOutputArgs([]));
});

test("saved tiktok key is encrypted and never handed back", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "obs-reverso-tiktok-"));
  const security = {
    available: () => true,
    encrypt: (value: string) =>
      Buffer.from([...Buffer.from(value)].map((byte) => byte ^ 0x5a)),
    decrypt: (value: Buffer) =>
      Buffer.from([...value].map((byte) => byte ^ 0x5a)).toString(),
  };
  try {
    const store = new TikTokKey(directory, security);
    assert.deepEqual(await store.status(), { available: true, saved: false });
    await assert.rejects(store.destination());
    await assert.rejects(store.save("rtmp://evil.example/live", KEY));
    const status = await store.save("rtmp://push.tiktokcdn.com/game/", KEY);
    assert.deepEqual(status, {
      available: true,
      saved: true,
      server: "rtmp://push.tiktokcdn.com/game",
    });
    assert.ok(!JSON.stringify(status).includes("sign="));
    const raw = await readFile(path.join(directory, "tiktok-stream.enc"));
    assert.ok(!raw.toString().includes(KEY), "key must not be stored in clear");
    assert.equal(
      await store.destination(),
      `rtmp://push.tiktokcdn.com/game/${KEY}`,
    );
    await store.clear();
    assert.equal((await store.status()).saved, false);
    const locked = new TikTokKey(directory, {
      ...security,
      available: () => false,
    });
    await assert.rejects(locked.save("rtmp://push.tiktokcdn.com/game", KEY));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
