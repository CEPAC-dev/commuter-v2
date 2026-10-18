import test from "node:test";
import assert from "node:assert/strict";

const {
  CHAT_PRESETS,
  getChatPresets,
  isChatFreeTextEnabled,
  isChatPreset,
} = await import("../src/lib/chatPresets.ts");

test("driver preset allowlist matches the supported driver messages", () => {
  assert.deepEqual(getChatPresets("driver"), [
    "arrived",
    "running_late_2",
    "running_late_5",
    "where_are_you",
    "cant_find_you",
    "waiting",
    "starting_now",
  ]);
  for (const key of CHAT_PRESETS.driver) assert.equal(isChatPreset("driver", key), true);
});

test("passenger preset allowlist matches the supported passenger messages", () => {
  assert.deepEqual(getChatPresets("passenger"), [
    "on_my_way",
    "at_pickup",
    "running_late",
    "cant_see_you",
    "thanks",
  ]);
  for (const key of CHAT_PRESETS.passenger) assert.equal(isChatPreset("passenger", key), true);
});

test("unknown and wrong-role preset keys are rejected", () => {
  assert.equal(isChatPreset("driver", "made_up"), false);
  assert.equal(isChatPreset("driver", "on_my_way"), false);
  assert.equal(isChatPreset("passenger", "arrived"), false);
});

test("free text defaults off and only the exact true flag enables it", () => {
  assert.equal(isChatFreeTextEnabled(undefined), false);
  assert.equal(isChatFreeTextEnabled("false"), false);
  assert.equal(isChatFreeTextEnabled("TRUE"), false);
  assert.equal(isChatFreeTextEnabled("true"), true);
});
