import test from "node:test";
import assert from "node:assert/strict";

const { runStandaloneTripExpiry } = await import(
  "../src/lib/standaloneTripExpiry.ts"
);

const now = new Date("2026-01-10T08:00:00+02:00");
const nowCairo = { dateStr: "2026-01-10", timeStr: "08:00" };
const oldCreatedAt = new Date(now.getTime() - 3 * 60 * 60 * 1000);

function makeTrip(overrides = {}) {
  return {
    id: "trip-1",
    requestId: null,
    status: "pending_payment",
    paymentStatus: "pending",
    date: nowCairo.dateStr,
    pickupTime: "09:00",
    createdAt: oldCreatedAt,
    ...overrides,
  };
}

function makePayment(overrides = {}) {
  return {
    id: "payment-1",
    bookingId: "trip-1",
    overallStatus: "kashier_pending",
    walletStatus: "none",
    gatewayStatus: "pending",
    walletReservationTxId: null,
    createdAt: new Date(now.getTime() - 60 * 60 * 1000),
    updatedAt: new Date(now.getTime() - 60 * 60 * 1000),
    ...overrides,
  };
}

class MemoryExpiryStore {
  constructor(trips = [], payments = []) {
    this.trips = new Map(trips.map((trip) => [trip.id, trip]));
    this.payments = new Map(payments.map((payment) => [payment.id, payment]));
    this.legacyRequests = [{ id: "request-1", status: "pending_payment" }];
    this.promoReleases = new Set();
    this.promoReleaseCalls = [];
  }

  findPendingTripCandidates(cutoff) {
    return Promise.resolve(
      [...this.trips.values()]
        .filter(
          (trip) =>
            trip.requestId == null &&
            trip.status === "pending_payment" &&
            ["pending", "failed"].includes(trip.paymentStatus) &&
            trip.createdAt <= cutoff,
        )
        .map((trip) => ({ ...trip })),
    );
  }

  findApprovedTripCandidates(nowParts) {
    return Promise.resolve(
      [...this.trips.values()]
        .filter(
          (trip) =>
            trip.requestId == null &&
            trip.status === "approved" &&
            ["pending", "failed"].includes(trip.paymentStatus) &&
            (trip.date < nowParts.dateStr ||
              (trip.date === nowParts.dateStr &&
                trip.pickupTime < nowParts.timeStr)),
        )
        .map((trip) => ({ ...trip })),
    );
  }

  findWaitingListTripCandidates(nowParts) {
    return Promise.resolve(
      [...this.trips.values()]
        .filter(
          (trip) =>
            trip.requestId == null &&
            trip.status === "waiting_list" &&
            (trip.date < nowParts.dateStr ||
              (trip.date === nowParts.dateStr &&
                trip.pickupTime < nowParts.timeStr)),
        )
        .map((trip) => ({ ...trip })),
    );
  }

  expirePendingTrip(id, cutoff) {
    const trip = this.trips.get(id);
    if (
      !trip ||
      trip.requestId != null ||
      trip.status !== "pending_payment" ||
      !["pending", "failed"].includes(trip.paymentStatus) ||
      trip.createdAt > cutoff
    ) {
      return Promise.resolve(false);
    }
    trip.status = "time_out";
    trip.paymentStatus = "expired";
    this.promoReleases.add(id);
    this.promoReleaseCalls.push(id);
    return Promise.resolve(true);
  }

  expireApprovedTrip(id, nowParts) {
    const trip = this.trips.get(id);
    if (
      !trip ||
      trip.requestId != null ||
      trip.status !== "approved" ||
      !["pending", "failed"].includes(trip.paymentStatus) ||
      !(
        trip.date < nowParts.dateStr ||
        (trip.date === nowParts.dateStr && trip.pickupTime < nowParts.timeStr)
      )
    ) {
      return Promise.resolve(false);
    }
    trip.status = "time_out";
    trip.paymentStatus = "expired";
    this.promoReleases.add(id);
    this.promoReleaseCalls.push(id);
    return Promise.resolve(true);
  }

