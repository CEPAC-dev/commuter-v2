import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";

const {
  createRequestGroupWith,
  InvalidRequestGroupError,
  RequestGroupPromoError,
  saveRequestGroup,
} = await import("../src/lib/requestGroupCreation.ts");
const { bookingWindow } = await import("../src/lib/time/bookingDates.ts");
const {
  isMultiDayRequestsEnabled,
  shouldCreateRequestGroup,
} = await import("../src/lib/config/featureFlags.ts");
const { Request } = await import("../src/models/Request.ts");
const { groupTripsByRequest } = await import("../src/lib/groupRequestTrips.ts");
const {
  resolvePayableBookingWith,
} = await import("../src/lib/payments/resolvePayableBookingRecord.ts");
const {
  buildWaitingListTransitionFilter,
  buildWaitingListReviewUpdate,
  mapWaitingListRequest,
} = await import("../src/lib/admin/waitingList.ts");
const {
  buildPendingRequestExpiryFilter,
  buildPendingTripExpiryFilter,
} = await import("../src/lib/pendingRequestHardening.ts");
const {
  isStandaloneTripRecord,
} = await import("../src/lib/payments/resolvePayableBookingRecord.ts");

class MemoryGroupStore {
  constructor({
    trips = [],
    promoLimit = Infinity,
    failPromoCall = null,
    failInsertDate = null,
  } = {}) {
    this.trips = structuredClone(trips);
    this.requests = [];
    this.promoUsages = [];
    this.promoCalls = [];
    this.transactionCount = 0;
    this.promoLimit = promoLimit;
    this.failPromoCall = failPromoCall;
    this.failInsertDate = failInsertDate;
  }

  async withTransaction(work) {
    this.transactionCount += 1;
    const tripsSnapshot = structuredClone(this.trips);
    const requestsSnapshot = structuredClone(this.requests);
    const promoSnapshot = structuredClone(this.promoUsages);
    try {
      return await work({ inTransaction: true });
    } catch (error) {
      this.trips = tripsSnapshot;
      this.requests = requestsSnapshot;
      this.promoUsages = promoSnapshot;
      throw error;
    }
  }

  async acquireLocks() {}

  async countPendingUnpaid() {
    return this.trips.filter((trip) =>
      ["pending_payment", "waiting_list"].includes(trip.status) ||
      (trip.status === "approved" &&
        !["paid", "refunded"].includes(trip.paymentStatus)),
    ).length;
  }

  async findSpacingWindows(_session, _userId, dates) {
    return this.trips
      .filter(
        (trip) =>
          dates.includes(trip.date) &&
          ["pending_payment", "waiting_list", "approved", "submitted"].includes(
            trip.status,
          ),
      )
      .map(({ date, arrivalTime, status }) => ({ date, arrivalTime, status }));
  }

  async applyPromo(_session, _userId, tripId) {
    this.promoCalls.push(tripId);
    if (this.promoCalls.length === this.failPromoCall) {
      throw new Error("promo reservation failed");
    }
    if (this.promoUsages.length >= this.promoLimit) {
      return { success: false, message: "Promo unavailable" };
    }
    this.promoUsages.push({ tripId });
    return {
      success: true,
      discountType: "percentage",
      discountValue: 10,
      promoCodeId: "promo-id",
      usageId: `usage-${tripId}`,
    };
  }

  async saveRequest(_session, request) {
    this.requests.push(request);
  }

  async insert(_session, documents) {
    if (documents.some((document) => document.date === this.failInsertDate)) {
      throw new Error("trip insert failed");
    }
    this.trips.push(...structuredClone(documents));
  }
}

