import { describe, it } from "node:test";
import assert from "node:assert/strict";
const {
  getPassengerRouteCoordinates,
  shouldSliceRoute,
  sliceRouteForUser,
} = await import("../src/lib/routeSlicing.ts");

// Mock the route slicing utilities
function distance(p1, p2) {
  const R = 6371;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

describe("routeSlicing", () => {
  describe("sliceRouteForUser", () => {
    it("should return full route for single passenger", () => {
      const route = [
        { lat: 30.0, lng: 31.0 },
        { lat: 30.1, lng: 31.1 },
        { lat: 30.2, lng: 31.2 },
      ];
      const stops = [
        { point: { lat: 30.0, lng: 31.0, address: "Start" } },
        { point: { lat: 30.2, lng: 31.2, address: "End" } },
      ];

      const result = sliceRouteForUser({
        route,
        stops,
        userPickupIndex: 0,
        userDropoffIndex: 1,
      });

      assert.equal(result.length, 3, "Should return all waypoints for 2-stop ride");
    });

    it("should slice route for middle passenger (2-stop ride, passenger sees stops 1→2)", () => {
      const route = [
        { lat: 30.0, lng: 31.0 }, // Stop 0
        { lat: 30.05, lng: 31.05 }, // Waypoint
        { lat: 30.1, lng: 31.1 }, // Stop 1
        { lat: 30.15, lng: 31.15 }, // Waypoint
        { lat: 30.2, lng: 31.2 }, // Stop 2
      ];
      const stops = [
        { point: { lat: 30.0, lng: 31.0, address: "Stop 0" } },
        { point: { lat: 30.1, lng: 31.1, address: "Stop 1" } },
        { point: { lat: 30.2, lng: 31.2, address: "Stop 2" } },
      ];

      const result = sliceRouteForUser({
        route,
        stops,
        userPickupIndex: 1,
        userDropoffIndex: 2,
      });

      assert.ok(result.length >= 2, "Should have at least pickup and dropoff waypoints");
      assert.ok(result.length < route.length, "Should be shorter than full route");
      assert.deepEqual(result[0], { lat: 30.1, lng: 31.1 }, "Should start at stop 1");
      assert.deepEqual(
        result[result.length - 1],
        { lat: 30.2, lng: 31.2 },
        "Should end at stop 2"
      );
    });

    it("should slice route for 4-stop ride, passenger 2→4", () => {
      const route = [
        { lat: 30.0, lng: 31.0 }, // Stop 0
        { lat: 30.025, lng: 31.025 },
        { lat: 30.05, lng: 31.05 }, // Stop 1
        { lat: 30.075, lng: 31.075 },
        { lat: 30.1, lng: 31.1 }, // Stop 2
        { lat: 30.125, lng: 31.125 },
        { lat: 30.15, lng: 31.15 }, // Stop 3
        { lat: 30.175, lng: 31.175 },
        { lat: 30.2, lng: 31.2 }, // Stop 4
      ];
      const stops = [
        { point: { lat: 30.0, lng: 31.0, address: "Stop 0" } },
        { point: { lat: 30.05, lng: 31.05, address: "Stop 1" } },
        { point: { lat: 30.1, lng: 31.1, address: "Stop 2" } },
        { point: { lat: 30.15, lng: 31.15, address: "Stop 3" } },
        { point: { lat: 30.2, lng: 31.2, address: "Stop 4" } },
      ];

      const result = sliceRouteForUser({
        route,
        stops,
        userPickupIndex: 2,
        userDropoffIndex: 4,
      });
      assert.ok(result.length >= 3, "Should have at least 3 waypoints (2→3→4)");
      assert.ok(result.length < route.length, "Should be shorter than full route");
      const firstDist = distance(result[0], { lat: 30.1, lng: 31.1 });
      assert.ok(firstDist < 0.01, "Should start near stop 2");
      const lastDist = distance(result[result.length - 1], {
        lat: 30.2,
        lng: 31.2,
      });
      assert.ok(lastDist < 0.01, "Should end near stop 4");
    });

      it("slices a passenger whose boarding and alighting stops are in the middle", () => {
        const route = [
          { lat: 30.0, lng: 31.0 },
          { lat: 30.05, lng: 31.05 },
          { lat: 30.1, lng: 31.1 },
          { lat: 30.15, lng: 31.15 },
          { lat: 30.2, lng: 31.2 },
        ];
        const stops = [
          { point: { lat: 30.0, lng: 31.0, address: "Start" } },
          { point: { lat: 30.1, lng: 31.1, address: "Middle pickup" } },
          { point: { lat: 30.2, lng: 31.2, address: "Middle dropoff" } },
          { point: { lat: 30.3, lng: 31.3, address: "End" } },
        ];

        const result = getPassengerRouteCoordinates({
          route,
          stops,
          pickup: "Middle pickup",
          dropoff: "Middle dropoff",
        });

        assert.deepEqual(result, route.slice(2, 5));
      });

      it("includes route endpoints when the passenger boards at the start and alights at the end", () => {
        const route = [
          { lat: 30.0, lng: 31.0 },
          { lat: 30.1, lng: 31.1 },
          { lat: 30.2, lng: 31.2 },
          { lat: 30.3, lng: 31.3 },
        ];
        const stops = [
          { point: { lat: 30.0, lng: 31.0, address: "Start" } },
          { point: { lat: 30.1, lng: 31.1, address: "Stop 1" } },
          { point: { lat: 30.2, lng: 31.2, address: "Stop 2" } },
          { point: { lat: 30.3, lng: 31.3, address: "End" } },
        ];

        const result = getPassengerRouteCoordinates({
          route,
          stops,
          pickup: "Start",
          dropoff: "End",
        });

        assert.deepEqual(result, route);
      });

      it("slices from the route start when pickup is the first stop", () => {
        const route = [
          { lat: 30.0, lng: 31.0 },
          { lat: 30.1, lng: 31.1 },
          { lat: 30.2, lng: 31.2 },
          { lat: 30.3, lng: 31.3 },
        ];
        const stops = [
          { point: { lat: 30.0, lng: 31.0, address: "Start" } },
          { point: { lat: 30.1, lng: 31.1, address: "Stop 1" } },
          { point: { lat: 30.2, lng: 31.2, address: "Stop 2" } },
          { point: { lat: 30.3, lng: 31.3, address: "End" } },
        ];

        const result = getPassengerRouteCoordinates({
          route,
          stops,
          pickup: "Start",
          dropoff: "Stop 2",
        });

        assert.deepEqual(result, route.slice(0, 3));
      });

      it("slices to the route end when dropoff is the final stop", () => {
        const route = [
          { lat: 30.0, lng: 31.0 },
          { lat: 30.1, lng: 31.1 },
          { lat: 30.2, lng: 31.2 },
          { lat: 30.3, lng: 31.3 },
        ];
        const stops = [
          { point: { lat: 30.0, lng: 31.0, address: "Start" } },
          { point: { lat: 30.1, lng: 31.1, address: "Stop 1" } },
          { point: { lat: 30.2, lng: 31.2, address: "Stop 2" } },
          { point: { lat: 30.3, lng: 31.3, address: "End" } },
        ];

        const result = getPassengerRouteCoordinates({
          route,
          stops,
          pickup: "Stop 1",
          dropoff: "End",
        });

        assert.deepEqual(result, route.slice(1));
      });

      it("falls back to the full route when passenger stops are not found", () => {
        const route = [
          { lat: 30.0, lng: 31.0 },
          { lat: 30.1, lng: 31.1 },
          { lat: 30.2, lng: 31.2 },
        ];
        const stops = [
          { point: { lat: 30.0, lng: 31.0, address: "Start" } },
          { point: { lat: 30.1, lng: 31.1, address: "Stop 1" } },
          { point: { lat: 30.2, lng: 31.2, address: "End" } },
        ];

        const result = getPassengerRouteCoordinates({
          route,
          stops,
          pickup: "Missing pickup",
          dropoff: "Missing dropoff",
        });

        assert.deepEqual(result, route);
      });

    it("should return empty array for empty route", () => {
      const result = sliceRouteForUser({
        route: [],
        stops: [{ point: { lat: 30.0, lng: 31.0, address: "A" } }],
        userPickupIndex: 0,
        userDropoffIndex: 0,
      });
      assert.deepEqual(result, []);
    });

    it("should return full route for empty stops array", () => {
      const route = [{ lat: 30.0, lng: 31.0 }];
      const result = sliceRouteForUser({
        route,
        stops: [],
        userPickupIndex: 0,
        userDropoffIndex: 0,
      });
      assert.deepEqual(result, route);
    });

    it("should return full route for invalid indices", () => {
      const route = [
        { lat: 30.0, lng: 31.0 },
        { lat: 30.1, lng: 31.1 },
      ];
      const stops = [
        { point: { lat: 30.0, lng: 31.0, address: "A" } },
        { point: { lat: 30.1, lng: 31.1, address: "B" } },
      ];

      // Negative index
      let result = sliceRouteForUser({
        route,
        stops,
        userPickupIndex: -1,
        userDropoffIndex: 1,
      });
      assert.deepEqual(result, route);

      // Out of bounds
      result = sliceRouteForUser({
        route,
        stops,
        userPickupIndex: 0,
        userDropoffIndex: 5,
      });
      assert.deepEqual(result, route);

      // Pickup after dropoff
      result = sliceRouteForUser({
        route,
        stops,
        userPickupIndex: 1,
        userDropoffIndex: 0,
      });
      assert.deepEqual(result, route);
    });

    it("should handle missing stop points", () => {
      const route = [
        { lat: 30.0, lng: 31.0 },
        { lat: 30.1, lng: 31.1 },
      ];
      const stops = [
        { point: null },
        { point: { lat: 30.1, lng: 31.1, address: "B" } },
      ];

      const result = sliceRouteForUser({
        route,
        stops,
        userPickupIndex: 0,
        userDropoffIndex: 1,
      });

      assert.deepEqual(result, route, "Should return full route when points are missing");
    });
  });

  describe("shouldSliceRoute", () => {
    it("should return false for drivers", () => {
      assert.equal(shouldSliceRoute(true, true), false);
      assert.equal(shouldSliceRoute(true, false), false);
    });

    it("should return false for single-stop rides", () => {
      assert.equal(shouldSliceRoute(false, false), false);
    });

    it("should return true for passengers with multiple stops", () => {
      assert.equal(shouldSliceRoute(false, true), true);
    });
  });

  describe("distance calculation", () => {
    it("should calculate distance between two points", () => {
      const p1 = { lat: 30.0, lng: 31.0 };
      const p2 = { lat: 30.1, lng: 31.1 };
      const dist = distance(p1, p2);

      // Approximate distance should be around 14.7 km
      assert.ok(dist > 14 && dist < 16, `Distance ${dist} should be ~14.7 km`);
    });

    it("should return 0 for same point", () => {
      const p1 = { lat: 30.0, lng: 31.0 };
      const p2 = { lat: 30.0, lng: 31.0 };
      const dist = distance(p1, p2);
      assert.ok(dist < 0.001, "Distance should be near 0");
    });
  });
});
