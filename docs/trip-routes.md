# Trip Routes - Per-User Perspective

## Overview

This document describes how trip routes are displayed to different users (passengers, drivers) with personalized perspectives based on their role and position in the ride.

## Current Implementation

### Route Storage

Routes are stored at the Ride level in the `Ride` model:

```typescript
route: RideRouteStopSchema[] // Array of stops with lat/lng, times, boarding/alighting counts
```

Each `RideRouteStopSchema` contains:
- `point`: { lat, lng, address }
- `arrival`, `departure`: Time strings (HH:MM)
- `boardingNumber`, `alightingNumber`: Passenger counts
- `boarding[]`, `alighting[]`: Trip IDs

Individual Trips do NOT store their own route - they have `pickup`, `dropoff`, and optional intermediate `stops[]`, but rely on the parent Ride's route for the full multi-passenger path.

### Map Component

**Component**: `RouteMap` (loaded via `RouteMapOsmLoader`)

**How it works**:
1. Accepts `pickup`, `dropoff`, `stops[]`, `stations[]` props
2. Merges `stops` and `stations` into `viaPoints`
3. Fetches directions from `/api/directions?origin=...&dest=...&waypoints=...`
4. Receives `coordinates: [lat, lng][]` from API
5. Renders as Leaflet polyline with two layers (shadow + main) for visual depth

**Current behavior**: Renders ONE continuous route from pickup through all waypoints to dropoff.

## Per-User Route Slicing Logic

### Helper Function

```typescript
/**
 * Slices a route to show only the portion relevant to a user.
 * @param route - Array of {lat, lng} waypoints (or encoded polyline)
 * @param stops - All stops in the ride with their station data
 * @param userPickupIndex - Index of user's pickup stop (0-based)
 * @param userDropoffIndex - Index of user's dropoff stop (0-based)
 * @returns Sliced route array from pickup to dropoff, inclusive of deviations
 */
function sliceRouteForUser({
  route,
  stops,
  userPickupIndex,
  userDropoffIndex,
}: {
  route: { lat: number; lng: number }[];
  stops: RideRouteStopDetail[];
  userPickupIndex: number;
  userDropoffIndex: number;
}): { lat: number; lng: number }[] {
  // Find the closest route waypoint to the pickup stop
  const pickupPoint = stops[userPickupIndex]?.point;
  const dropoffPoint = stops[userDropoffIndex]?.point;
  
  if (!pickupPoint || !dropoffPoint) return route;
  
  // Find indices in the route array
  const pickupRouteIndex = findClosestWaypointIndex(route, pickupPoint);
  const dropoffRouteIndex = findClosestWaypointIndex(route, dropoffPoint);
  
  // Return the slice (inclusive)
  return route.slice(pickupRouteIndex, dropoffRouteIndex + 1);
}
```

### User Perspectives

#### Passenger Perspective
- **What they see**: Route from their pickup stop to their dropoff stop, including all intermediate stops and deviations
- **Example**: Passenger boarding at stop 2, alighting at stop 4 sees: `stop2 → stop3 → stop4`
- **What they DON'T see**: Route segments before their pickup or after their dropoff
- **Pins**: Their own pickup/dropoff highlighted; other passengers' stops dimmed

#### Driver Perspective
- **What they see**: Complete route from first pickup (stop 0) to last dropoff (stop N), all deviations included
- **Pins**: All passenger pickup/dropoff pins visible and labeled ("Passenger 1 pickup", "Passenger 2 dropoff")

### API Requirements

