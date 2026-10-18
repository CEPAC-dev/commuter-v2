import test from "node:test";
import assert from "node:assert/strict";

const {
  CHAT_FREE_TEXT_STRIKE_LIMIT,
  CHAT_FREE_TEXT_STRIKE_WINDOW_MS,
  isChatFreeTextAllowed,
  isChatFreeTextSuspended,
} = await import("../src/lib/chatFreeTextStrikes.ts");

test("blocked-attempt counter suspends free text on the third strike", () => {
  assert.equal(CHAT_FREE_TEXT_STRIKE_LIMIT, 3);
  assert.equal(isChatFreeTextSuspended(0), false);
  assert.equal(isChatFreeTextSuspended(1), false);
  assert.equal(isChatFreeTextSuspended(2), false);
  assert.equal(isChatFreeTextSuspended(3), true);
  assert.equal(isChatFreeTextSuspended(4), true);
});

test("strike counter is scoped to the 24-hour window", () => {
  assert.equal(CHAT_FREE_TEXT_STRIKE_WINDOW_MS, 24 * 60 * 60 * 1000);
});

test("free text requires feature enabled, write access, and fewer than three strikes", () => {
  assert.equal(
    isChatFreeTextAllowed({ enabled: true, canWrite: true, blockedCount: 0 }),
    true,
  );
  assert.equal(
    isChatFreeTextAllowed({ enabled: false, canWrite: true, blockedCount: 0 }),
    false,
  );
  assert.equal(
    isChatFreeTextAllowed({ enabled: true, canWrite: false, blockedCount: 0 }),
    false,
  );
  assert.equal(
    isChatFreeTextAllowed({ enabled: true, canWrite: true, blockedCount: 3 }),
    false,
  );
});
