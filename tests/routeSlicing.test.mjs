import { describe, it } from "node:test";
import assert from "node:assert/strict";

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

function findClosestWaypointIndex(route, target) {
  if (route.length === 0) return 0;
  let minDist = Infinity;
  let minIndex = 0;
  for (let i = 0; i < route.length; i++) {
    const dist = distance(route[i], { lat: target.lat, lng: target.lng });
    if (dist < minDist) {
      minDist = dist;
      minIndex = i;
    }
  }
  return minIndex;
}

function sliceRouteForUser({ route, stops, userPickupIndex, userDropoffIndex }) {
  if (route.length === 0) return [];
  if (stops.length === 0) return route;
  if (userPickupIndex < 0 || userDropoffIndex < 0) return route;
  if (userPickupIndex >= stops.length || userDropoffIndex >= stops.length) return route;
  if (userPickupIndex > userDropoffIndex) return route;

  const pickupStop = stops[userPickupIndex];
  const dropoffStop = stops[userDropoffIndex];

  if (!pickupStop?.point || !dropoffStop?.point) return route;

  const pickupRouteIndex = findClosestWaypointIndex(route, pickupStop.point);
  const dropoffRouteIndex = findClosestWaypointIndex(route, dropoffStop.point);

  if (pickupRouteIndex > dropoffRouteIndex) return route;

  return route.slice(pickupRouteIndex, dropoffRouteIndex + 1);
}

function shouldSliceRoute(isDriver, hasMultipleStops) {
  if (isDriver) return false;
  if (!hasMultipleStops) return false;
  return true;
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
      // First waypoint should be closest to stop 2
      const firstDist = distance(result[0], { lat: 30.1, lng: 31.1 });
      assert.ok(firstDist < 0.01, "Should start near stop 2");
      // Last waypoint should be closest to stop 4
      const lastDist = distance(result[result.length - 1], { lat: 30.2, lng: 31.2 });
      assert.ok(lastDist < 0.01, "Should end near stop 4");
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
