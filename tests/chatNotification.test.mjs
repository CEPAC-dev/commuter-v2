import test from "node:test";
import assert from "node:assert/strict";

const { buildChatNotificationPlan } = await import(
  "../src/lib/chatNotification.ts"
);

const base = {
  recipientId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  tripId: "bbbbbbbbbbbbbbbbbbbbbbbb",
  rideId: "cccccccccccccccccccccccc",
  passengerNumber: 3,
};

test("driver notification presets map only the specified keys to the passenger", () => {
  for (const presetKey of [
    "arrived",
    "cant_find_you",
    "where_are_you",
    "running_late_2",
    "running_late_5",
  ]) {
    const plan = buildChatNotificationPlan({
      ...base,
      senderRole: "driver",
      kind: "preset",
      presetKey,
    });
    assert.equal(plan?.payload.userId, base.recipientId);
    assert.equal(plan?.payload.type, "trip_chat_message");
    assert.equal(plan?.throttleKey, presetKey);
    assert.equal(plan?.windowMs, 5 * 60_000);
    assert.equal(plan?.payload.data.linkUrl, `/my-trips/${base.tripId}`);
  }
  for (const presetKey of ["waiting", "starting_now"]) {
    assert.equal(
      buildChatNotificationPlan({
        ...base,
        senderRole: "driver",
        kind: "preset",
        presetKey,
      }),
      null,
    );
  }
});

test("passenger notification presets identify Passenger N and link the Ride Action Center", () => {
  for (const presetKey of ["at_pickup", "running_late", "on_my_way"]) {
    const plan = buildChatNotificationPlan({
      ...base,
      senderRole: "user",
      kind: "preset",
      presetKey,
    });
    assert.equal(plan?.payload.title.includes("Passenger 3"), true);
    assert.equal(plan?.payload.titleAr.includes("الراكب ٣"), true);
    assert.equal(plan?.throttleKey, presetKey);
    assert.equal(plan?.windowMs, 5 * 60_000);
    assert.equal(plan?.payload.data.linkUrl, `/my-trips/${base.rideId}`);
  }
  for (const presetKey of ["cant_see_you", "thanks"]) {
    assert.equal(
      buildChatNotificationPlan({
        ...base,
        senderRole: "user",
        kind: "preset",
        presetKey,
      }),
      null,
    );
  }
});

test("free-text notification is generic, identity-safe, and throttled per Trip for two minutes", () => {
  const passengerNotification = buildChatNotificationPlan({
    ...base,
    senderRole: "driver",
    kind: "text",
  });
  const driverNotification = buildChatNotificationPlan({
    ...base,
    senderRole: "user",
    kind: "text",
  });

  assert.equal(passengerNotification.payload.title, "New message from your driver");
  assert.equal(passengerNotification.payload.body, "You have a new message");
  assert.equal(driverNotification.payload.title, "New message from Passenger 3");
  assert.equal(driverNotification.payload.body, "You have a new message");
  assert.equal(passengerNotification.throttleKey, "free_text");
  assert.equal(passengerNotification.windowMs, 2 * 60_000);
  for (const plan of [passengerNotification, driverNotification]) {
    assert.equal("text" in plan.payload.data, false);
    assert.equal("presetKey" in plan.payload.data, false);
    assert.equal("message" in plan.payload.data, false);
    assert.equal(plan.payload.type, "trip_chat_message");
  }
});

test("server-generated payloads contain no client-provided preset label", () => {
  const plan = buildChatNotificationPlan({
    ...base,
    senderRole: "driver",
    kind: "preset",
    presetKey: "arrived",
  });
  assert.deepEqual(plan.payload.data, {
    tripId: base.tripId,
    rideId: base.rideId,
    linkUrl: `/my-trips/${base.tripId}`,
  });
  assert.equal(plan.payload.body.includes("arrived"), false);
});
