import test from "node:test";
import assert from "node:assert/strict";

const { decidePickupPinAttempt } = await import(
  "../src/lib/pickupPinAttempts.ts"
);

test("fifth failed attempt locks the PIN for ten minutes", () => {
  const now = new Date("2026-10-14T10:00:00.000Z");
  let state = { failedAttempts: 0 };
  for (let count = 1; count < 5; count += 1) {
    const decision = decidePickupPinAttempt(state, false, now);
    assert.equal(decision.kind, "invalid");
    state = { failedAttempts: decision.failedAttempts };
  }

  const locked = decidePickupPinAttempt(state, false, now);
  assert.equal(locked.kind, "locked");
  assert.equal(locked.lockoutStarted, true);
  assert.equal(locked.failedAttempts, 5);
  assert.equal(locked.lockedUntil.getTime(), now.getTime() + 600_000);
});

test("a correct PIN is rejected while locked and allowed after expiry", () => {
  const now = new Date("2026-10-14T10:00:00.000Z");
  const lockedUntil = new Date(now.getTime() + 600_000);
  const duringLock = decidePickupPinAttempt(
    { failedAttempts: 5, lockedUntil },
    true,
    now,
  );
  assert.equal(duringLock.kind, "locked");
  assert.equal(duringLock.lockoutStarted, false);

  const afterLock = decidePickupPinAttempt(
    { failedAttempts: 5, lockedUntil },
    true,
    lockedUntil,
  );
  assert.deepEqual(afterLock, {
    kind: "accepted",
    failedAttempts: 0,
    lockedUntil: null,
  });
});

test("successful verification resets previous failed attempts", () => {
  assert.deepEqual(
    decidePickupPinAttempt({ failedAttempts: 4 }, true, new Date()),
    { kind: "accepted", failedAttempts: 0, lockedUntil: null },
  );
});
