# Commuter — Shared rides: nearest-5 station picker

Execute one phase at a time. Wait for phase name. Implement only that phase, validate it, report changed files and result, then stop.

## Product change

Shared rides (`taxi_shared`, `van_shared`, `microbus_shared`) currently auto-select the single nearest pickup station and single nearest dropoff station.

Keep automatic nearest-station selection as default, then show the nearest five station choices for each endpoint. Passenger may choose a different option from those five. Changing a selection must update route, walking time, pickup time, price, map markers, walking polylines, and persisted Trip data.

Private rides (`private_car`, `taxi_private`) are out of scope. Do not change private form, stops, map markers, routing, pricing, or validation.

## Locked behavior

### Station candidates

- `Station.id` is station identity.
- For each shared endpoint, find the nearest five stations by haversine distance. Fewer than five is valid if station list has fewer records.
- Default selected pickup/dropoff station is nearest candidate (index 0).
- When user changes pickup/dropoff address, retain old selected station only if its `id` is still among recalculated nearest five; otherwise use new nearest candidate.
- Candidate fields:

```ts
type StationOption = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
  walkingMin: number;
};
```

- Distance is haversine distance, rounded to two decimals. `walkingMin` uses existing `walkingMinutes()`.

### Selected stations and route

- Route = selected pickup station → selected dropoff station.
- `walkingMinToStation` = pickup address → selected pickup station.
- `walkingMinFromStation` = selected dropoff station → dropoff address.
- Shared pickup time continues to account for the selected dropoff walk time:

```text
pickupTime = arrivalTime - routeDuration - walkingMinFromStation - vehicle window
```

- Selecting another station recomputes all derived data from that selection.
- Existing `CreateMap` derives shared station markers and dashed walking paths from `pickupStation`/`dropoffStation`; keep this flow. New state selection must therefore update those fields.

### UI

Under shared Pickup and shared Dropoff fields, show up to five selectable station rows:

- station name;
- distance in km;
- estimated walking minutes;
- clear selected state using brand tokens (`#00C2A8`, `#0B1E3D`).

Use radio-style rows or native radio inputs. Default is selectable rows with radio semantics.

Do not alter shared vehicle choice, shared extra-passenger controls, station route pricing formula, or private JSX.

### Persistence and server authority

- `Trip` stores the selected `pickupStation`, selected `dropoffStation`, selected walking minutes, and both candidate arrays.
- Selected station subdocuments include `id`.
- API must never trust client stations, candidates, walking minutes, route distance, duration, price, or pickup time.
- Shared server branch recomputes nearest-five candidates from canonical stations, validates selected station ids belong to the respective server candidate sets, then recomputes selected-station route, walking time, price, and pickup time.
- Reject invalid/forged selection with HTTP 400.

## Current code facts

- `src/lib/geo/stations.ts` has `Station`, `findNearestStation()`, `haversineKm()`, `walkingMinutes()`, and `isSharedVehicle()`.
- `src/components/create/TripCycle.tsx` owns shared route effect and shared station display.
- `src/components/create/CreateClient.tsx` owns `defaultTrip()`, reset paths, state, and submit payload.
- `src/components/create/CreateMap.tsx` already renders `pickupStation`/`dropoffStation` and walking polylines.
- `src/models/Trip.ts` has selected station schema only.
- `src/app/api/trips/route.ts` currently trusts client shared route and station fields. Phase 6 replaces that with server computation.

## Hard implementation rules

- Do one phase only when named. Stop after validation.
- Reuse existing helpers/components/styles. No unrelated refactors.
- Never change private ride code or behavior.
- Never fix pre-existing React effect/dependency warnings.
- Batch edits per file.
- Use `get_errors` on changed files only.
- Run `npm run build` at phase end only.
- No markdown docs during implementation; this plan is the exception.
- Preserve Next 16 conventions.
- Server uses canonical station source. Do not call its own HTTP route from `/api/trips`.

## Phase 0 — Candidate helper