  expireWaitingListTrip(id, nowParts) {
    const trip = this.trips.get(id);
    if (
      !trip ||
      trip.requestId != null ||
      trip.status !== "waiting_list" ||
      !(
        trip.date < nowParts.dateStr ||
        (trip.date === nowParts.dateStr && trip.pickupTime < nowParts.timeStr)
      )
    ) {
      return Promise.resolve(false);
    }
    trip.status = "time_out";
    trip.paymentStatus = "expired";
    this.promoReleases.add(id);
    this.promoReleaseCalls.push(id);
    return Promise.resolve(true);
  }

  approveWaitingListTrip(id) {
    const trip = this.trips.get(id);
    if (!trip || trip.status !== "waiting_list") {
      return Promise.resolve(false);
    }
    trip.status = "approved";
    return Promise.resolve(true);
  }

  hasRecentActivePayment(tripId, since) {
    return Promise.resolve(
      [...this.payments.values()].some(
        (payment) =>
          payment.bookingId === tripId &&
          ["created", "wallet_reserved", "kashier_pending"].includes(
            payment.overallStatus,
          ) &&
          (payment.createdAt >= since || payment.updatedAt >= since),
      ),
    );
  }

  findExpiredTripsWithActivePayments() {
    const activeTripIds = new Set(
      [...this.payments.values()]
        .filter(
          (payment) =>
            ["created", "wallet_reserved", "kashier_pending"].includes(
              payment.overallStatus,
            ) ||
            (payment.overallStatus === "cancelled" &&
              payment.walletStatus === "reserved"),
        )
        .map((payment) => payment.bookingId),
    );
    return Promise.resolve(
      [...this.trips.values()]
        .filter(
          (trip) =>
            activeTripIds.has(trip.id) &&
            trip.requestId == null &&
            trip.status === "time_out" &&
            trip.paymentStatus === "expired",
        )
        .map((trip) => trip.id),
    );
  }

  findPayments(tripIds) {
    const ids = new Set(tripIds);
    return Promise.resolve(
      [...this.payments.values()]
        .filter(
          (payment) =>
            ids.has(payment.bookingId) &&
            (["created", "wallet_reserved", "kashier_pending"].includes(
              payment.overallStatus,
            ) ||
              (payment.overallStatus === "cancelled" &&
                payment.walletStatus === "reserved")),
        )
        .map((payment) => ({ ...payment })),
    );
  }

  cancelActivePayment(id, at, cancelGateway) {
    const payment = this.payments.get(id);
    if (
      !payment ||
      !["created", "wallet_reserved", "kashier_pending"].includes(
        payment.overallStatus,
      )
    ) {
      return Promise.resolve(null);
    }
    payment.overallStatus = "cancelled";
    if (cancelGateway) payment.gatewayStatus = "cancelled";
    payment.timeline = [
      ...(payment.timeline ?? []),
      { at, event: "trip_expired", actor: "system" },
    ];
    return Promise.resolve({ ...payment });
  }

  findPayment(id) {
    const payment = this.payments.get(id);
    return Promise.resolve(payment ? { ...payment } : null);
  }

  markWalletReleased(id) {
    const payment = this.payments.get(id);
    if (payment?.overallStatus === "cancelled" && payment.walletStatus === "reserved") {
      payment.walletStatus = "released";
    }
    return Promise.resolve();
  }
}

async function expire(store, releaseWalletReservation = async () => false) {
  return runStandaloneTripExpiry({
    store,
    releaseWalletReservation,
    now,
  });
}

test("expires old pending and failed standalone Trips", async () => {
  const store = new MemoryExpiryStore([
    makeTrip({ id: "pending" }),
    makeTrip({ id: "failed", paymentStatus: "failed" }),
  ]);

  const result = await expire(store);

  assert.equal(result.expiredTrips, 2);
  assert.deepEqual([...store.promoReleases].sort(), ["failed", "pending"]);
  for (const trip of store.trips.values()) {
    assert.equal(trip.status, "time_out");
    assert.equal(trip.paymentStatus, "expired");
  }
});

