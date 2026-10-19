import test from "node:test";
import assert from "node:assert/strict";

const { getRideIncidentPassengerNotificationPayload } = await import(
  "../src/lib/notifications/rideIncidentPayload.ts"
);

test("passenger incident notification contains safe localized text and link", () => {
  const payload = getRideIncidentPassengerNotificationPayload({
    incidentId: "incident-123",
    tripId: "trip-456",
  });

  assert.equal(payload.type, "ride_incident");
  assert.equal(
    payload.body,
    "The driver reported a problem. Our team is following up.",
  );
  assert.equal(payload.data.linkUrl, "/my-trips/trip-456");
  assert.equal(payload.data.incidentId, "incident-123");
  assert.equal(payload.data.tripId, "trip-456");
  assert.equal(JSON.stringify(payload).includes("phone"), false);
  assert.equal(JSON.stringify(payload).includes("note"), false);
  assert.equal(JSON.stringify(payload).includes("driver name"), false);
});
