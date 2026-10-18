import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { cancelRequestDayWith, cancelWholeRequestWith } = await import(
  "../src/lib/requestGroupCancellationCore.ts"
);
const { releasePromoForRequestWith } = await import(
  "../src/lib/requestPromoRelease.ts"
);
const { buildPendingRequestExpiryFilter } = await import(
  "../src/lib/pendingRequestHardening.ts"
);
const { getDisplayStatus } = await import("../src/lib/statusDisplay.ts");
const {
  buildWaitingListReviewUpdate,
  buildWaitingListTransitionFilter,
  buildWaitingListTripCancellationUpdate,
} = await import("../src/lib/admin/waitingList.ts");

function createLifecycleStore(prices = [110, 90, 70]) {
  const state = {
    request: {
      id: "request-id",
      userId: "user-id",
      status: "waiting_list",
      paymentStatus: "pending",
      amountEgp: prices.reduce((sum, price) => sum + price, 0),
      kashierSessionId: null,
    },
    trips: prices.map((priceEgp, index) => ({
      id: `trip-${index + 1}`,
      requestId: "request-id",
      status: "pending_payment",
      paymentStatus: "pending",
      priceEgp,
      date: `2026-10-${String(13 + index).padStart(2, "0")}`,
    })),
    promoUsages: new Set(prices.map((_, index) => `trip-${index + 1}`)),
    releaseCalls: [],
    successfulReleases: new Map(),
    activePayment: false,
  };

  const store = {
    state,
    async withTransaction(work) {
      return work(state);
    },
    async getRequest(_session, requestId, userId) {
      if (requestId !== state.request.id || userId !== state.request.userId) {
        return null;
      }
      return { ...state.request, tripIds: state.trips.map((trip) => trip.id) };
    },
    async findTrips(_session, requestId) {
      return state.trips
        .filter((trip) => trip.requestId === requestId)
        .map((trip) => ({ ...trip }));
    },
    async hasActivePayment() {
      return state.activePayment;
    },
    async cancelTrip(_session, requestId, tripId, reason, now) {
      const trip = state.trips.find(
        (item) => item.id === tripId && item.requestId === requestId,
      );
      if (!trip || trip.status === "cancelled") return false;
      Object.assign(trip, {
        status: "cancelled",
        cancelledBy: "passenger",
        cancelReason: reason,
        cancellation: {
          cancelledAt: now,
          tierLabel: "pre_payment",
          refundPercent: 0,
          penaltyPercent: 0,
          refundAmount: 0,
          retainedAmount: 0,
          refundStatus: "none",
          reason,
        },
      });
      return true;
    },
    async cancelRemainingTrips(_session, requestId, reason, now) {
      let modified = 0;
      for (const trip of state.trips) {
        if (trip.requestId === requestId && trip.status !== "cancelled") {
          await store.cancelTrip(_session, requestId, trip.id, reason, now);
          modified += 1;
        }
      }
      return modified;
    },
    async updateRequest(_session, requestId, userId, expected, update) {
      if (
        requestId !== state.request.id ||
        userId !== state.request.userId ||
        state.request.paymentStatus !== "pending" ||
        state.request.status !== expected.status ||
        state.request.amountEgp !== expected.amountEgp
      ) {
        return false;
      }
      Object.assign(state.request, update);
      return true;
    },
    async releasePromos(_session, requestId) {
      return releasePromoForRequestWith(
        {
          async getRequest(id) {
            return id === state.request.id
              ? {
                  status: state.request.status,
                  paymentStatus: state.request.paymentStatus,
                }
              : null;
          },
          async findTripsForRequest(id) {
            return state.trips
              .filter((trip) => trip.requestId === id)
              .map((trip) => ({
                id: trip.id,
                status: trip.status,
                paymentStatus: trip.paymentStatus,
              }));
          },
          async releaseTrip(tripId) {
            state.releaseCalls.push(tripId);
            if (!state.promoUsages.delete(tripId)) return 0;
            state.successfulReleases.set(
              tripId,
              (state.successfulReleases.get(tripId) ?? 0) + 1,
            );
            return 1;
          },
        },
        requestId,
      );
    },
  };
  return { state, store };
}

async function cancelSecondDay() {
  const { state, store } = createLifecycleStore();
  const result = await cancelRequestDayWith(store, {
    requestId: state.request.id,
    tripId: "trip-2",
    userId: state.request.userId,
  });
  return { state, store, result };
}

