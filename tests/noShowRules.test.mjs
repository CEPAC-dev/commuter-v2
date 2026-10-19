import test from "node:test";
import assert from "node:assert/strict";

const { canMarkNoShow, DEFAULT_NO_SHOW_MIN_WAIT_MINUTES } = await import(
  "../src/lib/noShowRules.ts"
);

const arrival = new Date("2026-01-01T12:00:00.000Z");
const waitMs = DEFAULT_NO_SHOW_MIN_WAIT_MINUTES * 60_000;

test("no-show wait defaults to five minutes and rejects a missing arrival", () => {
  assert.equal(DEFAULT_NO_SHOW_MIN_WAIT_MINUTES, 5);
  assert.deepEqual(
    canMarkNoShow({
      arrivedAt: null,
      now: arrival,
      minWaitMinutes: 5,
    }),
    { allowed: false, remainingSeconds: 300 },
  );
});

test("no-show is blocked before the wait boundary", () => {
  assert.deepEqual(
    canMarkNoShow({
      arrivedAt: arrival,
      now: new Date(arrival.getTime() + waitMs - 1),
      minWaitMinutes: 5,
    }),
    { allowed: false, remainingSeconds: 1 },
  );
});

test("no-show is allowed exactly at and after the wait boundary", () => {
  for (const elapsedMs of [waitMs, waitMs + 1]) {
    assert.deepEqual(
      canMarkNoShow({
        arrivedAt: arrival,
        now: new Date(arrival.getTime() + elapsedMs),
        minWaitMinutes: 5,
      }),
      { allowed: true, remainingSeconds: 0 },
    );
  }
});

test("invalid arrival values do not authorize no-show", () => {
  assert.deepEqual(
    canMarkNoShow({
      arrivedAt: "not-a-date",
      now: arrival,
      minWaitMinutes: 5,
    }),
    { allowed: false, remainingSeconds: 300 },
  );
});

test("the wait duration must be a positive integer", () => {
  for (const minWaitMinutes of [0, -1, 1.5, Number.NaN]) {
    assert.throws(
      () =>
        canMarkNoShow({
          arrivedAt: arrival,
          now: arrival,
          minWaitMinutes,
        }),
      RangeError,
    );
  }
});
