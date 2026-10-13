import test from "node:test";
import assert from "node:assert/strict";

const {
  isStandaloneTripPayable,
  isStandaloneTripRecord,
  isApprovedTripPickupPast,
  resolvePayableBookingWith,
} = await import("../src/lib/payments/resolvePayableBookingRecord.ts");
const {
  fullyRefundedTripUpdate,
  settleTripOnce,
} = await import("../src/lib/payments/tripSettlement.ts");
const { buildSettlementRequestFilter } = await import(
  "../src/lib/pendingRequestHardening.ts"
);
const {
  canTripTakePaymentFailure,
  isInFlightPaymentStatus,
  runStandalonePaymentFailure,
  runStandaloneSettlementSteps,
  shouldResetFailedTripForRetry,
} = await import("../src/lib/payments/settlementAttempt.ts");

test("standalone pending-payment or approved trips with pending or failed payment are payable", () => {
  assert.equal(
    isStandaloneTripPayable({
      status: "pending_payment",
      paymentStatus: "pending",
    }),
    true,
  );
  assert.equal(
    isStandaloneTripPayable({ status: "approved", paymentStatus: "pending" }),
    true,
  );
  assert.equal(
    isStandaloneTripPayable({ status: "pending_payment", paymentStatus: "failed" }),
    true,
  );
  assert.equal(
    isStandaloneTripPayable({ status: "approved", paymentStatus: "failed" }),
    true,
  );
  for (const status of ["waiting_list", "rejected", "cancelled", "time_out"]) {
    assert.equal(
      isStandaloneTripPayable({ status, paymentStatus: "pending" }),
      false,
      `${status} must not be payable`,
    );
  }
  for (const paymentStatus of ["paid", "refunded", "expired"]) {
    assert.equal(
      isStandaloneTripPayable({ status: "approved", paymentStatus }),
      false,
      `${paymentStatus} must not be payable`,
    );
  }
});

test("failed Trip retries through the conditional claim and settles paid", async () => {
  let trip = { status: "approved", paymentStatus: "failed" };
  assert.equal(isStandaloneTripPayable(trip), true);

  const result = await settleTripOnce(
    async () => {
      if (trip.paymentStatus === "paid") return null;
      trip = { status: "submitted", paymentStatus: "paid" };
      return trip;
    },
    async () => trip,
    async () => {},
  );
  assert.equal(result, "settled");
  assert.deepEqual(trip, { status: "submitted", paymentStatus: "paid" });
});

test("approved Trip past-pickup rule uses Cairo date and pickup comparison only", () => {
  const now = { dateStr: "2026-10-11", timeStr: "09:00" };
  const trip = { date: "2026-10-11", pickupTime: "08:59" };

  assert.equal(isApprovedTripPickupPast({ ...trip, status: "approved" }, now), true);
  assert.equal(isApprovedTripPickupPast({ ...trip, status: "pending_payment" }, now), false);
  assert.equal(
    isApprovedTripPickupPast(
      { date: "2026-10-12", pickupTime: "08:00", status: "approved" },
      now,
    ),
    false,
  );
});

test("resolver excludes legacy child Trips and falls back to their Request", async () => {
  const childTrip = {
    requestId: "parent-request-id",
    priceEgp: 300,
    paymentStatus: "pending",
    status: "pending_payment",
  };
  assert.equal(isStandaloneTripRecord(childTrip), false);
  let requestLookups = 0;
  const resolved = await resolvePayableBookingWith(
    async () => childTrip,
    async () => {
      requestLookups += 1;
      return {
        amountEgp: 900,
        paymentStatus: "pending",
        status: "approved",
      };
    },
  );

  assert.equal(requestLookups, 1);
  assert.equal(resolved.kind, "request");
  assert.equal(resolved.amountEgp, 900);
});

test("legacy Request remains payable and can be conditionally settled", async () => {
  const request = {
    _id: "legacy-request",
    amountEgp: 900,
    paymentStatus: "pending",
    status: "approved",
  };
  const resolved = await resolvePayableBookingWith(
    async () => null,
    async () => request,
  );
  assert.equal(resolved?.kind, "request");
  assert.equal(resolved?.amountEgp, 900);

  let paymentStatus = resolved?.paymentStatus;
  const settlementFilter = buildSettlementRequestFilter(resolved.doc._id);
  assert.equal(settlementFilter._id, request._id);
  const settled =
    settlementFilter.paymentStatus.$in.includes(paymentStatus) &&
    !settlementFilter.status.$nin.includes(resolved.status);
  assert.equal(settled, true);
  paymentStatus = settled ? "paid" : paymentStatus;
  assert.equal(paymentStatus, "paid");
});