test("does not expire a paid Trip or a waitlist Trip", async () => {
  const store = new MemoryExpiryStore([
    makeTrip({ id: "paid", paymentStatus: "paid" }),
    makeTrip({ id: "waitlisted", status: "waiting_list" }),
  ]);

  const result = await expire(store);

  assert.equal(result.expiredTrips, 0);
  assert.equal(store.trips.get("paid").status, "pending_payment");
  assert.equal(store.trips.get("waitlisted").status, "waiting_list");
});

test("expires a past-pickup standalone waiting-list Trip and releases promo once", async () => {
  const store = new MemoryExpiryStore([
    makeTrip({
      status: "waiting_list",
      pickupTime: "07:59",
      appliedPromoCode: "promo-1",
    }),
  ]);

  const result = await expire(store);
  const secondResult = await expire(store);

  assert.equal(result.expiredTrips, 1);
  assert.equal(secondResult.expiredTrips, 0);
  assert.equal(store.trips.get("trip-1").status, "time_out");
  assert.equal(store.trips.get("trip-1").paymentStatus, "expired");
  assert.deepEqual([...store.promoReleases], ["trip-1"]);
  assert.deepEqual(store.promoReleaseCalls, ["trip-1"]);
});

test("does not expire a future waiting-list Trip", async () => {
  const store = new MemoryExpiryStore([
    makeTrip({ status: "waiting_list", pickupTime: "08:01" }),
  ]);

  const result = await expire(store);

  assert.equal(result.expiredTrips, 0);
  assert.equal(store.trips.get("trip-1").status, "waiting_list");
  assert.equal(store.trips.get("trip-1").paymentStatus, "pending");
  assert.deepEqual([...store.promoReleases], []);
});

test("does not expire an approved or rejected Trip", async () => {
  const store = new MemoryExpiryStore([
    makeTrip({ id: "approved", status: "approved", pickupTime: "09:00" }),
    makeTrip({ id: "rejected", status: "rejected", pickupTime: "07:59" }),
  ]);

  const result = await expire(store);

  assert.equal(result.expiredTrips, 0);
  assert.equal(store.trips.get("approved").status, "approved");
  assert.equal(store.trips.get("rejected").status, "rejected");
  assert.deepEqual([...store.promoReleases], []);
});

test("admin approval racing expiry has one conditional winner", async () => {
  const store = new MemoryExpiryStore([
    makeTrip({ status: "waiting_list", pickupTime: "07:59" }),
  ]);

  const candidates = await store.findWaitingListTripCandidates(nowCairo);
  assert.equal(candidates.length, 1);
  const [expired, approved] = await Promise.all([
    store.expireWaitingListTrip("trip-1", nowCairo),
    store.approveWaitingListTrip("trip-1"),
  ]);

  assert.equal(Number(expired) + Number(approved), 1);
  if (expired) {
    assert.equal(store.trips.get("trip-1").status, "time_out");
    assert.equal(store.trips.get("trip-1").paymentStatus, "expired");
    assert.deepEqual(store.promoReleaseCalls, ["trip-1"]);
  }
  if (approved) {
    assert.equal(store.trips.get("trip-1").status, "approved");
    assert.equal(store.trips.get("trip-1").paymentStatus, "pending");
    assert.deepEqual(store.promoReleaseCalls, []);
  }
});

test("defers a waiting-list Trip with a recent active Payment", async () => {
  const store = new MemoryExpiryStore(
    [makeTrip({ status: "waiting_list", pickupTime: "07:59" })],
    [
      makePayment({
        createdAt: new Date(now.getTime() - 10 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 10 * 60 * 1000),
      }),
    ],
  );

  const result = await expire(store);

  assert.equal(result.expiredTrips, 0);
  assert.equal(store.trips.get("trip-1").status, "waiting_list");
  assert.equal(store.payments.get("payment-1").overallStatus, "kashier_pending");
});