**Passenger API** (`GET /api/trips/[id]`):
Must include:
- `userPickupStopIndex`: number (0-based index in the ride's stop array)
- `userDropoffStopIndex`: number (0-based index in the ride's stop array)
- `ride.route`: Full ride route for slicing on client

**Driver API** (`GET /api/ride/[id]`):
Already returns full ride with complete route - no slicing needed.

## Route Recomputation on Match

### Current Implementation

**Where It Happens**:
- `src/lib/services/rideService.ts`:
  - `createRide()` (line 159-349): Initial ride creation, calls `recalculateRouteFromPassengers()` if no route provided
  - `addPassengerToRide()` (line 941-981): When new trip added, recomputes route at line 967
  - `removePassengerFromRide()` (line 983-1033): When passenger removed, recomputes at line 1006
  - `recalculateRoute()` (line 1035-1043): Manual recomputation helper

**What `recalculateRouteFromPassengers()` Does** (line 374-432):
1. Builds stop sequence from passenger pickup/dropoff orders
2. Aggregates boarding/alighting counts per stop
3. Returns array of `{ point, boardingNumber, alightingNumber, boarding[], alighting[], waitingMinutes }`

**Status: Fixed**:
- `recalculateRouteFromPassengers()` now builds the ordered stop sequence and requests road geometry from the existing `/api/directions` OSRM integration.
- The resulting coordinates are stored in `Ride.routeCoordinates` and included in passenger/driver ride details.
- Matching and removing passengers both recompute the route; if OSRM returns no geometry or errors, the prior coordinates are retained and the failure is logged.

### Recalculation Flow

When a trip is matched into or removed from a ride:
1. Call `recalculateRouteFromPassengers()` to build new stop sequence ✅ (already done)
2. Extract all stop points in their configured order.
3. Request OSRM geometry from `/api/directions` with intermediate stops as waypoints.
4. Store the returned geometry in `Ride.routeCoordinates`.
5. Passenger maps slice the stored geometry to the passenger's boarding/alighting stops.

### Integration Gap

**Routing Service Available**: ✅ OSRM via `/api/directions?origin=...&dest=...&waypoints=...`
- Returns: `{ coordinates: [[lat,lng], ...], distance_km, duration_minutes }`
- Used by: `RouteMap.tsx` (client-side), `osrm.ts` (client-side helper)
- NOT used by: `rideService.ts` (server-side matching logic)

## Unified Page Structure

Both passenger and driver trip detail pages now follow the same layout:

### Sections (in order)
1. **Header**: Ride number, date, status pills, price
2. **Map**: Route visualization
3. **PIN card** (passenger only): 4-digit pickup verification code
4. **Route timeline**: Pickup → Dropoff with times
5. **Expandable details**: Private/Shared ride specifics
6. **Visual seat map** (ongoing rides): 2D grid showing assigned seats
7. **Driver card** (private rides): Driver name, rating, photo
8. **Call driver link** (ongoing rides): Phone number
9. **Trip chat**: Passenger ↔ Driver messaging
10. **Trip summary** (sidebar on desktop): Status, price, payment breakdown, actions

### Driver-Specific Additions
- **Manifest section**: List of all passengers with Trip status, seat numbers, chat buttons
- **Action controls**: Start ride, confirm station, boarding/alighting, end ride, report problem
- **Incident banner**: Shown when `hasOpenIncident` is true
- **Route details**: Full timeline with all stops, boarding/alighting counts, pickup PIN input

## Testing

### Unit Tests
- ✅ `sliceRouteForUser` with 2, 3, 4 stop rides
- ✅ Driver sees complete route
- ✅ Passenger sees sliced route
- ✅ Route slicing falls back to the full stored route when passenger stops cannot be matched

### Visual Tests
- ✅ Single-passenger ride: no slicing
- ✅ Multi-passenger ride: each passenger sees different route
- ✅ Driver sees all stops and deviations
- ✅ No duplicate routes rendered

## Release Notes

### Breaking Changes
None - route display is backward compatible.

### New Behavior
- Passengers now see only their portion of a shared route
- Route geometry is recomputed from ordered stops on match/removal and stored on the ride
- Driver and passenger pages have unified structure

### Migration
No database migration needed. Existing `Ride.route` data is compatible.

## Known Gaps

1. **Real-time updates**: Route changes require page refresh - no WebSocket push in this implementation
2. **Offline handling**: No offline route caching or fallback directions
3. **Route slicing API**: Passenger API does not yet return `userPickupStopIndex` and `userDropoffStopIndex` - client uses `findPassengerStopIndices()` helper to determine indices from station names

---

**Last updated**: Step feat/unified-trip-view-and-routes (Part 0)
