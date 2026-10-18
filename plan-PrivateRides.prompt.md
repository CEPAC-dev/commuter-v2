# Commuter — Private rides: passenger count, stop points, pickup-time arrival

Execute one phase at a time. Wait for phase name. Implement only that phase, validate it, report changed files and result, then stop.

## Product change

Private rides (`private_car`, `taxi_private`) need their own request-form structure.

Shared rides (`taxi_shared`, `van_shared`, `microbus_shared`) are already complete. Do not change their form, pricing, routing, station behavior, or validation.

Private rides currently have no rendered form below vehicle selection. Build private branch without changing shared branch.

## Locked private-ride behavior

### Passenger count

Replace private-only "Extra passengers" with "Number of passengers":

- Starts at `1` for requesting user.
- Minimum: `1`.
- Maximum: selected vehicle `occupancy` field.
- Current private vehicle occupancy is `4`; therefore maximum extra passengers is `3`.
- Shared rides retain existing `extraPassengers` behavior exactly.

### Stop points

Between private Pickup location and Dropoff location add "+ Add stop point":

- Maximum 4 stop points.
- Each stop has:
  - Stop point address input, same behavior as Pickup/Dropoff.
  - "How many are alighting?" counter.
  - "How many are boarding?" counter.
  - Mandatory `HH:MM` waiting-time input.
- `00:00` is valid waiting time; it means no wait. Do not warn or reject it.
- Route order: Pickup → stops in display order → Dropoff.
- Stop points update route, map pins, distance, duration, calculated arrival, and price live.

### Occupancy rules

- Initial onboard passengers = `numberOfPassengers`.
- At each stop: `onboardAfter = onboardBefore - alighting + boarding`.
- Alighting maximum = `onboardBefore - 1`; at least one passenger remains to final destination.
- Boarding maximum = `vehicle.occupancy - (onboardBefore - alighting)`.
- Validate client-side for feedback and server-side for authority.
- Boarding/alighting do not change price; only validate occupancy.

### Times

Private rides:

- User inputs `Pickup time`.
- `Arrival time` is readonly and server-computed:

  ```text
  arrival = pickupTime + routeDuration + sum(stop.waitingMinutes) + 10 minutes
  ```

- Shared rides retain current user-entered Arrival time and computed Pickup time.

### Price

Private price:

```text
base = priceFor(routeDistanceThroughStops, vehicle)
passengerAdjusted = finalPrice(base, numberOfPassengers - 1, vehicle)
waitingCost = round(sum(waitingMinutes) / 60 * (50 * vehicle.rate * 0.5))
price = passengerAdjusted + waitingCost
```

Private passenger factors:

- 1 passenger: base price.
- 2 passengers (`+1`): base + 25%.
- 3 passengers (`+2`): base + 50%.
- 4 passengers (`+3`): base + 75%.

Shared pricing remains unchanged.

### Existing private passenger-detour feature

Keep existing `passengers[]`, distinct pickup/dropoff point, and 25% detour schema/code intact. Do not render it in new private form. New private form uses `numberOfPassengers` and `stops[]`.

## Hard implementation rules

- Do one phase only when named. Stop after validation.
- Reuse existing components/styles/helpers. Avoid unrelated refactors.
- Shared rides are out of scope. Do not alter shared JSX, state behavior, station routing, or server logic.
- Never trust client price, distance, duration, passenger count, stop occupancy, pickup time, or calculated arrival. Recompute and validate on server.
- Existing Request/Trip relational model remains unchanged: Request header, materialized Trip docs per date/cycle.
- Preserve DB vehicle source of truth: server uses `getVehicles()`; client can use hydrated vehicle map.
- Keep Next 16 route conventions. Dynamic params use `Promise` and `await`.
- Do not touch unrelated React effect warnings.
- No new documentation files during implementation.
- Batch edits per file. Run focused diagnostics after edits. Run `npm run build` at phase end.

## Phase 1 — Pure helpers and data types

Goal: add reusable calculations and private state types. No render or backend changes yet.

### `src/lib/config/vehicles.ts`

1. Extend private branch in `finalPrice()`:

   ```ts
   if (n === 1) return r(0.25);
   if (n === 2) return r(0.5);
   if (n === 3) return r(0.75);
   ```

