import test from "node:test";
import assert from "node:assert/strict";

const {
  buildPassengerTripCancellationFilter,
  getStandaloneTripCancellationMode,
  isStandaloneTripForCancellation,
  runStandaloneTripCancellation,
} = await import("../src/lib/standaloneTripCancellation.ts");

function makeTrip(overrides = {}) {
  return {
    id: "trip-1",
    status: "pending_payment",
    paymentStatus: "pending",
    requestId: null,
    ...overrides,
  };
}

function makeCancellationStore(initialTrip) {
  const state = {
    trip: { ...initialTrip },
    refunds: [],
    promoReleases: 0,
    paymentCancellations: 0,
    walletReleases: 0,
  };
  const store = {
    async cancelUnpaidTrip(expectedTrip) {
      if (
        state.trip.status !== expectedTrip.status ||
        state.trip.paymentStatus !== expectedTrip.paymentStatus ||
        !["pending", "failed"].includes(state.trip.paymentStatus)
      ) {
        return null;
      }
      state.trip.status = "cancelled";
      state.trip.paymentStatus = expectedTrip.paymentStatus;
      state.promoReleases += 1;
      return { ...state.trip };
    },
    async cancelPaidTrip(expectedTrip, _reason, evaluation) {
      if (
        state.trip.status !== expectedTrip.status ||
        state.trip.paymentStatus !== "paid"
      ) {
        return null;
      }
      state.trip.status = "cancelled";
      if (evaluation.refundAmount > 0) {
        state.refunds.push({
          tripId: expectedTrip.id,
          refundAmount: evaluation.refundAmount,
          tier: evaluation.tierLabel,
        });
      }
      return { ...state.trip };
    },
  };
  return { state, store };
}

const noRefundEvaluation = {
  tierLabel: "unpaid",
  refundPercent: 0,
  penaltyPercent: 0,
  refundAmount: 0,
  retainedAmount: 0,
};

test("cancels an unpaid standalone Trip, payment and reservation without refund", async () => {
  const { state, store } = makeCancellationStore(makeTrip({ paymentStatus: "failed" }));
  const result = await runStandaloneTripCancellation({
    trip: state.trip,
    reason: "Passenger request",
    evaluation: noRefundEvaluation,
    store,
    async cancelPayments() {
      state.paymentCancellations += 1;
      state.walletReleases += 1;
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.kind, "unpaid");
  assert.equal(state.trip.status, "cancelled");
  assert.equal(state.refunds.length, 0);
  assert.equal(state.paymentCancellations, 1);
  assert.equal(state.walletReleases, 1);
  assert.equal(state.promoReleases, 1);
});

test("cancels a waiting-list standalone Trip without payment or refund", async () => {
  const initial = makeTrip({
    status: "waiting_list",
    paymentStatus: "pending",
  });
  const { state, store } = makeCancellationStore(initial);
  assert.deepEqual(getStandaloneTripCancellationMode(initial), { kind: "unpaid" });
  const result = await runStandaloneTripCancellation({
    trip: initial,
    reason: "Passenger request",
    evaluation: noRefundEvaluation,
    store,
    async cancelPayments() {
      state.paymentCancellations += 1;
    },
  });

  assert.equal(result.ok, true);
  assert.equal(state.trip.status, "cancelled");
  assert.equal(state.refunds.length, 0);
});

test("a paid standalone Trip creates the policy refund and does not cancel a Payment", async () => {
  const initial = makeTrip({ status: "submitted", paymentStatus: "paid" });
  const { state, store } = makeCancellationStore(initial);
  const result = await runStandaloneTripCancellation({
    trip: initial,
    reason: "Passenger request",
    evaluation: {
      tierLabel: "two_to_three_days_before",
      refundPercent: 90,
      penaltyPercent: 10,
      refundAmount: 90,
      retainedAmount: 10,
    },
    store,
    async cancelPayments() {
      state.paymentCancellations += 1;
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(state.refunds, [
    {
      tripId: "trip-1",
      refundAmount: 90,
      tier: "two_to_three_days_before",
    },
  ]);
  assert.equal(state.paymentCancellations, 0);
});

test("a second cancellation is refused without changing state again", async () => {
  const { state, store } = makeCancellationStore(makeTrip());
  const first = await runStandaloneTripCancellation({
    trip: state.trip,
    reason: "Passenger request",
    evaluation: noRefundEvaluation,
    store,
    async cancelPayments() {
      state.paymentCancellations += 1;
    },
  });

  test("no-show Trip cannot be passenger-cancelled", () => {
    assert.deepEqual(
      getStandaloneTripCancellationMode(
        makeTrip({ status: "no_show", paymentStatus: "paid" }),
      ),
      {
        kind: "blocked",
        httpStatus: 409,
        errorCode: "TRIP_NO_SHOW",
        error: "Trips marked as not present cannot be cancelled.",
      },
    );
  });
  const tripAfterFirst = { ...state.trip };
  const second = await runStandaloneTripCancellation({
    trip: state.trip,
    reason: "Retry",
    evaluation: noRefundEvaluation,
    store,
    async cancelPayments() {
      state.paymentCancellations += 1;
    },
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.errorCode, "TRIP_ALREADY_CANCELLED");
  assert.deepEqual(state.trip, tripAfterFirst);
  assert.equal(state.paymentCancellations, 1);
  assert.equal(state.promoReleases, 1);
});

test("passenger cancellation is scoped to the owning user", () => {
  assert.deepEqual(buildPassengerTripCancellationFilter("trip-1", "owner-id"), {
    _id: "trip-1",
    userId: "owner-id",
  });
});

test("legacy Request-backed Trips stay on the parent cancellation path", () => {
  assert.equal(isStandaloneTripForCancellation(makeTrip()), true);
  assert.equal(
    isStandaloneTripForCancellation(makeTrip({ requestId: "legacy-request-id" })),
    false,
  );
});
