import test from "node:test";
import assert from "node:assert/strict";
import {
    isCarTypeCompatible,
    normalizeCarType,
} from "../src/lib/config/driver.ts";

test("maps driver car types only to their compatible passenger vehicles", () => {
    const expected = {
        passenger_car: ["private_car", "shared_car"],
        taxi: ["taxi_private", "taxi_shared"],
        van: ["van_shared"],
        microbus: ["microbus_shared"],
        minibus: ["mini_bus"],
    };

    for (const [carType, vehicles] of Object.entries(expected)) {
        for (const vehicleType of vehicles) {
            assert.equal(isCarTypeCompatible(carType, vehicleType), true);
        }
    }
    assert.equal(isCarTypeCompatible("passenger_car", "mini_bus"), false);
    assert.equal(isCarTypeCompatible("unknown", "taxi_shared"), false);
    assert.equal(isCarTypeCompatible(undefined, "taxi_shared"), false);
});

test("normalizes persisted legacy private car types for the migration window", () => {
    assert.equal(normalizeCarType("private"), "passenger_car");
    assert.equal(normalizeCarType("passenger_car"), "passenger_car");
    assert.equal(normalizeCarType("minibus"), "minibus");
    assert.equal(normalizeCarType("unknown"), "");
    assert.equal(normalizeCarType("toString"), "");
});