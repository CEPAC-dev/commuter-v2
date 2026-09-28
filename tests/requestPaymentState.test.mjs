import test from "node:test";
import assert from "node:assert/strict";

const { getRequestPaymentState, wasMoneyTaken } = await import(
  "../src/lib/requestPaymentState.ts"
);
const { hasPastTrip } = await import(
  "../src/lib/admin/waitingList.ts"
);

test("waiting requests never offer payment", () => {
  const state = getRequestPaymentState({
    status: "waiting_list",
    paymentStatus: "pending",
  });

  assert.equal(state.kind, "waiting_list");
  assert.equal(state.showPayButton, false);
  assert.equal(state.statusLabelKey, "request_status.waiting_for_approval");
});

test("approved unpaid requests can be paid unless any pickup has passed", () => {
  const payable = getRequestPaymentState({
    status: "approved",
    paymentStatus: "failed",
    hasPastTrip: false,
  });
  const expired = getRequestPaymentState({
    status: "approved",
    paymentStatus: "pending",
    hasPastTrip: true,
  });

  assert.equal(payable.showPayButton, true);
  assert.equal(expired.kind, "approved_past");
  assert.equal(expired.showPayButton, false);
});

test("rejected requests never offer payment and retain a reason", () => {
  const state = getRequestPaymentState({
    status: "rejected",
    paymentStatus: "pending",
    rejectionReason: "  No vehicle available  ",
  });

  assert.equal(state.showPayButton, false);
  assert.equal(state.rejectionReason, "No vehicle available");
});

test("other request states preserve the existing pending-payment rule", () => {
  assert.equal(
    getRequestPaymentState({ status: "pending_payment", paymentStatus: "pending" })
      .showPayButton,
    true,
  );
  assert.equal(
    getRequestPaymentState({ status: "submitted", paymentStatus: "paid" })
      .showPayButton,
    false,
  );
});

test("past-trip comparison uses Cairo date and pickup-time ordering", () => {
  const now = { dateStr: "2026-09-28", timeStr: "12:30" };

  assert.equal(
    hasPastTrip(
      [
        { date: "2026-09-27", pickupTime: "23:59" },
        { date: "2026-09-29", pickupTime: "00:01" },
      ],
      now,
    ),
    true,
  );
  assert.equal(
    hasPastTrip([{ date: "2026-09-28", pickupTime: "12:30" }], now),
    false,
  );
});

test("money-taken predicate recognizes settled, refunded, and partial capture states", () => {
  for (const state of ["paid", "refunded", "partially_refunded", "captured", "success"]) {
    assert.equal(wasMoneyTaken(state), true, `${state} means money was captured`);
  }
  for (const state of ["pending", "failed", "expired", "reserved", "released", "cancelled"]) {
    assert.equal(wasMoneyTaken(state), false, `${state} does not mean money was captured`);
  }
});