import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { getAdminRideCancellationPlan } = await import(
  "../src/lib/rideIncidentAdminGuards.ts"
);

test("admin cancellation resets only unpicked Trips", () => {
  const plan = getAdminRideCancellationPlan([
    { id: "matched", status: "matched", pickupStatus: "waiting" },
    { id: "confirmed", status: "confirmed", pickupStatus: "waiting" },
    { id: "active-waiting", status: "active", pickupStatus: "waiting" },
    { id: "boarding", status: "active", pickupStatus: "boarding" },
    { id: "on-board", status: "active", pickupStatus: "on_board" },
    { id: "picked-up", status: "active", pickupStatus: "picked_up" },
    { id: "dropped-off", status: "completed", pickupStatus: "dropped_off" },
    { id: "completed", status: "completed", pickupStatus: "waiting" },
    { id: "no-show", status: "no_show", pickupStatus: "waiting" },
    { id: "ride-no-show", status: "confirmed", pickupStatus: "no_show" },
    { id: "cancelled", status: "cancelled", pickupStatus: "cancelled" },
  ]);

  assert.deepEqual(plan.resetTripIds, [
    "matched",
    "confirmed",
    "active-waiting",
  ]);
  assert.deepEqual(plan.preservedTripIds, [
    "boarding",
    "on-board",
    "picked-up",
    "dropped-off",
    "completed",
    "no-show",
    "ride-no-show",
    "cancelled",
  ]);
});

test("plain admin cancellation returns preserved Trip IDs and retains notifications", async () => {
  const service = await readFile(
    new URL("../src/lib/services/rideService.ts", import.meta.url),
    "utf8",
  );
  const route = await readFile(
    new URL("../src/app/api/ride/[id]/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(service, /getAdminRideCancellationPlan/);
  assert.match(
    service,
    /_id: \{ \$in: tripIds \},\s*status: \{ \$ne: "no_show" \}/,
  );
  assert.match(
    service,
    /status: "no_show"[\s\S]*?\$set: \{ rideId: null, seatNumbers: \[\] \}/,
  );
  assert.match(service, /rideId: ride\._id,\s*status: \{ \$in: \["matched", "confirmed", "active"\] \}/);
  assert.match(service, /notifyRideCancellationPassengers/);
  assert.match(service, /return \{ ride, preservedTripIds \}/);
  assert.match(route, /preservedTripIds: result\.preservedTripIds/);
});

test("ride assignment conditionally claims only paid submitted Trips", async () => {
  const service = await readFile(
    new URL("../src/lib/services/rideService.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    service,
    /Trip\.findOneAndUpdate\(\s*\{\s*_id: passenger\.tripId,\s*status: "submitted",\s*paymentStatus: "paid",\s*rideId: null,\s*\}/,
  );
  assert.match(service, /if \(!trip\) throw new Error\("Trip is no longer eligible for ride assignment"\)/);
});

test("admin no-show count endpoint authenticates, avoids passenger data, and disables caching", async () => {
  const source = await readFile(
    new URL("../src/app/api/admin/drivers/no-shows/route.ts", import.meta.url),
    "utf8",
  );
  const authSource = await readFile(
    new URL("../src/lib/middleware/adminAuth.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /const authorization = await adminAuth\(\);/);
  assert.match(
    source,
    /if \(!authorization\.authorized\)[\s\S]*?return authorization\.response;/,
  );
  assert.match(authSource, /user\.role !== "admin"/);
  assert.match(source, /"Cache-Control": "no-store"/);
  assert.match(source, /noShowAt: \{ \$gte: since \}/);
  assert.match(source, /rideIds: \{ \$addToSet: "\$rideId" \}/);
  assert.doesNotMatch(source, /passenger|phone/i);
});
