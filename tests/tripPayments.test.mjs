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
