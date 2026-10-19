import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { readFile } from "node:fs/promises";

const {
  cancelRequestDayWith,
  cancelWholeRequestWith,
  RequestGroupCancellationError,
} = await import("../src/lib/requestGroupCancellationCore.ts");
const {
  getRequestPaymentSessionBlock,
} = await import("../src/lib/payments/requestSessionEligibility.ts");
const {
  groupTripsByRequest,
} = await import("../src/lib/groupRequestTrips.ts");
const {
  mapWaitingListRequest,
  buildWaitingListTransitionFilter,
  buildWaitingListReviewUpdate,
} = await import("../src/lib/admin/waitingList.ts");
const {
  KASHIER_SESSION_DURATION_MS,
  PAYMENT_CANCELLATION_GRACE_MS,
  verifyExpiredRequestPayments,
} = await import("../src/lib/payments/sessionTiming.ts");
const { isMultiDayRequestsEnabled } = await import(
  "../src/lib/config/featureFlags.ts"
);

class MemoryCancellationStore {
  constructor({ prices = [100, 100, 100, 100, 100], status = "waiting_list", paymentStatus = "pending" } = {}) {
    this.request = {
      id: "request-1",
      userId: "user-1",
      status,
      paymentStatus,
      amountEgp: prices.reduce((total, price) => total + price, 0),
      kashierSessionId: null,
    };
    this.trips = prices.map((priceEgp, index) => ({
      id: `trip-${index + 1}`,
      requestId: "request-1",
      status: "pending_payment",
      paymentStatus: "pending",
      priceEgp,
      date: `2026-10-${String(12 + index).padStart(2, "0")}`,
    }));
    this.activePayment = false;
    this.promoReleases = [];
    this.failPromoRelease = false;
    this.failRequestUpdate = false;
    this.tail = Promise.resolve();
  }

  async withTransaction(work) {
    const previous = this.tail;
    let release;
    this.tail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    const snapshot = structuredClone({
      request: this.request,
      trips: this.trips,
      promoReleases: this.promoReleases,
    });
    try {
      return await work({});
    } catch (error) {
      this.request = snapshot.request;
      this.trips = snapshot.trips;
      this.promoReleases = snapshot.promoReleases;
      throw error;
    } finally {
      release();
    }
  }

  async getRequest(_session, requestId, userId) {
    return this.request.id === requestId && this.request.userId === userId
      ? structuredClone(this.request)
      : null;
  }

  async findTrips(_session, requestId) {
    return this.trips
      .filter((trip) => trip.requestId === requestId)
      .map((trip) => structuredClone(trip));
  }

  async hasActivePayment() {
    return this.activePayment;
  }

  async cancelTrip(_session, requestId, tripId, reason, now) {
    const trip = this.trips.find(
      (item) =>
        item.requestId === requestId &&
        item.id === tripId &&
        item.status !== "cancelled" &&
        item.paymentStatus !== "paid",
    );
    if (!trip) return false;
    trip.status = "cancelled";
    trip.cancelledBy = "passenger";
    trip.cancelReason = reason;
    trip.cancellation = {
      cancelledAt: now,
      tierLabel: "pre_payment",
      refundPercent: 0,
      penaltyPercent: 0,
      refundAmount: 0,
      retainedAmount: 0,
      refundStatus: "none",
      reason,
    };
    return true;
  }

  async cancelRemainingTrips(_session, requestId, reason, now) {
    let count = 0;
    for (const trip of this.trips) {
      if (
        trip.requestId === requestId &&
        trip.status !== "cancelled" &&
        trip.paymentStatus !== "paid"
      ) {
        await this.cancelTrip(_session, requestId, trip.id, reason, now);
        count += 1;
      }
    }
    return count;
  }

  async updateRequest(_session, requestId, userId, expected, update) {
    if (this.failRequestUpdate) return false;
    if (
      this.request.id !== requestId ||
      this.request.userId !== userId ||
      this.request.status !== expected.status ||
      this.request.paymentStatus !== expected.paymentStatus ||
      this.request.amountEgp !== expected.amountEgp
    ) {
      return false;
    }
    Object.assign(this.request, update);
    return true;
  }

  async releasePromos(_session, requestId) {
    if (this.failPromoRelease) throw new Error("promo release failure");
    const cancelledTrips = this.trips.filter(
      (trip) => trip.requestId === requestId && trip.status === "cancelled",
    );
    this.promoReleases.push(...cancelledTrips.map((trip) => trip.id));
    return cancelledTrips.length;
  }

