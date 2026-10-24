import test from "node:test";
import assert from "node:assert/strict";

const {
  privateRideCounterpart,
  privateRidePrice,
  serializePrivateRideOffer,
} = await import("../src/lib/privateRideOffer.ts");

test("maps supported shared vehicles to their private equivalents", () => {
  assert.equal(privateRideCounterpart("taxi_shared"), "taxi_private");
  assert.equal(privateRideCounterpart("shared_car"), "private_car");
  assert.equal(privateRideCounterpart("van_shared"), null);
});

test("prices a private offer from distance and regional rate", () => {
  assert.equal(privateRidePrice(12.4, 5.5), 68);
});

test("serializes only plain private-ride offer values for client props", () => {
  assert.deepEqual(
    serializePrivateRideOffer({
      vehicleType: "private_car",
      priceEgp: 113,
      offeredBy: { toJSON() {} },
    }),
    { vehicleType: "private_car", priceEgp: 113 },
  );
  assert.equal(serializePrivateRideOffer(null), null);
});

test("rejects invalid distance or regional rate", () => {
  assert.throws(() => privateRidePrice(-1, 5));
  assert.throws(() => privateRidePrice(10, Number.NaN));
});