test("standalone Trip resolver charges Trip.priceEgp and never loads Request", async () => {
  const resolved = await resolvePayableBookingWith(
    async () => ({
      requestId: undefined,
      priceEgp: 375,
      paymentStatus: "pending",
      status: "approved",
    }),
    async () => {
      assert.fail("Request fallback should not run for a standalone Trip");
    },
  );
  assert.equal(resolved.kind, "trip");
  assert.equal(resolved.amountEgp, 375);
});

test("wallet-only and Kashier settlement effects run only after an atomic claim", async () => {
  for (const paymentPath of ["wallet-only", "kashier"]) {
    const events = [];
    let state = { paymentStatus: "pending", status: "approved" };
    const result = await settleTripOnce(
      async () => {
        if (state.paymentStatus === "paid") return null;
        state = { paymentStatus: "paid", status: "submitted" };
        return state;
      },
      async () => state,
      async () => events.push(`${paymentPath}:capture-and-notify`),
    );
    assert.equal(result, "settled");
    assert.deepEqual(events, [`${paymentPath}:capture-and-notify`]);
  }
});

test("webhook replay cannot settle or notify twice", async () => {
  let state = { paymentStatus: "pending", status: "pending_payment" };
  let notifications = 0;
  const claim = async () => {
    if (state.paymentStatus === "paid") return null;
    state = { paymentStatus: "paid", status: "submitted" };
    return state;
  };
  const read = async () => state;
  const afterClaim = async () => {
    notifications += 1;
  };

  assert.equal(await settleTripOnce(claim, read, afterClaim), "settled");
  assert.equal(await settleTripOnce(claim, read, afterClaim), "already_paid");
  assert.equal(notifications, 1);
});

test("callback and webhook racing settle and notify once", async () => {
  let state = { paymentStatus: "pending", status: "pending_payment" };
  let sideEffects = 0;
  const claim = async () => {
    if (state.paymentStatus === "paid") return null;
    state = { paymentStatus: "paid", status: "submitted" };
    return state;
  };
  const settle = () =>
    settleTripOnce(claim, async () => state, async () => {
      await Promise.resolve();
      sideEffects += 1;
    });

  const outcomes = await Promise.all([settle(), settle()]);
  assert.deepEqual(outcomes.sort(), ["already_paid", "settled"]);
  assert.equal(sideEffects, 1);
});

test("waiting-list and rejected trips do not settle", async () => {
  let sideEffects = 0;
  const waiting = await settleTripOnce(
    async () => null,
    async () => ({ paymentStatus: "pending", status: "waiting_list" }),
    async () => {
      sideEffects += 1;
    },
  );
  assert.equal(waiting, "missing");
  assert.equal(
    await settleTripOnce(
      async () => null,
      async () => ({ paymentStatus: "pending", status: "rejected" }),
      async () => {},
    ),
    "blocked",
  );
  assert.equal(sideEffects, 0);
});

test("full Trip refunds set both Trip statuses; partial refunds do not", () => {
  assert.deepEqual(fullyRefundedTripUpdate(375, 375), {
    status: "refunded",
    paymentStatus: "refunded",
  });
  assert.equal(fullyRefundedTripUpdate(374, 375), null);
});

test("failed standalone payment retry resets only an unpaid pending or approved Trip", () => {
  assert.equal(shouldResetFailedTripForRetry("pending_payment", "failed"), true);
  assert.equal(shouldResetFailedTripForRetry("approved", "failed"), true);
  assert.equal(shouldResetFailedTripForRetry("waiting_list", "failed"), false);
  assert.equal(shouldResetFailedTripForRetry("submitted", "failed"), false);
  assert.equal(shouldResetFailedTripForRetry("approved", "paid"), false);
});

test("late failure from an older attempt cannot fail a retrying Trip", () => {
  const oldPayment = { overallStatus: "failed" };
  const retryPayment = { overallStatus: "kashier_pending" };
  const trip = { status: "approved", paymentStatus: "pending" };

  assert.equal(isInFlightPaymentStatus(oldPayment.overallStatus), false);
  assert.equal(isInFlightPaymentStatus(retryPayment.overallStatus), true);
  assert.equal(canTripTakePaymentFailure(trip.status, trip.paymentStatus), true);
  assert.equal(canTripTakePaymentFailure("submitted", "paid"), false);
});