  async beginPayment(expectedAmount) {
    if (
      this.activePayment ||
      this.request.paymentStatus !== "pending" ||
      ["cancelled", "rejected", "time_out"].includes(this.request.status) ||
      this.request.amountEgp !== expectedAmount ||
      this.request.amountEgp !==
        this.trips
          .filter((trip) => trip.status !== "cancelled")
          .reduce((total, trip) => total + trip.priceEgp, 0)
    ) {
      throw new Error("Request is no longer payable");
    }
    this.activePayment = true;
  }
}

function setup(pricesOrOptions) {
  const options = Array.isArray(pricesOrOptions)
    ? { prices: pricesOrOptions }
    : pricesOrOptions ?? {};
  const store = new MemoryCancellationStore(options);
  const requestId = new Types.ObjectId().toString();
  store.request.id = requestId;
  store.trips.forEach((trip) => {
    trip.requestId = requestId;
  });
  return { store, requestId };
}

test("cancels one of five equal-price days and keeps Request status and tripIds intact", async () => {
  const { store, requestId } = setup();
  const originalTripIds = store.trips.map((trip) => trip.id);
  const result = await cancelRequestDayWith(store, {
    requestId,
    tripId: "trip-3",
    userId: "user-1",
  });

  assert.equal(result.amountEgp, 400);
  assert.equal(result.remainingTrips.length, 4);
  assert.equal(store.request.status, "waiting_list");
  assert.equal(store.request.paymentStatus, "pending");
  assert.deepEqual(store.trips.map((trip) => trip.id), originalTripIds);
  assert.equal(store.trips[2].status, "cancelled");
  assert.deepEqual(store.promoReleases, ["trip-3"]);
});

test("unlisted users can still cancel existing Requests", async () => {
  const previousFlag = process.env.MULTI_DAY_REQUESTS_ENABLED;
  const previousAllowedIds = process.env.MULTI_DAY_REQUESTS_ALLOWED_USER_IDS;
  process.env.MULTI_DAY_REQUESTS_ENABLED = "true";
  process.env.MULTI_DAY_REQUESTS_ALLOWED_USER_IDS =
    "64b000000000000000000001";
  try {
    assert.equal(isMultiDayRequestsEnabled("64b000000000000000000002"), false);
    const { store, requestId } = setup();
    const result = await cancelRequestDayWith(store, {
      requestId,
      tripId: "trip-3",
      userId: "user-1",
    });
    assert.equal(result.amountEgp, 400);
    assert.equal(store.trips[2].status, "cancelled");
  } finally {
    if (previousFlag === undefined) delete process.env.MULTI_DAY_REQUESTS_ENABLED;
    else process.env.MULTI_DAY_REQUESTS_ENABLED = previousFlag;
    if (previousAllowedIds === undefined) {
      delete process.env.MULTI_DAY_REQUESTS_ALLOWED_USER_IDS;
    } else {
      process.env.MULTI_DAY_REQUESTS_ALLOWED_USER_IDS = previousAllowedIds;
    }
  }
});

test("recomputes the amount from unequal remaining child prices", async () => {
  const { store, requestId } = setup([80, 125, 40, 95, 60]);
  const result = await cancelRequestDayWith(store, {
    requestId,
    tripId: "trip-2",
    userId: "user-1",
  });
  assert.equal(result.amountEgp, 275);
});

test("cancelling the last non-cancelled day cancels the Request", async () => {
  const { store, requestId } = setup([140]);
  const result = await cancelRequestDayWith(store, {
    requestId,
    tripId: "trip-1",
    userId: "user-1",
  });
  assert.equal(result.amountEgp, 0);
  assert.equal(result.status, "cancelled");
  assert.equal(result.paymentStatus, "expired");
  assert.equal(store.trips[0].status, "cancelled");
});

test("cancels the whole Request, all children, and all promo reservations", async () => {
  const { store, requestId } = setup([30, 70, 110]);
  const result = await cancelWholeRequestWith(store, {
    requestId,
    userId: "user-1",
  });
  assert.equal(result.amountEgp, 0);
  assert.equal(result.status, "cancelled");
  assert.equal(result.paymentStatus, "expired");
  assert.ok(store.trips.every((trip) => trip.status === "cancelled"));
  assert.deepEqual(store.promoReleases.sort(), ["trip-1", "trip-2", "trip-3"]);
});