Goal: pure nearest-five helper. No UI/state/schema/API behavior changes.

### `src/lib/geo/stations.ts`

1. Add exported `StationOption`:

```ts
export interface StationOption {
  id: number;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
  walkingMin: number;
}
```

2. Add:

```ts
export function findNearestStations(
  lat: number,
  lng: number,
  stations: Station[],
  limit = 5,
): StationOption[];
```

Requirements:

- compute `haversineKm()` for each station;
- sort ascending by distance;
- `slice(0, Math.max(0, limit))`;
- `distanceKm` rounded to two decimals;
- `walkingMin` via existing `walkingMinutes()`;
- do not modify `findNearestStation()`.

### Verify

- Focused diagnostics clean.
- Existing behavior unchanged.

## Phase 1 — Client data types and reset state

Goal: make candidate lists first-class client state. No chooser UI yet.

### `src/components/create/TripCycle.tsx`

1. Import `StationOption` type.
2. Extend selected station types with `id: number`.
3. Add to `TripData`:

```ts
pickupStationOptions: StationOption[];
dropoffStationOptions: StationOption[];
```

4. Clear both candidate arrays in all TripCycle return/reset paths.

### `src/components/create/CreateClient.tsx`

1. `defaultTrip()` adds empty candidate arrays.
2. Every return-trip sync/reset path clears both arrays.

### Verify

- Focused diagnostics clean.
- No rendered behavior changed.

## Phase 2 — Shared selection and routing state

Goal: shared route effect calculates candidates, uses current selection, defaults to nearest.

### `src/components/create/TripCycle.tsx`

1. Replace only shared-route use of `findNearestStation()` with `findNearestStations(..., 5)`.
2. Compute pickup and dropoff candidate arrays after addresses/stations exist.
3. Selected station rule:

```ts
const selectedPickup = pickupOptions.find(
  (option) => option.id === data.pickupStation?.id,
) ?? pickupOptions[0] ?? null;
```

Same for dropoff.

4. Store selected station as `{ id, name, lat, lng }` in `pickupStation`/`dropoffStation`.
5. Use selected station points for `fetchRoute()`.
6. Use selected `walkingMin` values for `walkingMinToStation` and `walkingMinFromStation`.
7. Add a local selection handler such as:

```ts
function selectStation(
  field: "pickup" | "dropoff",
  stationId: number,
): void;
```

It selects matching candidate, clears stale route-derived fields, and lets shared route effect recompute.

8. Route effect dependencies must include selected pickup/dropoff station ids. Avoid changing private route effect.
9. If stations unavailable/empty, preserve current graceful behavior: no selected station, direct endpoint route fallback as existing flow permits.

### Verify

- Nearest candidate selected by default.
- Changing selected id produces a new station→station route and updated walk/pickup time/price state.
- Focused diagnostics clean.

## Phase 3 — Shared station chooser UI

Goal: passenger can choose nearest-five candidates for both shared endpoints.

### `src/components/create/TripCycle.tsx`

Under existing shared Pickup station information and shared Dropoff station information:

1. Render candidate list only when corresponding array has values.
2. Each row must be a keyboard-accessible selection control with radio semantics.
3. Display name, `distanceKm` km, `walkingMin` min walk.
4. Selected style uses brand tokens. Do not use card-in-card styling.
5. Activate `selectStation("pickup", option.id)` or `selectStation("dropoff", option.id)`.
6. Keep existing walking hint using selected `walkingMinToStation`.

### Verify

- Each end shows up to five candidates.
- Nearest is selected initially.
- Switching rows immediately updates selected display and derived route state.
- Private UI unchanged.
- Focused diagnostics clean.

## Phase 4 — Trip persistence schema

Goal: persist selected stations and candidate lists.

### `src/models/Trip.ts`

1. Add `id: { type: Number, required: true }` to existing `StationSchema`.
2. Add `_id:false` `StationOptionSchema`:

