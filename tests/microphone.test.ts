import { test } from "node:test";
import assert from "node:assert/strict";
import { isHandsFreeMic } from "../src/engine/StudioEngine";

test("reconhece o microfone Hands-Free de fone Bluetooth", () => {
  assert.equal(
    isHandsFreeMic("Fone de ouvido (WH-1000XM4 Hands-Free AG Audio)"),
    true,
  );
  assert.equal(isHandsFreeMic("Padrão - Headset (Bluetooth Audio)"), true);
  assert.equal(isHandsFreeMic("Viva-voz (JBL Tune)"), true);
});

test("não confunde microfone do notebook ou USB com Bluetooth", () => {
  assert.equal(isHandsFreeMic("Microfone (Realtek(R) Audio)"), false);
  assert.equal(isHandsFreeMic("Headset Microphone (USB Audio Device)"), false);
  assert.equal(isHandsFreeMic(""), false);
});