test("cancelled child remains cancelled through group approval and total uses remaining prices", async () => {
  const { state, result } = await cancelSecondDay();
  assert.equal(result.amountEgp, 180);
  assert.equal(state.trips[1].status, "cancelled");

  const transition = buildWaitingListTransitionFilter(state.request.id);
  assert.deepEqual(transition, {
    _id: state.request.id,
    status: "waiting_list",
  });
  Object.assign(
    state.request,
    buildWaitingListReviewUpdate("approve", "admin-id", new Date()).$set,
  );
  for (const trip of state.trips) {
    if (trip.status === "pending_payment") trip.status = "submitted";
  }

  assert.equal(state.request.status, "approved");
  assert.equal(state.request.amountEgp, state.trips
    .filter((trip) => trip.status !== "cancelled")
    .reduce((sum, trip) => sum + trip.priceEgp, 0));
  assert.equal(state.trips[1].status, "cancelled");
});

test("group rejection releases each remaining promo once and preserves a cancelled day", async () => {
  const { state, store } = await cancelSecondDay();
  Object.assign(
    state.request,
    buildWaitingListReviewUpdate("reject", "admin-id", new Date()).$set,
  );
  for (const trip of state.trips) {
    if (trip.status === "pending_payment") {
      Object.assign(trip, buildWaitingListTripCancellationUpdate(new Date(), "Rejected"));
    }
  }
  await store.releasePromos(state, state.request.id);

  assert.equal(state.trips[1].status, "cancelled");
  assert.deepEqual([...state.promoUsages], []);
  assert.deepEqual(
    [...state.successfulReleases.entries()].sort(),
    [["trip-1", 1], ["trip-2", 1], ["trip-3", 1]],
  );
});

test("Request settlement leaves a cancelled child untouched", async () => {
  const source = await readFile(
    new URL("../src/lib/payments/requestSettlement.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /Trip\.updateMany\(\s*\{\s*requestId:\s*requestObjectId,\s*status:\s*\{\s*\$ne:\s*"cancelled"\s*\}/s,
    "settlement must exclude cancelled children when setting paymentStatus",
  );
  assert.match(
    source,
    /Trip\.updateMany\(\s*\{\s*requestId:\s*requestObjectId,\s*status:\s*"pending_payment"\s*\}/s,
    "settlement should advance only pending children to submitted",
  );
});

test("expiry on a reduced group preserves the cancelled child and promo release is idempotent", async () => {
  const { state, store } = await cancelSecondDay();
  const cutoff = new Date("2026-10-12T17:00:00+03:00");
  const expiryFilter = buildPendingRequestExpiryFilter(cutoff);
  assert.equal(expiryFilter.status, "pending_payment");
  Object.assign(state.request, { status: "time_out", paymentStatus: "expired" });
  for (const trip of state.trips) {
    if (trip.status === "pending_payment") {
      Object.assign(trip, { status: "time_out", paymentStatus: "expired" });
    }
  }
  await store.releasePromos(state, state.request.id);
  const firstReleaseCount = state.successfulReleases.size;
  await store.releasePromos(state, state.request.id);

  assert.equal(state.trips[1].status, "cancelled");
  assert.equal(state.promoUsages.size, 0);
  assert.equal(firstReleaseCount, 3);
  assert.equal(state.successfulReleases.get("trip-2"), 1);
});

test("cancel-all is terminal and a second cancel or expiry cannot release promos again", async () => {
  const { state, store } = createLifecycleStore([110, 90, 70]);
  const result = await cancelWholeRequestWith(store, {
    requestId: state.request.id,
    userId: state.request.userId,
  });
  const releaseCount = state.successfulReleases.size;
  assert.equal(result.status, "cancelled");
  assert.equal(result.paymentStatus, "expired");
  assert.equal(result.amountEgp, 0);
  assert.equal(state.request.status, "cancelled");
  assert.equal(state.request.paymentStatus, "expired");
  assert.ok(state.trips.every((trip) => trip.status === "cancelled"));
  assert.ok(state.trips.every((trip) => trip.paymentStatus === "pending"));
  assert.deepEqual(
    getDisplayStatus({
      request: {
        status: state.request.status,
        paymentStatus: state.request.paymentStatus,
      },
      trip: { status: state.trips[0].status, cancelledBy: "passenger" },
    }).key,
    "status.cancelled",
  );

  await assert.rejects(
    cancelWholeRequestWith(store, {
      requestId: state.request.id,
      userId: state.request.userId,
    }),
    (error) => error.code === "REQUEST_NOT_CANCELLABLE",
  );
  assert.equal(
    buildPendingRequestExpiryFilter(new Date()).status,
    "pending_payment",
  );
  await store.releasePromos(state, state.request.id);
  assert.equal(state.successfulReleases.size, releaseCount);
  assert.equal(state.promoUsages.size, 0);
});