```ts
{
  id: Number,
  name: String,
  lat: Number,
  lng: Number,
  distanceKm: Number,
  walkingMin: Number,
}
```

All fields required, nonnegative `distanceKm`/`walkingMin`.

3. Add to `TripSchema`:

```ts
pickupStationOptions: { type: [StationOptionSchema], default: [] },
dropoffStationOptions: { type: [StationOptionSchema], default: [] },
```

Keep existing selected station and walking fields.

### Verify

- Focused diagnostics clean.
- Existing stored Trips remain readable.

## Phase 5 — Client submit payload

Goal: client sends selected station ids and candidate state for persistence; server remains authority.

### `src/components/create/CreateClient.tsx`

In `handleSubmit()` trip payload for shared rides, include:

```ts
pickupStation: t.pickupStation,
dropoffStation: t.dropoffStation,
pickupStationOptions: t.pickupStationOptions,
dropoffStationOptions: t.dropoffStationOptions,
walkingMinToStation: t.walkingMinToStation,
walkingMinFromStation: t.walkingMinFromStation,
```

Private payload must not gain shared station fields.

### Verify

- Focused diagnostics clean.
- Network request contains selected station `id` plus options for shared trip.

## Phase 6 — Authoritative shared API logic

Goal: server recomputes and validates all shared station values.

### First read

Read `/api/stations` route and identify canonical station loader/source. Reuse it directly server-side. Do not make internal HTTP call.

### `src/app/api/trips/route.ts`

1. Extend input types with station `id` and option arrays.
2. For shared branch only:

- Load canonical stations.
- `pickupOptions = findNearestStations(t.pickup.lat, t.pickup.lng, stations, 5)`.
- `dropoffOptions = findNearestStations(t.dropoff.lat, t.dropoff.lng, stations, 5)`.
- Require `t.pickupStation?.id` and `t.dropoffStation?.id` to match corresponding server options.
- Reject missing/invalid selections with `{ error: "Invalid station selection" }`, status 400.
- Find selected server options from ids.
- Route with `fetchServerRoute([selectedPickup, selectedDropoff])`.
- Recompute `walkingMinToStation` and `walkingMinFromStation` from selected options, not payload.
- Recompute `pickupTime`, `priceEgp`, distance, duration from server route.
- Persist server-computed selected station objects including id, server candidate arrays, and server walking values.

3. Shared behavior without station data must fail clearly if canonical station list has candidates but selection missing. Do not silently trust client route data.
4. Do not change private branch.

### Verify

- Shared route recalculated from selected station coordinates.
- Forged/non-nearest-five station id returns 400.
- Forged distance/duration/price/walking fields ignored.
- Selected ids/options persist in inserted Trip documents.
- Focused diagnostics clean.

## Phase 7 — Shared details

Goal: show saved selected station details in read-only trip views.

### `src/app/my-requests/[id]/page.tsx`

For shared trips show selected pickup/dropoff stations and walk minutes. Optional: disclose saved alternatives without making them interactive.

### `src/app/my-trips/[id]/page.tsx`

Same read-only selected station display. Keep parent Request link and ownership query.

### Verify

- Selected station shown accurately after submission.
- Private detail unchanged.
- Focused diagnostics clean.

## Phase 8 — Final verification

1. Run `npm run build`.
2. Manual shared test:

- Select shared vehicle and both addresses.
- Confirm five or fewer candidates display for each endpoint.
- Confirm nearest station is selected initially.
- Change pickup station and then dropoff station.
- Confirm station markers, dashed walk lines, route, distance, duration, walk values, price, and pickup time update.
- Submit and inspect request/trip: selected ids and candidate arrays saved.
- Forge a station id/distance/price in request: server returns 400 or ignores forged derived values.

3. Manual private test:

- Private vehicle form, stops, map pins, pricing, and submission remain unchanged.
# Commuter — Shared rides: nearest-5 station picker

Execute one phase at a time. Wait for phase name. Implement only that phase, validate it, report changed files and result, then stop.

