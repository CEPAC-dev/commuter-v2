/**
 * Route slicing utilities for per-user route perspectives.
 *
 * Passengers see only their portion of the ride route (from their pickup to their dropoff).
 * Drivers see the complete route serving all passengers.
 */

import type { GeoPoint } from "@/types/geo";
import type { RideRouteStopDetail } from "@/types/booking";

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Calculate distance between two points (Haversine formula, simplified).
 */
function distance(p1: LatLng, p2: LatLng): number {
  const R = 6371; // Earth radius in km
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

/**
 * Find the index of the closest waypoint in the route to a given point.
 */
function findClosestWaypointIndex(route: LatLng[], target: GeoPoint): number {
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

/**
 * Slice a route to show only the portion relevant to a user.
 *
 * @param route - Array of {lat, lng} waypoints
 * @param stops - All stops in the ride (RideRouteStopDetail with point, boarding, alighting)
 * @param userPickupIndex - Index of user's pickup stop in the stops array (0-based)
 * @param userDropoffIndex - Index of user's dropoff stop in the stops array (0-based)
 * @returns Sliced route array from pickup to dropoff, inclusive of all intermediate deviations
 *
 * @example
 * // 4-stop ride, passenger boards at stop 1, alight at stop 3
 * const route = [{lat: 30, lng: 31}, {lat: 30.1, lng: 31.1}, ...]; // 50 waypoints
 * const stops = [stop0, stop1, stop2, stop3];
 * const sliced = sliceRouteForUser({ route, stops, userPickupIndex: 1, userDropoffIndex: 3 });
 * // Returns waypoints from stop1 to stop3 (subset of the 50)
 */
export function sliceRouteForUser({
  route,
  stops,
  userPickupIndex,
  userDropoffIndex,
}: {
  route: LatLng[];
  stops: RideRouteStopDetail[];
  userPickupIndex: number;
  userDropoffIndex: number;
}): LatLng[] {
  // Validate inputs
  if (route.length === 0) return [];
  if (stops.length === 0) return route;
  if (userPickupIndex < 0 || userDropoffIndex < 0) return route;
  if (userPickupIndex >= stops.length || userDropoffIndex >= stops.length) return route;
  if (userPickupIndex > userDropoffIndex) return route;

  const pickupStop = stops[userPickupIndex];
  const dropoffStop = stops[userDropoffIndex];

  if (!pickupStop?.point || !dropoffStop?.point) return route;

  // Find the closest route waypoint indices to the pickup and dropoff stops
  const pickupRouteIndex = findClosestWaypointIndex(route, pickupStop.point);
  const dropoffRouteIndex = findClosestWaypointIndex(route, dropoffStop.point);

  // Ensure pickup comes before dropoff in the route
  if (pickupRouteIndex > dropoffRouteIndex) return route;

  // Return the slice (inclusive of both endpoints)
  return route.slice(pickupRouteIndex, dropoffRouteIndex + 1);
}

/**
 * Determine if route slicing should be applied based on user role and ride data.
 *
 * @param isDriver - Whether the current user is the driver
 * @param hasMultipleStops - Whether the ride has more than 2 stops (origin + destination)
 * @returns true if slicing should be applied, false otherwise
 */
export function shouldSliceRoute(isDriver: boolean, hasMultipleStops: boolean): boolean {
  // Drivers always see the full route
  if (isDriver) return false;

  // Single-passenger rides don't need slicing
  if (!hasMultipleStops) return false;

  return true;
}

/**
 * Extract stop indices for a passenger within a ride's route array.
 *
 * @param passengerPickupStation - Passenger's pickup station name or GeoPoint
 * @param passengerDropoffStation - Passenger's dropoff station name or GeoPoint
 * @param rideStops - All stops in the ride
 * @returns { pickupIndex, dropoffIndex } or null if not found
 */
export function findPassengerStopIndices(
  passengerPickupStation: string | GeoPoint | null | undefined,
  passengerDropoffStation: string | GeoPoint | null | undefined,
  rideStops: RideRouteStopDetail[],
): { pickupIndex: number; dropoffIndex: number } | null {
  if (!passengerPickupStation || !passengerDropoffStation || rideStops.length === 0) {
    return null;
  }

  const normalizeStationName = (name: string | GeoPoint | null | undefined): string => {
    if (!name) return "";
    if (typeof name === "string") return name.trim().toLowerCase();
    if (typeof name === "object" && "address" in name && name.address) {
      return String(name.address).trim().toLowerCase();
    }
    return "";
  };

  const pickupName = normalizeStationName(passengerPickupStation);
  const dropoffName = normalizeStationName(passengerDropoffStation);

  let pickupIndex = -1;
  let dropoffIndex = -1;

  for (let i = 0; i < rideStops.length; i++) {
    const stopName = normalizeStationName(rideStops[i]?.point?.address);
    if (pickupIndex === -1 && stopName === pickupName) {
      pickupIndex = i;
    }
    if (stopName === dropoffName) {
      dropoffIndex = i;
    }
  }

  if (pickupIndex === -1 || dropoffIndex === -1 || pickupIndex > dropoffIndex) {
    return null;
  }

  return { pickupIndex, dropoffIndex };
}

export function getPassengerRouteCoordinates({
  route,
  stops,
  pickup,
  dropoff,
}: {
  route: LatLng[];
  stops: RideRouteStopDetail[];
  pickup: string | GeoPoint | null | undefined;
  dropoff: string | GeoPoint | null | undefined;
}): LatLng[] {
  if (!shouldSliceRoute(false, stops.length > 2)) return route;
  const indices = findPassengerStopIndices(pickup, dropoff, stops);
  if (!indices) return route;
  return sliceRouteForUser({
    route,
    stops,
    userPickupIndex: indices.pickupIndex,
    userDropoffIndex: indices.dropoffIndex,
  });
}