test("rejects paid Requests without modifying children, amount, or promo usage", async () => {
  const { store, requestId } = setup({
    prices: [100, 100],
    status: "submitted",
    paymentStatus: "paid",
  });
  const originalTrips = structuredClone(store.trips);
  await assert.rejects(
    cancelRequestDayWith(store, {
      requestId,
      tripId: "trip-1",
      userId: "user-1",
    }),
    (error) =>
      error instanceof RequestGroupCancellationError &&
      error.code === "REQUEST_ALREADY_PAID",
  );
  assert.deepEqual(store.trips, originalTrips);
  assert.equal(store.request.amountEgp, 200);
  assert.deepEqual(store.promoReleases, []);
});

test("refuses day and whole cancellation while a gateway or legacy session is active", async () => {
  const { store, requestId } = setup([100, 100]);
  store.activePayment = true;
  await assert.rejects(
    cancelRequestDayWith(store, { requestId, tripId: "trip-1", userId: "user-1" }),
    (error) =>
      error.code === "PAYMENT_IN_PROGRESS" &&
      /after it expires \(up to 35 minutes\)/.test(error.message),
  );
  store.activePayment = false;
  store.request.kashierSessionId = "legacy-session";
  await cancelWholeRequestWith(store, { requestId, userId: "user-1" });
  assert.equal(store.request.kashierSessionId, null);
  assert.equal(store.request.amountEgp, 0);
  assert.ok(store.trips.every((trip) => trip.status === "cancelled"));
});

test("stale kashier_pending payment is verified and then cancellation can proceed", async () => {
  const { store, requestId } = setup([100, 100]);
  store.activePayment = true;
  store.request.kashierSessionId = "expired-session";
  let walletReservationReleased = false;
  await verifyExpiredRequestPayments(
    [{ id: "payment-1", createdAt: new Date("2026-10-12T12:00:00.000Z") }],
    new Date("2026-10-12T12:35:00.000Z"),
    async (paymentId) => {
      assert.equal(paymentId, "payment-1");
      store.activePayment = false;
      store.request.paymentStatus = "failed";
      walletReservationReleased = true;
      return "failed";
    },
  );
  await cancelRequestDayWith(store, {
    requestId,
    tripId: "trip-1",
    userId: "user-1",
  });
  assert.equal(walletReservationReleased, true);
  assert.equal(store.request.paymentStatus, "pending");
  assert.equal(store.request.kashierSessionId, null);
  assert.equal(store.trips[0].status, "cancelled");
});

test("expired Request payment verification uses 30 minutes plus five-minute grace", async () => {
  const now = new Date("2026-10-12T12:35:00.000Z");
  const calls = [];
  await verifyExpiredRequestPayments(
    [
      {
        id: "stale",
        createdAt: new Date(
          now.getTime() -
            KASHIER_SESSION_DURATION_MS -
            PAYMENT_CANCELLATION_GRACE_MS,
        ),
      },
      {
        id: "fresh",
        createdAt: new Date(
          now.getTime() -
            KASHIER_SESSION_DURATION_MS -
            PAYMENT_CANCELLATION_GRACE_MS +
            1,
        ),
      },
    ],
    now,
    async (paymentId) => calls.push(paymentId),
  );
  assert.deepEqual(calls, ["stale"]);
});

test("a new payment session is eligible after cancelling one day at the new amount", async () => {
  const { store, requestId } = setup({
    prices: [100, 150, 200],
    status: "pending_payment",
  });
  await cancelRequestDayWith(store, {
    requestId,
    tripId: "trip-2",
    userId: "user-1",
  });

  assert.equal(store.request.amountEgp, 300);
  assert.equal(
    getRequestPaymentSessionBlock(
      store.request,
      store.trips.map((trip) => ({
        status: trip.status,
        priceEgp: trip.priceEgp,
      })),
    ),
    null,
  );
  await store.beginPayment(300);
  assert.equal(store.activePayment, true);
});

