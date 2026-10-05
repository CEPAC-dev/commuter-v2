import test from "node:test";
import assert from "node:assert/strict";

const { getCountdown, getCairoPickupAt } = await import("../src/lib/countdown.ts");

const now = new Date("2026-10-03T09:00:00.000Z");

function countdownAfter(seconds) {
  return getCountdown({
    pickupAt: new Date(now.getTime() + seconds * 1000).toISOString(),
    now,
  });
}

test(">1 day formats into day and hour values", () => {
  const result = countdownAfter(2 * 86400 + 4 * 3600 + 59 * 60);
  assert.equal(result?.days, 2);
  assert.equal(result?.hours, 4);
  assert.equal(result?.tickMs, 60000);
});

test("exactly 24 hours stays in the day format", () => {
  const result = countdownAfter(86400);
  assert.equal(result?.days, 1);
  assert.equal(result?.hours, 0);
  assert.equal(result?.tickMs, 60000);
});

test("one-hour boundary switches tick interval only below one hour", () => {
  assert.equal(countdownAfter(3600)?.tickMs, 60000);
  assert.equal(countdownAfter(3599)?.tickMs, 1000);
});

test("under one minute exposes seconds", () => {
  const result = countdownAfter(42);
  assert.equal(result?.minutes, 0);
  assert.equal(result?.seconds, 42);
  assert.equal(result?.tickMs, 1000);
});

test("pickup exactly now is reached", () => {
  const result = getCountdown({ pickupAt: now.toISOString(), now });
  assert.equal(result?.state, "reached");
  assert.equal(result?.totalSeconds, 0);
});

test("pickup one second past is reached", () => {
  const result = getCountdown({
    pickupAt: new Date(now.getTime() - 1000).toISOString(),
    now,
  });
  assert.equal(result?.state, "reached");
  assert.equal(result?.totalSeconds, 0);
});

test("pickup less than one second away is still future", () => {
  const result = getCountdown({
    pickupAt: new Date(now.getTime() + 500).toISOString(),
    now,
  });
  assert.equal(result?.state, "future");
  assert.equal(result?.totalSeconds, 1);
});

test("Cairo pickup conversion crosses midnight using the Cairo wall time", () => {
  assert.equal(
    getCairoPickupAt({ date: "2026-10-04", pickupTime: "00:15" }),
    "2026-10-03T21:15:00.000Z",
  );
});

test("invalid or missing pickup input returns null", () => {
  assert.equal(getCountdown({ pickupAt: "not a date", now }), null);
  assert.equal(getCountdown({ pickupAt: "2026-02-30T09:00:00.000Z", now }), null);
  assert.equal(getCountdown({ pickupAt: "October 3 2026", now }), null);
  assert.equal(getCountdown({ pickupAt: "", now }), null);
  assert.equal(getCountdown({ pickupAt: null, now }), null);
  assert.equal(getCairoPickupAt({ date: "2026-10-04", pickupTime: "25:61" }), null);
});