test("failure racing a successful claim does not release or fail either record", async () => {
  const state = {
    tripStatus: "submitted",
    tripPaymentStatus: "paid",
    paymentStatus: "paid",
    reservationStatus: "captured",
  };
  let released = false;
  let tripFailed = false;
  let timelineWritten = false;

  const result = await runStandalonePaymentFailure({
    paymentInFlight: isInFlightPaymentStatus(state.paymentStatus),
    tripStatus: state.tripStatus,
    tripPaymentStatus: state.tripPaymentStatus,
    markPaymentFailed: async () => {
      state.paymentStatus = "failed";
      return true;
    },
    releaseWallet: async () => {
      released = true;
      state.reservationStatus = "released";
    },
    hasOtherInFlightPayment: async () => false,
    markTripFailed: async () => {
      tripFailed = true;
    },
    recordIgnored: async () => {
      timelineWritten = true;
    },
  });

  assert.equal(result, "ignored");
  assert.equal(timelineWritten, true);
  assert.equal(released, false);
  assert.equal(tripFailed, false);
  assert.equal(state.paymentStatus, "paid");
  assert.equal(state.reservationStatus, "captured");
});

test("failure only marks a Trip failed when no newer Payment is in flight", async () => {
  const state = { paymentStatus: "kashier_pending", tripPaymentStatus: "pending" };
  let released = false;
  let tripFailed = false;
  const result = await runStandalonePaymentFailure({
    paymentInFlight: true,
    tripStatus: "approved",
    tripPaymentStatus: "pending",
    markPaymentFailed: async () => {
      state.paymentStatus = "failed";
      return true;
    },
    releaseWallet: async () => {
      released = true;
    },
    hasOtherInFlightPayment: async () => true,
    markTripFailed: async () => {
      tripFailed = true;
      state.tripPaymentStatus = "failed";
    },
    recordIgnored: async () => {},
  });

  assert.equal(result, "failed");
  assert.equal(released, true);
  assert.equal(tripFailed, false);
  assert.equal(state.tripPaymentStatus, "pending");
});

test("settlement transaction rolls back each failing step and replays without double capture", async () => {
  for (const failAfter of ["capture", "payment", "ledger"]) {
    const state = {
      tripStatus: "approved",
      tripPaymentStatus: "pending",
      paymentStatus: "kashier_pending",
      reservationStatus: "pending",
      captureCount: 0,
      ledgerCount: 0,
    };

    const runTransaction = async (failurePoint) => {
      const before = structuredClone(state);
      try {
        state.tripStatus = "submitted";
        state.tripPaymentStatus = "paid";
        await runStandaloneSettlementSteps({
          captureWallet: async () => {
            if (state.reservationStatus === "pending") {
              state.reservationStatus = "captured";
              state.captureCount += 1;
            }
            if (failurePoint === "capture") throw new Error("capture boundary");
          },
          markPaymentPaid: async () => {
            state.paymentStatus = "paid";
            if (failurePoint === "payment") throw new Error("payment boundary");
          },
          writeGatewayLedger: async () => {
            if (state.ledgerCount === 0) state.ledgerCount += 1;
            if (failurePoint === "ledger") throw new Error("ledger boundary");
          },
        });
      } catch {
        Object.assign(state, before);
        throw new Error("transaction aborted");
      }
    };

    await assert.rejects(runTransaction(failAfter), /transaction aborted/);
    assert.equal(state.tripPaymentStatus, "pending");
    assert.equal(state.paymentStatus, "kashier_pending");
    assert.equal(state.reservationStatus, "pending");
    assert.equal(state.ledgerCount, 0);

    await runTransaction(null);
    assert.equal(state.tripPaymentStatus, "paid");
    assert.equal(state.paymentStatus, "paid");
    assert.equal(state.reservationStatus, "captured");
    assert.equal(state.captureCount, 1);
    assert.equal(state.ledgerCount, 1);
  }
});

test("webhook and callback settlement share replay-safe finalization steps", async () => {
  for (const source of ["webhook", "callback"]) {
    const state = {
      tripStatus: "approved",
      tripPaymentStatus: "failed",
      paymentStatus: "failed",
      captured: false,
      ledgerWritten: false,
    };
    assert.equal(
      shouldResetFailedTripForRetry(state.tripStatus, state.tripPaymentStatus),
      true,
    );
    state.tripPaymentStatus = "pending";
    state.paymentStatus = "kashier_pending";

    const settle = async () => {
      if (state.paymentStatus === "paid") return "already_paid";
      state.tripStatus = "submitted";
      state.tripPaymentStatus = "paid";
      await runStandaloneSettlementSteps({
        captureWallet: async () => {
          state.captured = true;
        },
        markPaymentPaid: async () => {
          state.paymentStatus = "paid";
        },
        writeGatewayLedger: async () => {
          state.ledgerWritten = true;
        },
      });
      return "settled";
    };

    assert.equal(await settle(), "settled", source);
    assert.equal(await settle(), "already_paid", source);
    assert.equal(state.tripPaymentStatus, "paid");
    assert.equal(state.captured, true);
    assert.equal(state.ledgerWritten, true);
  }
});
