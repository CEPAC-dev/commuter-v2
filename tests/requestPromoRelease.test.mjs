import test from "node:test";
import assert from "node:assert/strict";

const { releasePromoForRequestWith } = await import(
  "../src/lib/requestPromoRelease.ts"
);

function makeStore({ paymentStatus = "pending", status = "time_out", promo = true } = {}) {
  const request = { paymentStatus, status };
  const trips = [
    { id: "trip-1", status: "time_out", paymentStatus: "pending" },
    { id: "trip-2", status: "time_out", paymentStatus: "pending" },
  ];
  const usages = new Map(
    promo
      ? [
          ["trip-1", 1],
          ["trip-2", 1],
        ]
      : [],
  );
  let decremented = 0;

  return {
    usages,
    get decremented() {
      return decremented;
    },
    async getRequest() {
      return request;
    },
    async findTripsForRequest() {
      return trips;
    },
    async releaseTrip(tripId) {
      if (!usages.delete(tripId)) return 0;
      decremented += 1;
      return 1;
    },
  };
}

test("Request expiry releases every child promo usage only once", async () => {
  const store = makeStore();

  assert.equal(await releasePromoForRequestWith(store, "request-1"), 2);
  assert.equal(await releasePromoForRequestWith(store, "request-1"), 0);
  assert.equal(store.usages.size, 0);
  assert.equal(store.decremented, 2);
});

test("concurrent expiry and admin rejection release each child usage once", async () => {
  const store = makeStore({ status: "rejected" });

  const results = await Promise.all([
    releasePromoForRequestWith(store, "request-1"),
    releasePromoForRequestWith(store, "request-1"),
  ]);

  assert.equal(results.reduce((sum, count) => sum + count, 0), 2);
  assert.equal(store.usages.size, 0);
  assert.equal(store.decremented, 2);
});

test("paid Requests do not release promo usage", async () => {
  const store = makeStore({ paymentStatus: "paid" });

  assert.equal(await releasePromoForRequestWith(store, "request-1"), 0);
  assert.equal(store.usages.size, 2);
  assert.equal(store.decremented, 0);
});

test("Requests without promo usage are unaffected", async () => {
  const store = makeStore({ promo: false });

  assert.equal(await releasePromoForRequestWith(store, "request-1"), 0);
  assert.equal(store.usages.size, 0);
  assert.equal(store.decremented, 0);
});