function makeGroupInput(dates, options = {}) {
  const requestId = options.requestId ?? "request-id";
  const candidates = dates.map((date, index) => ({
    id: `trip-${index + 1}`,
    date,
    arrivalTime: options.arrivalTimes?.[index] ?? "10:00",
    basePriceEgp: options.prices?.[index] ?? 100,
    payload: { cycleIndex: 0, routeCount: 1 },
  }));
  return {
    userId: "user-id",
    dates,
    allowedDates: options.allowedDates ?? bookingWindow(),
    routeCount: options.routeCount ?? 1,
    cycleCount: options.cycleCount ?? 1,
    candidates,
    maxPendingUnpaidTrips: options.maxPendingUnpaidTrips ?? 10,
    promoCode: options.promoCode ?? null,
    computeDiscountedPrice: (price, type, value) =>
      type === "percentage"
        ? Math.max(0, price * (1 - value / 100))
        : Math.max(0, price - value),
    buildDocument: async (candidate) => ({
      _id: candidate.id,
      requestId,
      date: candidate.date,
      arrivalTime: candidate.arrivalTime,
      priceEgp: candidate.priceEgp,
      status: "pending_payment",
      paymentStatus: "pending",
      ...(candidate.promoApply
        ? { appliedPromoCode: candidate.promoApply.promoCodeId }
        : {}),
    }),
    buildRequest: (prepared, documents, amountEgp) => ({
      _id: requestId,
      status: options.requestStatus ?? "pending_payment",
      paymentStatus: "pending",
      dates: prepared.map((candidate) => candidate.date),
      tripIds: documents.map((trip) => trip._id),
      amountEgp,
    }),
  };
}

test("the server flag defaults off and Request creation requires multiple dates", () => {
  const previous = process.env.MULTI_DAY_REQUESTS_ENABLED;
  try {
    delete process.env.MULTI_DAY_REQUESTS_ENABLED;
    assert.equal(isMultiDayRequestsEnabled(), false);
    assert.equal(shouldCreateRequestGroup(false, 2), false);
    assert.equal(shouldCreateRequestGroup(true, 1), false);
    process.env.MULTI_DAY_REQUESTS_ENABLED = "true";
    assert.equal(isMultiDayRequestsEnabled(), true);
    assert.equal(shouldCreateRequestGroup(true, 2), true);
    process.env.MULTI_DAY_REQUESTS_ENABLED = "1";
    assert.equal(isMultiDayRequestsEnabled(), false);
  } finally {
    if (previous === undefined) delete process.env.MULTI_DAY_REQUESTS_ENABLED;
    else process.env.MULTI_DAY_REQUESTS_ENABLED = previous;
  }
});

test("creates a two-date Request with children and final summed prices in one transaction", async () => {
  const dates = bookingWindow().slice(0, 2);
  const store = new MemoryGroupStore();
  const result = await createRequestGroupWith(
    store,
    makeGroupInput(dates, { prices: [120, 80] }),
  );

  assert.equal(store.transactionCount, 1);
  assert.equal(store.requests.length, 1);
  assert.equal(store.trips.length, 2);
  assert.equal(result.request.amountEgp, 200);
  assert.deepEqual(
    result.request.tripIds,
    result.documents.map((trip) => trip._id),
  );
  assert.deepEqual(
    result.documents.map((trip) => trip.requestId),
    ["request-id", "request-id"],
  );
  assert.ok(result.documents.every((trip) => !("batchId" in trip)));
  assert.ok(
    result.documents.every(
      (trip) =>
        trip.status === "pending_payment" &&
        trip.paymentStatus === "pending",
    ),
  );
});

test("creates the maximum seven-date Request with each child counted toward the pending cap", async () => {
  const dates = bookingWindow();
  const store = new MemoryGroupStore();
  const result = await createRequestGroupWith(
    store,
    makeGroupInput(dates),
  );
  assert.equal(result.documents.length, 7);
  assert.equal(result.request.tripIds.length, 7);
  assert.equal(result.request.amountEgp, 700);

  const fullStore = new MemoryGroupStore({
    trips: Array.from({ length: 4 }, (_, index) => ({
      id: `existing-${index}`,
      date: "2099-01-01",
      arrivalTime: "10:00",
      status: "pending_payment",
      paymentStatus: "pending",
    })),
  });
  await assert.rejects(
    createRequestGroupWith(
      fullStore,
      makeGroupInput(dates, { maxPendingUnpaidTrips: 10 }),
    ),
    /Too many pending trips/,
  );
  assert.equal(fullStore.requests.length, 0);
  assert.equal(fullStore.trips.length, 4);
});