test("cancellation verifies expired active payments through the shared payment verifier", async () => {
  const source = await readFile(
    new URL("../src/lib/requestGroupCancellation.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /verifyAndSettleBooking\(requestId, userId, paymentId\)/);
  assert.match(source, /await verifyExpiredPayments\(input\.requestId, input\.userId\)/);
});

test("concurrent cancellation and payment lock have one conditional winner", async () => {
  const { store, requestId } = setup([100, 100]);
  const outcomes = await Promise.allSettled([
    cancelRequestDayWith(store, {
      requestId,
      tripId: "trip-1",
      userId: "user-1",
    }),
    store.withTransaction(() => store.beginPayment(200)),
  ]);
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
  if (store.activePayment) {
    assert.equal(store.request.amountEgp, 200);
    assert.ok(store.trips.every((trip) => trip.status !== "cancelled"));
  } else {
    assert.equal(store.request.amountEgp, 100);
    assert.equal(store.trips.filter((trip) => trip.status === "cancelled").length, 1);
  }
});

test("payment eligibility blocks waiting-list, cancelled, empty, and amount-stale Requests", () => {
  const trip = { status: "pending_payment", priceEgp: 100 };
  assert.equal(
    getRequestPaymentSessionBlock(
      { status: "waiting_list", paymentStatus: "pending", amountEgp: 100 },
      [trip],
    ),
    "REQUEST_WAITING_LIST",
  );
  assert.equal(
    getRequestPaymentSessionBlock(
      { status: "cancelled", paymentStatus: "expired", amountEgp: 0 },
      [],
    ),
    "REQUEST_CANCELLED",
  );
  assert.equal(
    getRequestPaymentSessionBlock(
      { status: "pending_payment", paymentStatus: "pending", amountEgp: 100 },
      [],
    ),
    "REQUEST_NO_REMAINING_TRIPS",
  );
  assert.equal(
    getRequestPaymentSessionBlock(
      { status: "pending_payment", paymentStatus: "pending", amountEgp: 200 },
      [trip],
    ),
    "REQUEST_AMOUNT_MISMATCH",
  );
  assert.equal(
    getRequestPaymentSessionBlock(
      { status: "pending_payment", paymentStatus: "pending", amountEgp: 100 },
      [trip],
    ),
    null,
  );
});

test("cancelled children leave active passenger and admin groups; paid Requests display single Trips", async () => {
  const { store, requestId } = setup([90, 130, 70]);
  await cancelRequestDayWith(store, {
    requestId,
    tripId: "trip-2",
    userId: "user-1",
  });
  const displayedTrips = store.trips.filter((trip) => trip.status !== "cancelled");
  assert.equal(displayedTrips.length, 2);
  const passengerGroups = groupTripsByRequest(
    store.trips.map((trip) => ({
      id: trip.id,
      requestId: trip.requestId,
      date: trip.date,
      status: trip.status,
      parentPaymentStatus: store.request.paymentStatus,
    })),
  );
  assert.equal(passengerGroups.filter((group) => group.kind === "group")[0].trips.length, 2);
  assert.equal(passengerGroups.filter((group) => group.kind === "single").length, 1);

  const adminGroup = mapWaitingListRequest({
    request: {
      _id: requestId,
      createdAt: new Date(),
      amountEgp: store.request.amountEgp,
    },
    passenger: { name: "Passenger" },
    trips: displayedTrips.map((trip) => ({
      _id: trip.id,
      date: trip.date,
      pickupTime: "08:00",
      arrivalTime: "09:00",
      vehicleType: "taxi_shared",
      numberOfPassengers: 1,
      priceEgp: trip.priceEgp,
    })),
    promoCodes: [],
    hasPastTrip: false,
  });
  assert.equal(adminGroup.totalFare, 160);
  assert.equal(adminGroup.trips.length, 2);
  assert.deepEqual(
    buildWaitingListTransitionFilter(requestId),
    { _id: requestId, status: "waiting_list" },
  );
  assert.equal(
    buildWaitingListReviewUpdate("approve", "admin-id", new Date()).$set.status,
    "approved",
  );

  const paidHistory = groupTripsByRequest(
    displayedTrips.map((trip) => ({
      id: trip.id,
      requestId: trip.requestId,
      date: trip.date,
      parentPaymentStatus: "paid",
    })),
  );
  assert.equal(paidHistory.every((group) => group.kind === "single"), true);
});

test("transaction failure restores child state, promo release record, and parent amount", async () => {
  const { store, requestId } = setup([60, 120]);
  store.failPromoRelease = true;
  await assert.rejects(
    cancelRequestDayWith(store, { requestId, tripId: "trip-1", userId: "user-1" }),
    /promo release failure/,
  );
  assert.equal(store.request.amountEgp, 180);
  assert.ok(store.trips.every((trip) => trip.status !== "cancelled"));
  assert.deepEqual(store.promoReleases, []);

  store.failPromoRelease = false;
  store.failRequestUpdate = true;
  await assert.rejects(
    cancelWholeRequestWith(store, { requestId, userId: "user-1" }),
    RequestGroupCancellationError,
  );
  assert.equal(store.request.amountEgp, 180);
  assert.ok(store.trips.every((trip) => trip.status !== "cancelled"));
});
