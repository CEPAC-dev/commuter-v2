import test from "node:test";
import assert from "node:assert/strict";

const {
  createTripBatchWith,
  TooManyPendingTripsError,
  TripBatchSpacingConflictError,
} = await import("../src/lib/tripBatchCreation.ts");
const { priceForSelectedDate } = await import(
  "../src/lib/config/vehicles.ts"
);

class MemoryBatchStore {
  constructor({ trips = [], promoLimit = Infinity, failInsertDate = null } = {}) {
    this.trips = structuredClone(trips);
    this.promoUsages = [];
    this.promoCalls = [];
    this.lockCalls = [];
    this.transactionCount = 0;
    this.promoLimit = promoLimit;
    this.failInsertDate = failInsertDate;
    this.transactionTail = Promise.resolve();
  }

  async withTransaction(work) {
    const previous = this.transactionTail;
    let release;
    this.transactionTail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    this.transactionCount += 1;
    const tripSnapshot = structuredClone(this.trips);
    const promoSnapshot = structuredClone(this.promoUsages);
    try {
      return await work({});
    } catch (error) {
      this.trips = tripSnapshot;
      this.promoUsages = promoSnapshot;
      throw error;
    } finally {
      release();
    }
  }

  async acquireLocks(_session, dates) {
    this.lockCalls.push([...dates]);
  }

  async countPendingUnpaid() {
    return this.trips.filter((trip) =>
      ["pending_payment", "waiting_list"].includes(trip.status) ||
      (trip.status === "approved" && trip.paymentStatus !== "paid" &&
        trip.paymentStatus !== "refunded")
    ).length;
  }

  async findSpacingWindows(_session, _userId, dates) {
    return this.trips
      .filter((trip) => dates.includes(trip.date))
      .map(({ date, arrivalTime, status }) => ({ date, arrivalTime, status }));
  }

  async applyPromo(_session, _userId, tripId) {
    this.promoCalls.push(tripId);
    if (this.promoUsages.length >= this.promoLimit) {
      return { success: false, message: "Promo unavailable" };
    }
    const usageId = `usage-${tripId}`;
    this.promoUsages.push({ tripId, usageId });
    return {
      success: true,
      discountType: "percentage",
      discountValue: 10,
      promoCodeId: "promo-1",
      usageId,
    };
  }

  async insert(_session, documents) {
    if (documents.some((document) => document.date === this.failInsertDate)) {
      throw new Error("insert failure");
    }
    this.trips.push(...structuredClone(documents));
  }
}

function makeInput(dates, options = {}) {
  const batchId = options.batchId ?? "batch-shared";
  return {
    userId: "user-1",
    dates,
    candidates: dates.map((date, index) => ({
      id: `trip-${index + 1}`,
      date,
      arrivalTime: "10:00",
      basePriceEgp: options.prices?.[index] ?? 100,
      payload: { clientPrice: 9999 },
    })),
    maxPendingUnpaidTrips: 10,
    promoCode: options.promoCode ?? null,
    computeDiscountedPrice: (price, type, value) =>
      type === "percentage"
        ? Math.max(0, price * (1 - value / 100))
        : Math.max(0, price - value),
    buildDocument: async (candidate) => ({
      id: candidate.id,
      date: candidate.date,
      priceEgp: candidate.priceEgp,
      status: options.waitlist ? "waiting_list" : "pending_payment",
      paymentStatus: "pending",
      batchId,
      appliedPromoCode: candidate.promoApply?.promoCodeId ?? null,
    }),
  };
}

const testDates = [
  "2099-01-01",
  "2099-01-02",
  "2099-01-03",
  "2099-01-04",
];

test("creates one standalone Trip per date in one transaction with shared batchId", async () => {
  const store = new MemoryBatchStore();
  const result = await createTripBatchWith(
    store,
    makeInput(testDates.slice(0, 3)),
  );
  assert.equal(store.transactionCount, 1);
  assert.equal(store.trips.length, 3);
  assert.ok(store.trips.every((trip) => trip.batchId === "batch-shared"));
  assert.ok(store.trips.every((trip) => !("requestId" in trip)));
  assert.deepEqual(
    store.trips.map(({ date }) => date),
    testDates.slice(0, 3),
  );
  assert.deepEqual(result.documents.map(({ priceEgp }) => priceEgp), [
    100,
    100,
    100,
  ]);
});

test("a spacing conflict rolls back the whole batch before any promo reservation", async () => {
  const store = new MemoryBatchStore({
    trips: [{
      id: "existing",
      date: testDates[1],
      arrivalTime: "10:00",
      status: "pending_payment",
      paymentStatus: "pending",
    }],
  });
  await assert.rejects(
    createTripBatchWith(store, makeInput(testDates.slice(0, 3), {
      promoCode: "SAVE",
    })),
    TripBatchSpacingConflictError,
  );
  assert.equal(store.trips.length, 1);
  assert.deepEqual(store.promoUsages, []);
  assert.deepEqual(store.promoCalls, []);
});