## Product change

Shared rides (`taxi_shared`, `van_shared`, `microbus_shared`) currently auto-select one nearest station for both Pickup location and Dropoff location.

Keep that nearest station selection as the default, then show the five nearest stations for each endpoint. User can select a different one from the other four options.

When either selected station changes:

- Route changes: selected pickup station -> selected dropoff station.
- Walking time to/from stations changes.
- Distance, drive duration, price, pickup time, route polyline, station markers, and walking polylines update.
- Request persists nearest-five station options and selected station identities.

Private rides (`private_car`, `taxi_private`) must remain unchanged.

## Current implementation facts

- `src/lib/geo/stations.ts`
  - `Station`: `{ id, name, lat, lng, popupInfo }`.
  - `findNearestStation()` returns one nearest station.
  - `haversineKm()` and `walkingMinutes()` exist.
- `src/components/create/TripCycle.tsx`
  - Shared route effect finds one nearest pickup/dropoff station.
  - It routes station -> station and stores selected stations and walking time.
- `src/components/create/CreateMap.tsx`
  - Reads selected `pickupStation`/`dropoffStation`.
  - Already renders shared station markers and walking polylines. Do not change behavior unless data type requires a compatible update.
- `src/models/Trip.ts`
  - Stores selected pickup/dropoff stations as `{ lat, lng, name }`.
  - Does not store station id or nearest-five choices yet.
- `src/app/api/trips/route.ts`
  - Shared branch currently accepts client route distance/duration/stations/walking time. This must become server-authoritative in Phase 6.

## Locked behavior

### Station options

- Identity is `Station.id`.
- Find nearest five stations by haversine distance. If fewer than five exist, return all available.
- Each option is:

```ts
{
  id: number;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
  walkingMin: number;
}
```

- Default selected station is first nearest option.
- If pickup/dropoff changes and current selected station remains in new nearest-five set, preserve selection. Otherwise select first nearest option.
- Selected station is stored in `pickupStation` / `dropoffStation`, including `id`.
- Persist all nearest-five options for each endpoint along with selected station.

### UI

- Show compact radio-style selectable rows under shared Pickup location and Dropoff location.
- At most five rows per endpoint.
- Each row: station name, distance in km, approximate walking minutes.
- Selected row visibly uses brand secondary `#00C2A8`.
- Do not replace existing pickup/dropoff address input or map-pick control.
- Keep existing `Leave home by` hint; it must use selected pickup station walking time.
- Private form must not show station options.

### Server authority

Server must never trust client station candidates, selected station id, distance, duration, walking time, price, or pickup time.

For shared rides server must:

1. Load server station dataset using same source as `/api/stations`.
2. Recompute nearest five pickup/dropoff station options.
3. Require selected pickup and dropoff station ids in corresponding server nearest-five set; otherwise return `400`.
4. Route server-side from selected pickup station to selected dropoff station.
5. Recompute walking time:
   - `pickup -> selected pickup station`
   - `selected dropoff station -> dropoff`
6. Recompute pickup time, price, distance, duration.
7. Persist server-generated selected stations, nearest-five options, walking values, route values, price, and pickup time.

## Hard rules

- One phase only when named. Stop after validation.
- Reuse existing components, helpers, styles, and brand tokens.
- Do not alter private ride UI, route calculation, pricing, stops, or validation.
- Do not refactor unrelated code.
- Preserve Request header + materialized Trip document architecture.
- Use `getVehicles()` for server vehicle source of truth.
- Keep Next 16 conventions.
- No new docs during implementation, except this plan already requested.
- Existing React effect diagnostics in `CreateClient.tsx` and `TripCycle.tsx` are out of scope. Do not fix them.
- Token/credit discipline:
  - Make only one phase per turn.
  - Read only target code necessary for named phase.
  - Batch edits per file.
  - Run focused diagnostics for changed files.
  - Run `npm run build` at phase end only.
  - Do not re-read files already inspected unless user changed them.

