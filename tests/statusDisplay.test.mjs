import test from "node:test";
import assert from "node:assert/strict";

const { getDisplayStatus } = await import("../src/lib/statusDisplay.ts");
const now = new Date("2026-10-03T09:00:00.000Z");

test("private requests display payment state using the existing pay rule", () => {
  const status = getDisplayStatus({
    request: { status: "pending_payment", paymentStatus: "pending" },
    now,
  });
  assert.equal(status.key, "status.pending_payment");
  assert.equal(status.canPay, true);
});

test("shared requests created with the waiting-list toggle on stay waiting", () => {
  const status = getDisplayStatus({
    request: { status: "waiting_list", paymentStatus: "pending" },
    trip: { status: "pending_payment", date: "2026-10-05", pickupTime: "09:00" },
    now,
  });
  assert.equal(status.key, "status.waiting_list");
  assert.equal(status.canPay, false);
});

test("shared requests created with the toggle off use private payment display", () => {
  const status = getDisplayStatus({
    request: { status: "pending_payment", paymentStatus: "failed" },
    trip: { status: "pending_payment", date: "2026-10-05", pickupTime: "09:00" },
    now,
  });
  assert.equal(status.key, "status.pending_payment");
  assert.equal(status.canPay, true);
});

test("existing waiting-list requests remain waiting regardless of later toggle changes", () => {
  const status = getDisplayStatus({
    request: { status: "waiting_list", paymentStatus: "pending" },
    trip: { status: "pending_payment", date: "2026-10-05", pickupTime: "09:00" },
    now,
  });
  assert.equal(status.key, "status.waiting_list");
});

test("approved request with any past pickup displays expired without payment", () => {
  const status = getDisplayStatus({
    request: {
      status: "approved",
      paymentStatus: "pending",
      trips: [{ date: "2026-10-02", pickupTime: "10:00" }],
    },
    trip: { status: "pending_payment", date: "2026-10-05", pickupTime: "09:00" },
    now,
  });
  assert.equal(status.key, "status.expired");
  assert.equal(status.canPay, false);
});

test("ordinary pending-payment trip with a past pickup displays expired", () => {
  const status = getDisplayStatus({
    request: { status: "pending_payment", paymentStatus: "pending" },
    trip: { status: "pending_payment", date: "2026-10-02", pickupTime: "10:00" },
    now,
  });
  assert.equal(status.key, "status.expired");
  assert.equal(status.canPay, false);
});

test("nomatch status has a safe display label and no refund badge for none", () => {
  const status = getDisplayStatus({
    request: { status: "submitted", paymentStatus: "paid" },
    trip: {
      status: "nomatch",
      date: "2026-10-05",
      pickupTime: "09:00",
      cancellation: { refundStatus: "none" },
    },
    now,
  });
  assert.equal(status.key, "status.no_ride_found");
  assert.equal(status.showRefundBadge, false);
});

test("cancelled by admin rejection displays rejected and its reason", () => {
  const status = getDisplayStatus({
    request: { status: "submitted", paymentStatus: "paid" },
    trip: {
      status: "cancelled",
      cancelledBy: "admin_rejected",
      cancelReason: "Not eligible",
    },
    now,
  });
  assert.equal(status.key, "request_status.rejected");
  assert.equal(status.secondaryText, "Not eligible");
});

test("unknown statuses fall back to a non-empty safe label", () => {
  const status = getDisplayStatus({
    request: { status: "legacy_state", paymentStatus: "pending" },
    trip: { status: "legacy_trip_state" },
    now,
  });
  assert.equal(status.key, "status.unknown");
  assert.equal(status.key.length > 0, true);
});

test("refunded trips have a label while none refund state has no refund badge", () => {
  const status = getDisplayStatus({
    request: { status: "submitted", paymentStatus: "paid" },
    trip: {
      status: "refunded",
      cancellation: { refundStatus: "none" },
    },
    now,
  });
  assert.equal(status.key, "status.refunded");
  assert.equal(status.showRefundBadge, false);
});

test("trip display preserves current cancellation and rating eligibility", () => {
  const cancellable = getDisplayStatus({
    request: { status: "submitted", paymentStatus: "paid" },
    trip: { status: "active" },
    now,
  });
  const rateable = getDisplayStatus({
    request: { status: "completed", paymentStatus: "paid" },
    trip: { status: "completed" },
    now,
  });
  assert.equal(cancellable.canCancel, true);
  assert.equal(rateable.canRate, true);
});