test("invalid batch dates and server prices fail before promo usage or insertion", async () => {
  const store = new MemoryBatchStore();
  await assert.rejects(
    createTripBatchWith(store, makeInput([testDates[0], "not-a-date"])),
    RangeError,
  );
  await assert.rejects(
    createTripBatchWith(store, {
      ...makeInput([testDates[0]], { promoCode: "SAVE" }),
      candidates: [{
        ...makeInput([testDates[0]]).candidates[0],
        basePriceEgp: Number.NaN,
      }],
    }),
    RangeError,
  );
  assert.equal(store.trips.length, 0);
  assert.deepEqual(store.promoUsages, []);
  assert.deepEqual(store.promoCalls, []);
});

test("the pending cap counts pending, waiting-list, and approved-unpaid Trips", async () => {
  const store = new MemoryBatchStore({
    trips: Array.from({ length: 10 }, (_, index) => ({
      id: `pending-${index}`,
      status: index === 9 ? "approved" : "pending_payment",
      paymentStatus: "pending",
      date: testDates[0],
      arrivalTime: "08:00",
    })),
  });
  await assert.rejects(
    createTripBatchWith(store, makeInput([testDates[1]])),
    TooManyPendingTripsError,
  );
  assert.equal(store.trips.length, 10);
});

test("prices each date server-side and ignores client-supplied prices", async () => {
  const { bookingWindow } = await import("../src/lib/time/bookingDates.ts");
  const dates = bookingWindow();
  const store = new MemoryBatchStore();
  const prices = dates.map((date) => priceForSelectedDate(125, date, dates));
  const input = makeInput(dates, { prices });
  const result = await createTripBatchWith(store, input);
  assert.deepEqual(
    result.documents.map((document) => document.priceEgp),
    prices,
  );
  assert.ok(
    result.documents.every(
      (document) => document.priceEgp !== input.candidates[0].payload.clientPrice,
    ),
  );
  assert.equal(prices.at(-1), 119);
});

test("promo usage is reserved once per Trip and discounts each Trip", async () => {
  const store = new MemoryBatchStore();
  const result = await createTripBatchWith(
    store,
    makeInput(testDates.slice(0, 3), { promoCode: "SAVE" }),
  );
  assert.deepEqual(store.promoCalls, ["trip-1", "trip-2", "trip-3"]);
  assert.equal(store.promoUsages.length, 3);
  assert.deepEqual(result.documents.map(({ priceEgp }) => priceEgp), [
    90,
    90,
    90,
  ]);
});

test("promo application remains per-Trip when the code runs out during a batch", async () => {
  const store = new MemoryBatchStore({ promoLimit: 1 });
  const result = await createTripBatchWith(
    store,
    makeInput(testDates.slice(0, 3), { promoCode: "SAVE" }),
  );
  assert.deepEqual(result.documents.map(({ priceEgp }) => priceEgp), [
    90,
    100,
    100,
  ]);
  assert.equal(store.promoUsages.length, 1);
  assert.equal(result.promoFailureMessage, "Promo unavailable");
});

test("a failed insert rolls back every per-Trip promo reservation", async () => {
  const store = new MemoryBatchStore({ failInsertDate: testDates[1] });
  await assert.rejects(
    createTripBatchWith(
      store,
      makeInput(testDates.slice(0, 3), { promoCode: "SAVE" }),
    ),
    /insert failure/,
  );
  assert.equal(store.trips.length, 0);
  assert.deepEqual(store.promoUsages, []);
});

test("all Trips receive the same waitlist state", async () => {
  const store = new MemoryBatchStore();
  const result = await createTripBatchWith(
    store,
    makeInput(testDates.slice(0, 2), { waitlist: true }),
  );
  assert.ok(result.documents.every((trip) => trip.status === "waiting_list"));
});

test("concurrent batches cannot exceed the pending-trip cap", async () => {
  const store = new MemoryBatchStore({
    trips: Array.from({ length: 8 }, (_, index) => ({
      id: `pending-${index}`,
      status: "pending_payment",
      paymentStatus: "pending",
      date: `2098-12-${String(index + 1).padStart(2, "0")}`,
      arrivalTime: "08:00",
    })),
  });
  const attempts = await Promise.allSettled([
    createTripBatchWith(store, makeInput(testDates.slice(0, 2))),
    createTripBatchWith(store, makeInput(testDates.slice(2, 4))),
  ]);
  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
  assert.equal(store.trips.length, 10);
});