## Phase 0 — Nearest-five pure helper

### `src/lib/geo/stations.ts`

Add:

```ts
export interface StationOption {
  id: number;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
  walkingMin: number;
}

export function findNearestStations(
  lat: number,
  lng: number,
  stations: Station[],
  limit = 5,
): StationOption[];
```

Requirements:

- Return stations sorted ascending by `haversineKm()`.
- Limit results to `limit` after sorting.
- `distanceKm`: round to two decimals.
- `walkingMin`: reuse `walkingMinutes(distanceKm)`.
- Empty station list returns `[]`.
- Leave existing `findNearestStation()` unchanged.

### Verify

- Focused diagnostics clean.
- No existing UI/route behavior changed.

## Phase 1 — Client data types and reset defaults

### `src/components/create/TripCycle.tsx`

- Import `StationOption` type.
- Extend selected station object types in `TripData` with `id: number`.
- Add:

```ts
pickupStationOptions: StationOption[];
dropoffStationOptions: StationOption[];
```

- All TripCycle reset paths clear options arrays.

### `src/components/create/CreateClient.tsx`

- `defaultTrip()` creates empty pickup/dropoff station options.
- Return-trip sync/reset paths clear both options arrays.

### Verify

- Focused diagnostics clean.
- No UI behavior changed.

## Phase 2 — Shared station selection and live routing

### `src/components/create/TripCycle.tsx`

Modify shared-only routing logic.

1. Replace single nearest lookup with:

```ts
const pickupOptions = findNearestStations(
  data.pickup.lat,
  data.pickup.lng,
  stations,
  5,
);
const dropoffOptions = findNearestStations(
  data.dropoff.lat,
  data.dropoff.lng,
  stations,
  5,
);
```

2. Resolve selected options:

- Keep `data.pickupStation` when its id is in `pickupOptions`; otherwise use `pickupOptions[0]`.
- Keep `data.dropoffStation` when its id is in `dropoffOptions`; otherwise use `dropoffOptions[0]`.

3. Use selected station coordinates as route endpoints.

4. Walking values come from selected option:

```ts
walkingMinToStation = selectedPickup.walkingMin;
walkingMinFromStation = selectedDropoff.walkingMin;
```

5. Persist options and selected station in onChange result.

6. Add a narrowly scoped station-selection handler:

```ts
selectStation("pickup" | "dropoff", stationId)
```

- Resolve option from respective options list.
- Update selected station.
- Clear derived route fields (`distanceKm`, `durationMinutes`, `priceEgp`, `pickupTime`, `routeCoordinates`) so shared route effect recalculates.
- Do not affect private state.

7. Route effect dependencies must include selected pickup/dropoff station ids so selection immediately recalculates.

### Verify

- Initially selected station is nearest.
- Changing selected station updates route distance, duration, price, pickup time, walking values, and route coordinates.
- Private route unchanged.
- Focused diagnostics clean.

## Phase 3 — Shared station chooser UI

### `src/components/create/TripCycle.tsx`

Under shared Pickup location station information, add a selectable station list using `pickupStationOptions`.

Under shared Dropoff location station information, add a selectable station list using `dropoffStationOptions`.

Each row:

- Native radio input or accessible button/radio semantics.
- Station name.
- `distanceKm` km.
- `~walkingMin min walk`.
- Selected row uses `#00C2A8` border/background accent.
- Click invokes `selectStation()`.

Keep current station summary visible or fold it into selected row. Do not duplicate confusing data.

### Verify

- Five or fewer options render per endpoint.
- Nearest starts selected.
- Choosing alternate triggers live recompute.
- Existing shared map behavior remains correct.
- Private form has no station chooser.
- Focused diagnostics clean.

## Phase 4 — Persist station identity and station options

### `src/models/Trip.ts`

1. Add `id` to existing `StationSchema`:

```ts
id: { type: Number, required: true }
```

2. Add `_id: false` schema:

