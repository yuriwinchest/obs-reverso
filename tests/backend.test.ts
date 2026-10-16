import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, copyFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  MAX_CHUNK,
  MAX_BACKLOG,
  OrderedSink,
  Outputs,
  validChunk,
  youtubeDestination,
} from "../electron/outputs";
import { oauthStateMatches, parseCredentials } from "../electron/youtube";

const bytes = (text: string) => Uint8Array.from(Buffer.from(text)).buffer;
test("RTMPS destination rejects credential injection and untrusted servers", () => {
  assert.equal(
    youtubeDestination("aaaa-bbbb_cccc"),
    "rtmps://a.rtmps.youtube.com:443/live2/aaaa-bbbb_cccc",
  );
  assert.equal(
    youtubeDestination("aaaa-bbbb", "rtmps://b.rtmps.youtube.com:443/live2/"),
    "rtmps://b.rtmps.youtube.com:443/live2/aaaa-bbbb",
  );
  for (const key of [
    "aaa",
    "aaaa/bbbb",
    "aaaa bbbb",
    "aaaa\nbbbb",
    "a".repeat(257),
    { key: "aaaa-bbbb" },
  ])
    assert.throws(() => youtubeDestination(key));
  for (const address of [
    "http://a.rtmps.youtube.com/live2",
    "rtmps://attacker.example/live2",
    "rtmps://a.rtmps.youtube.com.attacker.example/live2",
    "rtmps://user:pass@a.rtmps.youtube.com/live2",
    "rtmps://a.rtmps.youtube.com:444/live2",
    "rtmps://a.rtmps.youtube.com/live2?x=1",
  ])
    assert.throws(() => youtubeDestination("aaaa-bbbb", address));
});
test("media chunks have bounded shape and reject empty or excessive data", () => {
  assert.equal(validChunk(bytes("abc")).toString(), "abc");
  for (const value of [
    null,
    {},
    "abc",
    new Uint8Array(3),
    new ArrayBuffer(0),
    new ArrayBuffer(MAX_CHUNK + 1),
  ])
    assert.throws(() => validChunk(value));
});
test("ordered sink rejects replay/gaps and serializes pending writes", async () => {
  const sink = new OrderedSink();
  const result: string[] = [];
  let release!: () => void;
  const first = sink.append(0, bytes("one"), async (data) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    result.push(data.toString());
  });
  const second = sink.append(1, bytes("two"), async (data) => {
    result.push(data.toString());
  });
  await assert.rejects(
    sink.append(1, bytes("repeat"), async () => undefined),
    /Sequência/,
  );
  await assert.rejects(
    sink.append(3, bytes("gap"), async () => undefined),
    /Sequência/,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(result, []);
  release();
  await Promise.all([first, second]);
  await sink.finish();
  assert.deepEqual(result, ["one", "two"]);
  assert.equal(sink.queued, 0);
  assert.equal(sink.bytes, 6);
  await assert.rejects(
    sink.append(2, bytes("closed"), async () => undefined),
    /encerrada/,
  );
});
test("bounded backlog fails explicitly instead of dropping a container chunk", async () => {
  const sink = new OrderedSink();
  const writes: Promise<void>[] = [];
  for (let i = 0; i < MAX_BACKLOG / MAX_CHUNK; i++)
    writes.push(
      sink.append(i, new ArrayBuffer(MAX_CHUNK), async () => undefined),
    );
  await assert.rejects(
    sink.append(4, bytes("over"), async () => undefined),
    /lenta/,
  );
  await Promise.allSettled(writes);
  await assert.rejects(sink.finish(), /lenta/);
  assert.equal(sink.queued, 0);
});
test("recording writes incrementally and renames only after ordered flush", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "obs-reverso-record-"),
  );
  const outputs = new Outputs("unused-in-recording", () => undefined, copyFile);
  try {
    const session = await outputs.startRecording(
      path.join(directory, "test.webm"),
    );
    assert.equal(
      (await readdir(directory)).filter((file) =>
        file.endsWith(".partial.webm"),
      ).length,
      1,
    );
    await assert.rejects(
      outputs.startRecording(path.join(directory, "other.webm")),
      /andamento/,
    );
    await assert.rejects(
      outputs.appendRecording("wrong-session", 0, bytes("bad")),
      /encontrada/,
    );
    await outputs.appendRecording(session.id, 0, bytes("header"));
    await outputs.appendRecording(session.id, 1, bytes("payload"));
    await Promise.all([
      outputs.stopRecording(session.id),
      outputs.stopRecording(session.id),
    ]);
    assert.equal((await readFile(session.path)).toString(), "headerpayload");
    assert.deepEqual(await readdir(directory), ["test.webm"]);
    await assert.rejects(
      outputs.appendRecording(session.id, 2, bytes("late")),
      /encontrada/,
    );
  } finally {
    await outputs.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("empty recordings remain partial and are never presented as completed", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "obs-reverso-empty-"));
  const outputs = new Outputs("unused", () => undefined);
  try {
    const session = await outputs.startRecording(
      path.join(directory, "empty.webm"),
    );
    await assert.rejects(outputs.stopRecording(session.id), /incompleta/);
    assert.ok((await readdir(directory))[0].endsWith(".partial.webm"));
  } finally {
    await outputs.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("failed recording finalization preserves original bytes and never emits completed", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "obs-reverso-finalize-"),
  );
  const states: string[] = [];
  const outputs = new Outputs(
    "unused",
    (event) => states.push(event.state),
    async () => {
      throw new Error("disk full");
    },
  );
  try {
    const session = await outputs.startRecording(
      path.join(directory, "test.webm"),
    );
    await outputs.appendRecording(session.id, 0, bytes("recoverable-media"));
    await assert.rejects(outputs.stopRecording(session.id), /incompleta/);
    const files = await readdir(directory);
    assert.equal(files.length, 1);
    assert.ok(files[0].endsWith(".partial.webm"));
    assert.equal(
      (await readFile(path.join(directory, files[0]))).toString(),
      "recoverable-media",
    );
    assert.equal(states.includes("idle"), false);
  } finally {
    await outputs.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("OAuth configuration accepts only desktop application credential structure", () => {
  const credentials = {
    client_id: "123-test.apps.googleusercontent.com",
    client_secret: "example-placeholder",
  };
  assert.equal(
    parseCredentials(JSON.stringify({ installed: credentials })).clientId,
    credentials.client_id,
  );
  for (const value of [
    { web: credentials },
    { installed: { ...credentials, client_id: "https://attacker.example" } },
    { installed: {} },
    null,
  ])
    assert.throws(() => parseCredentials(JSON.stringify(value)));
});
test("OAuth state rejects mismatched Unicode bytes without throwing", () => {
  assert.equal(oauthStateMatches("abcdef", "abcdef"), true);
  assert.equal(oauthStateMatches("abcdeg", "abcdef"), false);
  assert.equal(oauthStateMatches("éééééé", "abcdef"), false);
  assert.equal(oauthStateMatches("", "abcdef"), false);
});
