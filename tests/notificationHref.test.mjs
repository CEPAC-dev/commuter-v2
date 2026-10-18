import test from "node:test";
import assert from "node:assert/strict";

const { getNotificationHref } = await import(
  "../src/lib/notifications/notificationHref.ts"
);

test("stored notification URL takes precedence over trip fallback", () => {
  assert.equal(
    getNotificationHref({
      data: {
        linkUrl: "/custom/trip",
        tripId: "trip-1",
      },
    }),
    "/custom/trip",
  );
});

test("trip id takes precedence over legacy booking id", () => {
  assert.equal(
    getNotificationHref({
      data: {
        bookingId: "legacy-request",
        tripId: "trip-1",
      },
    }),
    "/my-trips/trip-1",
  );
});

test("booking id alone never creates a my-requests URL", () => {
  assert.equal(
    getNotificationHref({ data: { bookingId: "legacy-request" } }),
    "/my-trips",
  );
});

test("notification-specific wallet and ride-offer fallbacks remain intact", () => {
  assert.equal(
    getNotificationHref({ data: {}, type: "referral_bonus" }),
    "/wallet",
  );
  assert.equal(
    getNotificationHref({ data: {}, type: "ride_offer" }),
    "/ride-requests",
  );
});