test("expires a waiting-list Trip with a stale in-flight Payment and releases reservation", async () => {
  const store = new MemoryExpiryStore(
    [makeTrip({ status: "waiting_list", pickupTime: "07:59" })],
    [
      makePayment({
        walletStatus: "reserved",
        walletReservationTxId: "reservation-1",
        createdAt: new Date(now.getTime() - 31 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 31 * 60 * 1000),
      }),
    ],
  );
  const releasedReservations = [];

  const result = await expire(store, async (reservationTxId) => {
    releasedReservations.push(reservationTxId);
    return true;
  });

  assert.equal(result.expiredTrips, 1);
  assert.equal(result.cancelledPayments, 1);
  assert.equal(result.releasedWalletReservations, 1);
  assert.deepEqual(releasedReservations, ["reservation-1"]);
  assert.equal(store.trips.get("trip-1").status, "time_out");
  assert.equal(store.trips.get("trip-1").paymentStatus, "expired");
});

test("defers expiry while an in-flight Payment is within the 30-minute session lifetime", async () => {
  const store = new MemoryExpiryStore(
    [makeTrip()],
    [
      makePayment({
        createdAt: new Date(now.getTime() - 31 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 29 * 60 * 1000),
      }),
    ],
  );

  const result = await expire(store);

  assert.equal(result.expiredTrips, 0);
  assert.equal(store.trips.get("trip-1").status, "pending_payment");
});

test("expires an approved unpaid Trip once its Cairo pickup time has passed", async () => {
  const store = new MemoryExpiryStore([
    makeTrip({
      status: "approved",
      paymentStatus: "pending",
      pickupTime: "07:59",
    }),
  ]);

  const result = await expire(store);

  assert.equal(result.expiredTrips, 1);
  assert.equal(store.trips.get("trip-1").status, "time_out");
  assert.equal(store.trips.get("trip-1").paymentStatus, "expired");
  assert.deepEqual([...store.promoReleases], ["trip-1"]);
});

test("cancels an in-flight Payment and releases its wallet reservation", async () => {
  const store = new MemoryExpiryStore(
    [makeTrip()],
    [
      makePayment({
        walletStatus: "reserved",
        walletReservationTxId: "reservation-1",
      }),
    ],
  );
  const calls = [];
  const result = await expire(store, async (reservationTxId, options) => {
    calls.push({ reservationTxId, ...options });
    return true;
  });

  assert.equal(result.cancelledPayments, 1);
  assert.equal(result.releasedWalletReservations, 1);
  assert.deepEqual(calls, [
    {
      reservationTxId: "reservation-1",
      description: "Standalone trip trip-1 expired before payment.",
      paymentId: "payment-1",
      bookingId: "trip-1",
    },
  ]);
  assert.equal(store.payments.get("payment-1").overallStatus, "cancelled");
  assert.equal(store.payments.get("payment-1").gatewayStatus, "cancelled");
  assert.equal(store.payments.get("payment-1").walletStatus, "released");
});

test("leaves legacy Request-backed Trips to the unchanged Request expiry path", async () => {
  const legacyTrip = makeTrip({
    id: "legacy-trip",
    requestId: "request-1",
  });
  const store = new MemoryExpiryStore([legacyTrip]);
  const requestBefore = structuredClone(store.legacyRequests);

  const result = await expire(store);

  assert.equal(result.expiredTrips, 0);
  assert.equal(store.trips.get("legacy-trip").status, "pending_payment");
  assert.deepEqual(store.legacyRequests, requestBefore);
});

test("concurrent expiry runs claim the Trip and wallet release once", async () => {
  const store = new MemoryExpiryStore(
    [makeTrip()],
    [
      makePayment({
        walletStatus: "reserved",
        walletReservationTxId: "reservation-1",
      }),
    ],
  );
  let released = false;
  const release = async () => {
    if (released) return false;
    released = true;
    return true;
  };

  const results = await Promise.all([expire(store, release), expire(store, release)]);

  assert.equal(results.reduce((sum, result) => sum + result.expiredTrips, 0), 1);
  assert.equal(
    results.reduce(
      (sum, result) => sum + result.cancelledPayments,
      0,
    ),
    1,
  );
  assert.equal(
    results.reduce(
      (sum, result) => sum + result.releasedWalletReservations,
      0,
    ),
    1,
  );
  assert.equal(released, true);
  assert.equal(store.trips.get("trip-1").paymentStatus, "expired");
  assert.equal(store.payments.get("payment-1").walletStatus, "released");
  assert.deepEqual([...store.promoReleases], ["trip-1"]);
});