```ts
const StationOptionSchema = new Schema(
  {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    distanceKm: { type: Number, required: true, min: 0 },
    walkingMin: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);
```

3. Add:

```ts
pickupStationOptions: { type: [StationOptionSchema], default: [] },
dropoffStationOptions: { type: [StationOptionSchema], default: [] },
```

Do not require station fields globally because private trips have none.

### Verify

- Focused diagnostics clean.
- Existing private trips remain valid.

## Phase 5 — Submit station selections

### `src/components/create/CreateClient.tsx`

In `/api/trips` payload, include for shared trips:

```ts
pickupStation: t.pickupStation,
dropoffStation: t.dropoffStation,
pickupStationOptions: t.pickupStationOptions,
dropoffStationOptions: t.dropoffStationOptions,
walkingMinToStation: t.walkingMinToStation,
walkingMinFromStation: t.walkingMinFromStation,
```

Private payload remains unchanged.

### Verify

- Focused diagnostics clean.
- Shared payload includes selected station ids/options.

## Phase 6 — Authoritative shared backend logic

### First inspect

Read `/api/stations` implementation and reuse its station data source/server loader. Do not make an internal HTTP request when reusable server-side code exists.

### `src/app/api/trips/route.ts`

Extend input types:

```ts
pickupStation?: { id: number; name: string; lat: number; lng: number };
dropoffStation?: { id: number; name: string; lat: number; lng: number };
pickupStationOptions?: StationOption[];
dropoffStationOptions?: StationOption[];
```

Shared branch only:

1. Require selected station ids for shared request.
2. Load server station list.
3. Compute server nearest-five options for pickup and dropoff using `findNearestStations()`.
4. Resolve selected options by client supplied ids against server sets.
5. Return `400 { error: "Invalid station selection" }` if either not found.
6. Call:

```ts
fetchServerRoute([selectedPickup, selectedDropoff]);
```

7. Reject route failure with 502.
8. Recompute:

```ts
walkingMinToStation = selectedPickup.walkingMin;
walkingMinFromStation = selectedDropoff.walkingMin;
distanceKm = route.distanceKm;
durationMinutes = route.durationMinutes;
pickupTime = computePickupTime(
  t.arrivalTime,
  Math.round(durationMinutes) + walkingMinFromStation,
  vehicleKey,
  vehiclesMap,
);
priceEgp = finalPrice(
  priceFor(distanceKm, vehicleKey, vehiclesMap),
  validatedExtraPassengers,
  vehicleKey,
);
```

9. Persist only server-generated selected station objects, server nearest-five arrays, route, walking values, pickup time, and price.
10. Do not change private server branch.

### Verify

- Alternate valid station id succeeds.
- Forged/non-nearest station id receives 400.
- Forged client route/walking/price ignored.
- Stored Trip has selected station ids and both server nearest-five arrays.
- `npm run build` passes.

## Phase 7 — Read-only details

### `src/app/my-requests/[id]/page.tsx`
### `src/app/my-trips/[id]/page.tsx`

For shared trips with station selection:

- Show selected pickup station and walk time.
- Show selected dropoff station and walk time.
- Optionally show nearest-five alternatives only when useful; do not make detail pages noisy.
- Preserve private detail behavior.

### Verify

- Saved selected stations display correctly.
- Focused diagnostics clean.

## Phase 8 — Final verification

1. Run:

```powershell
npm run build
```

2. Manual shared test:

- Select `taxi_shared`.
- Pick pickup/dropoff.
- Confirm nearest five options show at both ends.
- Confirm nearest defaults selected.
- Select alternatives at both ends.
- Confirm walking time, selected station markers, dashed walking paths, route, distance, duration, price, and pickup time update.
- Submit and inspect saved trip: selected station ids plus nearest-five options persisted.
- Forge station id in request: API returns 400.

3. Manual private test:

- Select private vehicle.
- Confirm no station options appear.
- Confirm private stops/routing/pricing remains unchanged.
