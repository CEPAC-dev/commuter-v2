import test from "node:test";
import assert from "node:assert/strict";
import { getVerifiedRoute } from "../src/lib/pricing/verifiedRoute.ts";

test("uses verified provider leg distances instead of the route total", async () => {
    const route = await getVerifiedRoute(
        [
            { lat: 30, lng: 31 },
            { lat: 30.1, lng: 31.1 },
            { lat: 30.2, lng: 31.2 },
        ],
        async () => [
            {
                coordinates: [[30, 31], [30.2, 31.2]],
                distance_km: 999,
                duration_minutes: 99,
                legs: [
                    { distanceKm: 4.2, durationMinutes: 8 },
                    { distanceKm: 3.8, durationMinutes: 7 },
                ],
            },
        ],
    );

    assert.equal(route?.distanceKm, 8);
    assert.equal(route?.durationMinutes, 15);
    assert.equal(route?.legs.length, 2);
});

test("rejects missing and malformed provider legs", async () => {
    const points = [
        { lat: 30, lng: 31 },
        { lat: 30.1, lng: 31.1 },
    ];
    const missingLegs = await getVerifiedRoute(points, async () => [
        { coordinates: [], distance_km: 1, duration_minutes: 1 },
    ]);
    const malformedLeg = await getVerifiedRoute(points, async () => [
        {
            coordinates: [],
            distance_km: 1,
            duration_minutes: 1,
            legs: [{ distanceKm: -1, durationMinutes: 1 }],
        },
    ]);
    const missingGeometry = await getVerifiedRoute(points, async () => [
        {
            coordinates: [],
            distance_km: 1,
            duration_minutes: 1,
            legs: [{ distanceKm: 1, durationMinutes: 1 }],
        },
    ]);

    assert.equal(missingLegs, null);
    assert.equal(malformedLeg, null);
    assert.equal(missingGeometry, null);
});