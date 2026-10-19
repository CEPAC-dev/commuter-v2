import test from "node:test";
import assert from "node:assert/strict";

const { buildTripTabView } = await import("../src/lib/tripTabView.ts");
const { getDisplayStatus } = await import("../src/lib/statusDisplay.ts");
const now = new Date("2026-10-03T09:00:00.000Z");

function rows() {
  return [
    { id: "wait-1", requestId: "waiting", isStandalone: false, status: "pending_payment", parentRequestStatus: "waiting_list", parentPaymentStatus: "pending", date: "2026-10-04", pickupTime: "09:00" },
    { id: "wait-2", requestId: "waiting", isStandalone: false, status: "pending_payment", parentRequestStatus: "waiting_list", parentPaymentStatus: "pending", date: "2026-10-05", pickupTime: "09:00" },
    { id: "ready-1", requestId: "ready", isStandalone: false, status: "pending_payment", parentRequestStatus: "approved", parentPaymentStatus: "pending", date: "2026-10-06", pickupTime: "09:00" },
    { id: "ready-2", requestId: "ready", isStandalone: false, status: "pending_payment", parentRequestStatus: "approved", parentPaymentStatus: "pending", date: "2026-10-07", pickupTime: "09:00" },
    { id: "single-wait", requestId: "single-wait", isStandalone: true, status: "waiting_list", paymentStatus: "pending", date: "2026-10-04", pickupTime: "09:00" },
    { id: "single-ready", requestId: "single-ready", isStandalone: true, status: "approved", paymentStatus: "failed", date: "2026-10-05", pickupTime: "09:00" },
    { id: "paid-1", requestId: "paid", isStandalone: false, status: "submitted", parentRequestStatus: "submitted", parentPaymentStatus: "paid", date: "2026-10-08", pickupTime: "09:00" },
    { id: "paid-2", requestId: "paid", isStandalone: false, status: "active", parentRequestStatus: "active", parentPaymentStatus: "paid", date: "2026-10-09", pickupTime: "09:00" },
  ];
}

test("Pending groups unpaid Requests once and keeps pending single Trips individual", () => {
  const view = buildTripTabView(rows(), "pending", now);
  assert.equal(view.counts.pending, 4);
  assert.deepEqual(Object.keys(view.counts).sort(), [
    "all",
    "ongoing",
    "pending",
    "upcoming",
  ]);
  assert.deepEqual(
    view.items.map((item) =>
      item.kind === "request" ? `request:${item.requestId}` : `trip:${item.trip.id}`,
    ),
    [
      "trip:single-ready",
      "request:ready",
      "request:waiting",
      "trip:single-wait",
    ],
  );
  assert.equal(
    view.items.find((item) => item.kind === "request" && item.requestId === "waiting").trips.length,
    2,
  );
});

test("one-day unpaid Requests remain individual Pending trips", () => {
  const view = buildTripTabView(
    [
      { id: "one-day", requestId: "request", isStandalone: false, status: "pending_payment", parentRequestStatus: "approved", parentPaymentStatus: "pending", date: "2026-10-04", pickupTime: "09:00" },
    ],
    "pending",
    now,
  );
  assert.equal(view.counts.pending, 1);
  assert.equal(view.items[0].kind, "trip");
  assert.equal(view.items[0].trip.id, "one-day");
});

test("approval-waiting groups and single trips add no payable Pending items", () => {
  const view = buildTripTabView(
    [
      { id: "waiting-1", requestId: "request", isStandalone: false, status: "pending_payment", parentRequestStatus: "waiting_list", parentPaymentStatus: "pending", date: "2026-10-04", pickupTime: "09:00" },
      { id: "waiting-2", requestId: "request", isStandalone: false, status: "pending_payment", parentRequestStatus: "waiting_list", parentPaymentStatus: "pending", date: "2026-10-05", pickupTime: "09:00" },
      { id: "waiting-single", requestId: "single", isStandalone: true, status: "waiting_list", paymentStatus: "pending", date: "2026-10-04", pickupTime: "09:00" },
    ],
    "pending",
    now,
  );
  assert.equal(view.counts.pending, 2);
  assert.equal(view.payablePendingCount, 0);
  assert.deepEqual(view.items.map((item) => item.kind), ["request", "trip"]);
});

test("payable Pending count uses the existing canPay rule for groups and single Trips", () => {
  const trips = rows();
  const expectedPayableCount = new Set(
    trips
      .filter((trip) =>
        getDisplayStatus({
          request: {
            status: trip.parentRequestStatus ?? trip.status,
            paymentStatus: trip.parentPaymentStatus ?? trip.paymentStatus,
            rejectionReason: trip.rejectionReason,
            hasPastTrip: trip.hasPastTrip,
          },
          trip,
          now,
        }).canPay,
      )
      .map((trip) => trip.requestId),
  ).size;
  const view = buildTripTabView(trips, "pending", now);
  assert.equal(view.payablePendingCount, expectedPayableCount);
  assert.equal(view.payablePendingCount, 2);
});

test("unpaid Request children stay out of All, Upcoming and Ongoing; paid trips stay normal", () => {
  const trips = rows();
  const all = buildTripTabView(trips, "all", now);
  assert.deepEqual(all.items.map((item) => item.kind === "trip" ? item.trip.id : item.requestId), [
    "single-wait",
    "single-ready",
    "paid-1",
    "paid-2",
  ]);
  assert.equal(all.items.some((item) => item.kind === "request"), false);
  assert.equal(buildTripTabView(trips, "upcoming", now).items.some(
    (item) => item.kind === "trip" && item.trip.requestId === "waiting",
  ), false);
  assert.equal(buildTripTabView(trips, "ongoing", now).items.some(
    (item) => item.kind === "trip" && item.trip.requestId === "ready",
  ), false);
  const pending = buildTripTabView(trips, "pending", now);
  assert.equal(pending.items.some(
    (item) => item.kind === "trip" && item.trip.parentPaymentStatus === "paid",
  ), false);
});

test("standalone pending Trips retain one pay action per Trip", () => {
  const trips = [
    { id: "wait", requestId: "wait", isStandalone: true, status: "waiting_list", paymentStatus: "pending", date: "2026-10-04", pickupTime: "09:00" },
    { id: "approved", requestId: "approved", isStandalone: true, status: "approved", paymentStatus: "failed", date: "2026-10-05", pickupTime: "09:00" },
    { id: "pending", requestId: "pending", isStandalone: true, status: "pending_payment", paymentStatus: "pending", date: "2026-10-06", pickupTime: "09:00" },
  ];
  const view = buildTripTabView(trips, "pending", now);
  assert.equal(view.counts.pending, 3);
  assert.deepEqual(view.items.map((item) => item.kind), ["trip", "trip", "trip"]);
  assert.deepEqual(view.items.map((item) => item.trip.id), ["approved", "pending", "wait"]);
});
