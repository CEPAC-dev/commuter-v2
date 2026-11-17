import test from "node:test";
import assert from "node:assert/strict";

const { Notification } = await import("../src/models/Notification.ts");

test("notification model accepts ride_assigned events", () => {
    const typeEnum = Notification.schema.path("type").enumValues;

    assert.ok(typeEnum.includes("driver_assigned"));
    assert.ok(typeEnum.includes("ride_assigned"));
});