2. Add pure helper:

   ```ts
   export function waitingCostEgp(
     waitingMinutes: number,
     key: VehicleKey,
     vehiclesMap: Record<VehicleKey, VehicleConfig> = VEHICLES,
   ): number;
   ```

   - Clamp invalid/negative minutes to `0`.
   - Formula: `Math.round((minutes / 60) * (50 * rate * 0.5))`.

### `src/lib/time/pickupWindow.ts`

Add:

```ts
computeArrivalTime(
  pickupTime: string,
  driveMinutes: number,
  waitingMinutes: number,
  bufferMinutes = 10,
): string
```

Use existing `toMinutes()` and `toHHMM()`. Preserve 24-hour wrap behavior.

### `src/components/create/TripCycle.tsx`

Add exported type:

```ts
type StopPoint = {
  id: string;
  point: TripPoint | null;
  alighting: number;
  boarding: number;
  waitingMinutes: number;
};
```

Extend `TripData` with:

```ts
numberOfPassengers: number;
stops: StopPoint[];
```

Do not render private form in this phase.

### Verify

- Focused diagnostics clean.
- No current shared form behavior changed.

## Phase 2 — Trip model, defaults, validation, and payload

Goal: make private data persistable and send it to backend.

### `src/models/Trip.ts`

Add:

- `numberOfPassengers`: Number, default `1`, min `1`.
- `stops`: subdocument array with:
  - `point`: PointSchema, required.
  - `alighting`: Number, required, min `0`.
  - `boarding`: Number, required, min `0`.
  - `waitingMinutes`: Number, required, min `0`.

Use `_id: false` for stop subdocuments.

### `src/components/create/CreateClient.tsx`

1. `defaultTrip()` adds:

   ```ts
   numberOfPassengers: 1,
   stops: [],
   ```

2. Return-trip/reset paths clear `stops` and reset `numberOfPassengers: 1`.

3. `validate()` branches by vehicle ride type:

- Shared: retain current validation unchanged.
- Private:
  - Require pickup, dropoff, vehicle, and Pickup time.
  - Do not require manually entered Arrival time.
  - Require `numberOfPassengers` in `[1, occupancy]`.
  - Require every stop point.
  - Validate no more than 4 stops.
  - Run running occupancy rules.
  - Require calculated `arrivalTime`, route distance, and duration before preview.

4. Submit payload includes `numberOfPassengers` and normalized `stops` for private trips. Existing fields stay for shared trips.

### Verify

- Focused diagnostics clean.
- `npm run build` passes.

## Phase 3 — Authoritative private backend logic

Goal: server accepts private inputs and recomputes route, times, price, and occupancy.

### `src/app/api/trips/route.ts`

Extend request input types with:

```ts
numberOfPassengers?: number;
stops?: {
  point: { address: string; lat: number; lng: number };
  alighting: number;
  boarding: number;
  waitingMinutes: number;
}[];
```

Branch after DB vehicle lookup using `vehicle.ride`.

### Shared branch

Keep current shared behavior unchanged.

### Private branch

1. Validate:

- `numberOfPassengers` integer from 1 through `vehicle.occupancy`.
- Stops array length 0 through 4.
- Each stop has a complete point, nonnegative integer boarding/alighting/waiting values.

2. Recompute running occupancy server-side:

```ts
let onboard = numberOfPassengers;
for (const stop of stops) {
  if (stop.alighting > onboard - 1) reject;
  const afterAlighting = onboard - stop.alighting;
  if (stop.boarding > vehicle.occupancy - afterAlighting) reject;
  onboard = afterAlighting + stop.boarding;
}
```

3. Recompute route through all points:

```ts
fetchServerRoute([t.pickup, ...stops.map((stop) => stop.point), t.dropoff]);
```

4. Use user `pickupTime` as private input. Reject malformed `HH:MM`.

5. Calculate:

```ts
const totalWaitingMinutes = sum(stops.waitingMinutes);
const arrivalTime = computeArrivalTime(
  pickupTime,
  route.durationMinutes,
  totalWaitingMinutes,
  10,
);
const basePrice = priceFor(route.distanceKm, vehicleKey, vehiclesMap);
const passengerPrice = finalPrice(
  basePrice,
  numberOfPassengers - 1,
  vehicleKey,
);
const priceEgp =
  passengerPrice + waitingCostEgp(totalWaitingMinutes, vehicleKey, vehiclesMap);
```

6. Persist server values only: stop data, passenger count, distance/duration, pickupTime, calculated arrivalTime, and price.

