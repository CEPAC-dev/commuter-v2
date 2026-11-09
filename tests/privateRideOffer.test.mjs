import test from "node:test";
import assert from "node:assert/strict";

const {
  privateRideCounterpart,
  privateRideOfferExpiresAt,
  privateRidePrice,
  serializePrivateRideOffer,
} = await import("../src/lib/privateRideOffer.ts");
const { getCairoNowParts } = await import("../src/lib/time/cairoTime.ts");

test("maps supported shared vehicles to their private equivalents", () => {
  assert.equal(privateRideCounterpart("taxi_shared"), "taxi_private");
  assert.equal(privateRideCounterpart("shared_car"), "private_car");
  assert.equal(privateRideCounterpart("van_shared"), null);
});

test("prices a private offer from distance and regional rate", () => {
  assert.equal(privateRidePrice(12.4, 5.5), 68);
});

test("sets the offer deadline to 7 PM Cairo time on offer day", () => {
  const deadline = privateRideOfferExpiresAt("2026-10-25T15:05:00.000Z");
  assert.deepEqual(getCairoNowParts(deadline), {
    dateStr: "2026-10-25",
    timeStr: "19:00",
  });
});

test("offers sent at or after 7 PM Cairo time expire the following day", () => {
  const deadline = privateRideOfferExpiresAt("2026-10-25T16:00:00.000Z");
  assert.deepEqual(getCairoNowParts(deadline), {
    dateStr: "2026-10-26",
    timeStr: "19:00",
  });
});

test("serializes only plain private-ride offer values for client props", () => {
  assert.deepEqual(
    serializePrivateRideOffer({
      vehicleType: "private_car",
      priceEgp: 113,
      expiresAt: new Date("2026-10-25T16:00:00.000Z"),
      offeredBy: { toJSON() {} },
    }),
    {
      vehicleType: "private_car",
      priceEgp: 113,
      expiresAt: "2026-10-25T16:00:00.000Z",
    },
  );
  assert.equal(serializePrivateRideOffer(null), null);
  assert.equal(
    serializePrivateRideOffer({
      vehicleType: "taxi_private",
      priceEgp: 90,
      offeredAt: "2026-10-25T15:05:00.000Z",
    }).expiresAt,
    "2026-10-25T16:00:00.000Z",
  );
});

test("rejects invalid distance or regional rate", () => {
  assert.throws(() => privateRidePrice(-1, 5));
  assert.throws(() => privateRidePrice(10, Number.NaN));
});
