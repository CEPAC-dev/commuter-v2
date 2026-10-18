import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  buildEligibleMatchTripFilter,
  evaluateTripClaim,
  isMatchingEndpointAuthorized,
  isTripClaimTransactionConflict,
  isValidCronSecret,
} = await import("../src/lib/matchingEndpointGuards.ts");
const {
  buildUnlinkedTripExpiryFilter,
  buildPendingRequestExpiryFilter,
  buildPendingTripExpiryFilter,
} = await import("../src/lib/pendingRequestHardening.ts");

const secret = "a".repeat(32);

test("matching options expose only paid submitted Trips without a Ride", async () => {
  const matchFilter = buildEligibleMatchTripFilter();
  assert.deepEqual(matchFilter, {
    status: "submitted",
    paymentStatus: "paid",
    rideId: null,
  });
  assert.notEqual(matchFilter.status, "no_show");

  const dashboard = await readFile(
    new URL("../src/app/admin/dashboard/page.tsx", import.meta.url),
    "utf8",
  );
  const matchRide = await readFile(
    new URL("../src/app/api/admin/match-ride/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(dashboard, /Trip\.find\(buildEligibleMatchTripFilter\(\)\)/);
  assert.match(matchRide, /Trip\.find\(buildEligibleMatchTripFilter\(\)\)/);
});

test("matching authorization accepts admins and configured scheduler secrets only", () => {
  assert.equal(isMatchingEndpointAuthorized({ isAdmin: true }), true);
  assert.equal(
    isMatchingEndpointAuthorized({
      isAdmin: false,
      configuredCronSecret: secret,
      providedCronSecret: secret,
    }),
    true,
  );
  assert.equal(isValidCronSecret(undefined, secret), false);
  assert.equal(isValidCronSecret("short", "short"), false);
  assert.equal(isValidCronSecret(secret, undefined), false);
  assert.equal(isValidCronSecret(secret, "b".repeat(32)), false);
  assert.equal(isMatchingEndpointAuthorized({ isAdmin: false }), false);
});

test("Trip claiming succeeds only when the unique expected set is fully claimed", () => {
  assert.deepEqual(evaluateTripClaim(["a", "b"], ["b", "a"]), {
    ok: true,
    claimedTripIds: ["b", "a"],
  });
  assert.deepEqual(evaluateTripClaim(["a", "b"], ["a"]), {
    ok: false,
    reason: "TRIP_CLAIM_CONFLICT",
    skippedCount: 1,
  });
  assert.equal(evaluateTripClaim(["a"], []).ok, false);
  assert.equal(evaluateTripClaim(["a", "a"], ["a"]).ok, false);
});

test("transaction write conflicts are returned as claim conflicts", () => {
  assert.equal(isTripClaimTransactionConflict({ code: 112 }), true);
  assert.equal(
    isTripClaimTransactionConflict({
      errorLabels: ["TransientTransactionError"],
    }),
    true,
  );
  assert.equal(isTripClaimTransactionConflict({ code: 11000 }), false);
});

test("a repeated claim and an already-linked Trip are conflicts", () => {
  const state = new Map([["trip-1", null]]);
  const attemptClaim = (tripId, rideId) => {
    if (!state.has(tripId) || state.get(tripId) !== null) return [];
    state.set(tripId, rideId);
    return [tripId];
  };

  assert.equal(
    evaluateTripClaim(["trip-1"], attemptClaim("trip-1", "ride-1")).ok,
    true,
  );
  assert.equal(
    evaluateTripClaim(["trip-1"], attemptClaim("trip-1", "ride-2")).ok,
    false,
  );
  assert.equal(state.get("trip-1"), "ride-1");
});

test("expiry filters are status-conditional and exclude Trips with a Ride", async () => {
  assert.deepEqual(buildPendingRequestExpiryFilter(new Date(0)), {
    status: "pending_payment",
    paymentStatus: { $in: ["pending", "failed"] },
    createdAt: { $lte: new Date(0) },
  });
  assert.deepEqual(buildPendingTripExpiryFilter(["request-1"]), {
    requestId: { $in: ["request-1"] },
    status: "pending_payment",
    paymentStatus: { $in: ["pending", "failed"] },
    rideId: null,
  });
  assert.deepEqual(buildUnlinkedTripExpiryFilter("submitted", { date: "x" }), {
    date: "x",
    status: "submitted",
    rideId: null,
  });

  const route = await readFile(
    new URL("../src/app/api/trips/expire/route.ts", import.meta.url),
    "utf8",
  );
  const standaloneExpiry = await readFile(
    new URL("../src/lib/services/standaloneTripExpiry.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /buildUnlinkedTripExpiryFilter\("submitted"/);
  assert.match(route, /\.\.\.nomatchFilter/);
  assert.match(route, /export async function GET[\s\S]*status: 405/);
  assert.doesNotMatch(route, /export const GET = POST/);
  for (const status of ["pending_payment", "approved", "waiting_list"]) {
    assert.match(
      standaloneExpiry,
      new RegExp(`buildUnlinkedTripExpiryFilter\\("${status}"`),
    );
  }
  assert.doesNotMatch(standaloneExpiry, /buildUnlinkedTripExpiryFilter\("no_show"/);
});