7. Preserve private distinct-passenger detour logic only when `passengers[]` is supplied. New private UI will not supply it. Do not accidentally apply both systems to same price.

### Verify

- 2-stop private request: server route includes stops.
- Server rejects occupancy overflow / empty stop / >4 stops / invalid waiting / invalid pickup time.
- Server arrival and price ignore client-supplied values.
- `npm run build` passes.

## Phase 4 — Private form UI and live calculation

Goal: render private branch in `TripCycle` with live state and routes.

### `src/components/create/TripCycle.tsx`

Add `else` private branch next to current shared conditional. Do not alter shared branch JSX.

Private field order:

1. Number of passengers counter, starting 1, bounded by `vMap[vehicleType].occupancy`.
2. Pickup location using existing `AddressInput`, save-address, and map-pick controls.
3. Stop list between pickup/dropoff:

- `+ Add stop point` until 4.
- Per stop: Stop address `AddressInput`; alighting counter; boarding counter; mandatory time input (`HH:MM`).
- Remove-stop control.
- Counter caps reflect running occupancy at that exact stop.

4. Dropoff location using existing controls.
5. Route information pill.
6. Pickup time `type="time"` user input.
7. Arrival time readonly calculated field.
8. Price display includes waiting cost in explanatory text or summary.

### Live private routing

Add private route effect that runs after pickup/dropoff/stops are complete:

```ts
const routePoints = [
  data.pickup,
  ...data.stops.map((s) => s.point),
  data.dropoff,
];
fetchRoute(routePoints);
```

On result:

- `distanceKm`, `durationMinutes`, `routeCoordinates` from combined route.
- `arrivalTime = computeArrivalTime(pickupTime, durationMinutes, totalWaiting, 10)` when pickup time exists.
- `priceEgp = finalPrice(priceFor(distance, key), numberOfPassengers - 1, key) + waitingCostEgp(totalWaiting, key)`.

Recompute arrival/price when pickup time, passenger count, waiting time, vehicle, stops, or route changes.

Keep private `passengers[]` hidden. Do not show `Extra passengers` in private form.

### Verify

- Private vehicle selection immediately shows private form.
- Shared vehicle still shows exact existing form.
- Add/remove stop updates map route, price, duration, calculated arrival.
- Counter constraints work before submit.
- `npm run build` passes.

## Phase 5 — Private map stop markers

Goal: map displays stop nodes and route boundaries correctly.

### `src/components/create/CreateMap.tsx`

- Add numbered private stop marker icon/helper.
- For each private Trip, render stops between origin/destination markers.
- Include stop points in `allPoints` fit bounds.
- Existing route polyline already uses `routeCoordinates`; combined private route should render automatically.
- Do not change shared station markers or walking polylines.

### Verify

- Private route shows origin → numbered stops → destination.
- Bounds include every stop.
- Shared map remains unchanged.
- `npm run build` passes.

## Phase 6 — Preview and detail views

Goal: render persisted private fields accurately.

### `src/components/create/CreateClient.tsx`

Preview private trips must show:

- Number of passengers.
- Stop list with point, alighting, boarding, and waiting time.
- Pickup time and calculated arrival time.
- Base/passenger/waiting price breakdown or a concise waiting-cost line.

Shared preview remains unchanged.

### `src/app/my-requests/[id]/page.tsx`

For private trips with stops/passenger count:

- Render number of passengers.
- Render ordered stop list with boarding/alighting/waiting values.
- Keep existing route/map/times/price display.

### `src/app/my-trips/[id]/page.tsx`

Same private detail fields. Keep parent Request link and ownership query.

### Verify

- Preview matches submitted private values.
- Request and flat Trip detail show saved private stops/passengers.
- Shared detail remains unchanged.
- `npm run build` passes.

## Phase 7 — Final verification

1. Run `npm run build`.
2. Manual private test:

- private_car
- 3 passengers
- 2 stops
- alighting/boarding within occupancy
- waits `00:15` and `00:30`

Confirm:

- Arrival = pickup + combined drive + 45 min wait + 10 min.
- Price = base + 50% passenger surcharge + prorated waiting cost.
- Map has two numbered stops.
- Server rejects forged price/duration/arrival/occupancy.
- Request materializes Trips correctly across selected dates.

3. Manual shared test:

- Select shared vehicle, complete existing station flow, preview/pay as before.
- Confirm no private-only fields appear.
