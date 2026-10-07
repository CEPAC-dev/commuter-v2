import test from "node:test";
import assert from "node:assert/strict";

const {
  buildHistoryTripMatch,
  normalizeTripNumber,
  parseHistoryParams,
  pickupFallsInDateRange,
  requestGroupMatchesDateRange,
} = await import("../src/lib/tripHistoryFilters.ts");

test("history params parse filters and normalize valid pages", () => {
  assert.deepEqual(
    parseHistoryParams({ q: "#857", from: "2026-09-01", to: "2026-09-30", status: "completed", page: "2" }),
    {
      q: "#857",
      tripNumber: 857,
      from: "2026-09-01",
      to: "2026-09-30",
      status: "completed",
      page: 2,
      error: null,
    },
  );
});

test("invalid numbers, dates, and reversed ranges return friendly error codes", () => {
  assert.equal(parseHistoryParams({ q: "85x" }).error, "invalid_trip_number");
  assert.equal(parseHistoryParams({ from: "2026-02-30" }).error, "invalid_date");
  assert.equal(
    parseHistoryParams({ from: "2026-10-10", to: "2026-10-01" }).error,
    "from_after_to",
  );
  assert.equal(parseHistoryParams({ page: "oops" }).page, 1);
});

test("trip number normalization tolerates an optional hash and whitespace", () => {
  assert.equal(normalizeTripNumber("857"), 857);
  assert.equal(normalizeTripNumber(" #857 "), 857);
  assert.equal(normalizeTripNumber(""), null);
  assert.equal(normalizeTripNumber("#8x"), null);
});

test("Cairo pickup date boundaries are inclusive through 23:59 and exclude next midnight", () => {
  const range = { from: "2026-10-01", to: "2026-10-07" };
  assert.equal(pickupFallsInDateRange({ date: "2026-10-01", pickupTime: "00:00" }, range), true);
  assert.equal(pickupFallsInDateRange({ date: "2026-10-07", pickupTime: "23:59" }, range), true);
  assert.equal(pickupFallsInDateRange({ date: "2026-10-08", pickupTime: "00:00" }, range), false);
  assert.equal(pickupFallsInDateRange({ date: "2026-09-30", pickupTime: "23:59" }, range), false);
});

test("a Request matches a date range when any trip pickup is in range", () => {
  assert.equal(
    requestGroupMatchesDateRange(
      [
        { date: "2026-09-29", pickupTime: "20:00" },
        { date: "2026-10-04", pickupTime: "08:30" },
        { date: "2026-10-12", pickupTime: "08:30" },
      ],
      { from: "2026-10-01", to: "2026-10-07" },
    ),
    true,
  );
});

test("history match construction always scopes by owner", () => {
  assert.deepEqual(
    buildHistoryTripMatch("owner-a", { tripNumber: 857, from: "2026-10-01", to: "2026-10-07" }),
    {
      userId: "owner-a",
      tripNumber: 857,
      date: { $gte: "2026-10-01", $lte: "2026-10-07" },
    },
  );
  assert.equal(buildHistoryTripMatch("owner-a", { tripNumber: 857 }).userId, "owner-a");
});