test("rejects more than seven dates, duplicates, out-of-window dates, and extra routes or cycles before writes", async () => {
  const dates = bookingWindow();
  for (const input of [
    makeGroupInput([...dates, "2099-01-01"], {
      allowedDates: [...dates, "2099-01-01"],
    }),
    makeGroupInput([dates[0], dates[0]]),
    makeGroupInput([dates[0], "2099-01-01"]),
    makeGroupInput(dates.slice(0, 2), { routeCount: 2 }),
    makeGroupInput(dates.slice(0, 2), { cycleCount: 2 }),
  ]) {
    const store = new MemoryGroupStore();
    await assert.rejects(
      createRequestGroupWith(store, input),
      InvalidRequestGroupError,
    );
    assert.equal(store.requests.length, 0);
    assert.equal(store.trips.length, 0);
    assert.equal(store.promoUsages.length, 0);
  }
});

test("a spacing conflict with an existing holding Trip aborts before promo reservation", async () => {
  const dates = bookingWindow().slice(0, 2);
  const store = new MemoryGroupStore({
    trips: [{
      id: "existing",
      date: dates[1],
      arrivalTime: "10:00",
      status: "waiting_list",
      paymentStatus: "pending",
    }],
  });
  await assert.rejects(
    createRequestGroupWith(
      store,
      makeGroupInput(dates, { promoCode: "SAVE" }),
    ),
    /conflicts with another trip/,
  );
  assert.equal(store.requests.length, 0);
  assert.equal(store.trips.length, 1);
  assert.deepEqual(store.promoUsages, []);
});

test("duplicate same-day children are rejected rather than bypassing the group spacing rule", async () => {
  const date = bookingWindow()[0];
  const input = makeGroupInput([date, date], { promoCode: "SAVE" });
  const store = new MemoryGroupStore();
  await assert.rejects(
    createRequestGroupWith(store, input),
    InvalidRequestGroupError,
  );
  assert.equal(store.requests.length, 0);
  assert.equal(store.trips.length, 0);
  assert.deepEqual(store.promoUsages, []);
});

test("promo is reserved and applied per child; an error on a later child rolls back all reservations", async () => {
  const dates = bookingWindow().slice(0, 3);
  const store = new MemoryGroupStore();
  const result = await createRequestGroupWith(
    store,
    makeGroupInput(dates, { promoCode: "SAVE" }),
  );
  assert.deepEqual(store.promoCalls, ["trip-1", "trip-2", "trip-3"]);
  assert.equal(store.promoUsages.length, 3);
  assert.deepEqual(
    result.documents.map((trip) => trip.priceEgp),
    [90, 90, 90],
  );
  assert.equal(result.request.amountEgp, 270);

  const failingStore = new MemoryGroupStore({ failPromoCall: 3 });
  await assert.rejects(
    createRequestGroupWith(
      failingStore,
      makeGroupInput(dates, { promoCode: "SAVE" }),
    ),
    /promo reservation failed/,
  );
  assert.equal(failingStore.requests.length, 0);
  assert.equal(failingStore.trips.length, 0);
  assert.deepEqual(failingStore.promoUsages, []);

  const unavailableStore = new MemoryGroupStore({ promoLimit: 1 });
  await assert.rejects(
    createRequestGroupWith(
      unavailableStore,
      makeGroupInput(dates, { promoCode: "SAVE" }),
    ),
    RequestGroupPromoError,
  );
  assert.equal(unavailableStore.requests.length, 0);
  assert.equal(unavailableStore.trips.length, 0);
  assert.deepEqual(unavailableStore.promoUsages, []);
});

test("a child insert failure rolls back the Request and all promo reservations", async () => {
  const dates = bookingWindow().slice(0, 3);
  const store = new MemoryGroupStore({ failInsertDate: dates[2] });
  await assert.rejects(
    createRequestGroupWith(
      store,
      makeGroupInput(dates, { promoCode: "SAVE" }),
    ),
    /trip insert failed/,
  );
  assert.equal(store.requests.length, 0);
  assert.equal(store.trips.length, 0);
  assert.deepEqual(store.promoUsages, []);
});

