import test from "node:test";
import assert from "node:assert/strict";

const { getSharedRideStep } = await import("../src/lib/sharedRideStepper.ts");

test("waiting-list Request is at admin review", () => {
  assert.deepEqual(
    getSharedRideStep({ request: { status: "waiting_list" }, trip: { status: "pending_payment" } }),
    { step: 1, rejected: false },
  );
});

test("approved Request is at payment", () => {
  assert.deepEqual(
    getSharedRideStep({ request: { status: "approved", paymentStatus: "pending" }, trip: { status: "pending_payment" } }),
    { step: 2, rejected: false },
  );
});

test("paid searching trip remains at the payment-complete stage", () => {
  assert.deepEqual(
    getSharedRideStep({ request: { status: "submitted", paymentStatus: "paid" }, trip: { status: "submitted" } }),
    { step: 2, rejected: false },
  );
});

test("matched trip completes the progress stepper", () => {
  assert.deepEqual(
    getSharedRideStep({ request: { status: "submitted", paymentStatus: "paid" }, trip: { status: "matched" } }),
    { step: 3, rejected: false },
  );
});

test("rejected Request marks the review step as rejected", () => {
  assert.deepEqual(
    getSharedRideStep({ request: { status: "rejected" }, trip: { status: "cancelled" } }),
    { step: 1, rejected: true },
  );
});