test("a created group displays once, reviews as a Request, and resolves payment as a Request", async () => {
  const dates = bookingWindow().slice(0, 2);
  const store = new MemoryGroupStore();
  const result = await createRequestGroupWith(
    store,
    makeGroupInput(dates, { requestStatus: "waiting_list" }),
  );
  const groupedTrips = groupTripsByRequest(
    result.documents.map((trip) => ({
      id: trip._id,
      requestId: trip.requestId,
      isStandalone: false,
      date: trip.date,
      status: trip.status,
    })),
  );
  assert.equal(groupedTrips.length, 1);
  assert.equal(groupedTrips[0].kind, "group");
  assert.equal(groupedTrips[0].trips.length, 2);
  assert.equal(result.request.status, "waiting_list");
  assert.deepEqual(
    buildWaitingListTransitionFilter(result.request._id),
    { _id: "request-id", status: "waiting_list" },
  );
  assert.equal(
    buildWaitingListReviewUpdate(
      "approve",
      "admin-id",
      new Date("2026-10-10T10:00:00.000Z"),
    ).$set.status,
    "approved",
  );
  assert.equal(
    buildWaitingListReviewUpdate(
      "reject",
      "admin-id",
      new Date("2026-10-10T10:00:00.000Z"),
      "No seats",
    ).$set.status,
    "rejected",
  );
  const mapped = mapWaitingListRequest({
    request: {
      _id: "request-id",
      createdAt: new Date(),
      amountEgp: result.request.amountEgp,
      status: "waiting_list",
    },
    passenger: { name: "Passenger", phone: "", email: "" },
    trips: result.documents,
    promoCodes: [],
    hasPastTrip: false,
  });
  assert.equal(mapped.kind, "request");
  assert.equal(mapped.trips.length, 2);

  const resolved = await resolvePayableBookingWith(
    async () => null,
    async () => ({
      amountEgp: result.request.amountEgp,
      paymentStatus: "pending",
      status: "pending_payment",
    }),
  );
  assert.equal(resolved.kind, "request");
  assert.equal(resolved.amountEgp, result.request.amountEgp);

  assert.equal(
    isStandaloneTripRecord({
      requestId: result.request._id,
      priceEgp: 100,
      paymentStatus: "pending",
      status: "pending_payment",
    }),
    false,
  );
  assert.deepEqual(
    buildPendingRequestExpiryFilter(new Date("2026-10-20T10:00:00.000Z")),
    {
      status: "pending_payment",
      paymentStatus: { $in: ["pending", "failed"] },
      createdAt: { $lte: new Date("2026-10-20T10:00:00.000Z") },
    },
  );
  assert.deepEqual(buildPendingTripExpiryFilter([result.request._id]), {
    requestId: { $in: ["request-id"] },
    status: "pending_payment",
  });
});

test("unmarked Request save is blocked while the transaction helper authorizes a marked save", async () => {
  const unmarked = new Request({
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    dates: ["2026-10-11", "2026-10-12"],
    tripIds: [],
    amountEgp: 100,
    paymentStatus: "pending",
    status: "pending_payment",
  });
  await assert.rejects(unmarked.save(), /Request creation is disabled/);

  const request = new Request({
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    dates: ["2026-10-11", "2026-10-12"],
    tripIds: [],
    amountEgp: 100,
    paymentStatus: "pending",
    status: "pending_payment",
  });
  const collection = Request.collection;
  const originalInsertOne = collection.insertOne;
  let inserted = false;
  collection.insertOne = async () => {
    inserted = true;
    return { acknowledged: true, insertedId: request._id };
  };
  try {
    await saveRequestGroup(
      request,
      { inTransaction: () => true },
    );
    assert.equal(inserted, true);
    assert.equal(request.$locals.groupCreationApproved, true);
  } finally {
    collection.insertOne = originalInsertOne;
  }
});
