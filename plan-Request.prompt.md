# Commuter — Round 3 build plan (for Sonnet, execute phase-by-phase)

Stack: Next 16.2.9, React 19, Tailwind v4, TS. Mongoose, jose, bcryptjs, Google Maps,
Kashier REST, motion, lucide, date-fns. Brand: primary #0B1E3D, secondary #00C2A8, accent #F5A623.

## Locked decisions

- 5PM cutoff: now >= 20:00 → earliest = day-after-tomorrow; else earliest = tomorrow.
- Date field: interactive calendar, MULTI-select, only [earliest .. earliest+6] (7 days) selectable.
- Multiple selected dates → each date becomes its OWN Booking, all sharing a `groupId`. One payment charges group total; webhook marks every booking in group paid.
- Detour (extra passenger with own points): route = mainPickup → all distinct passenger pickups → all distinct passenger dropoffs → mainDropoff. Reject if combined > 1.25 × base(mainPickup→mainDropoff). distanceKm + price recomputed from COMBINED distance (server authoritative).
- Distinct passenger points allowed for PRIVATE vehicles only (private_car, taxi_private). Shared vehicles: extra passengers always share main points/stations.
- Vehicles → DB: DB is single source of truth (mobile app also consumes these APIs). Expose stable snake_case GET /api/vehicles for web+mobile. vehicles.ts keeps: types + SEED data + pure calc fns (parametrized to accept a vehicles map, default = seed). Web hydrates from DB at runtime.
- Vehicle CRUD: add User role "admin"; GET public, mutations admin-only.
- Add vehicle fields capacity, occupancy, min_occupancy (ints, default placeholders until user edits).

## IMPLEMENTER RULES (token economy — obey)

- Do ONE phase only when named, then STOP for review.
- REUSE existing helpers/components; do NOT re-read files already pasted in context.
- Batch edits per file; avoid many tiny reads. Run get_errors ONCE after each phase.
- No new markdown docs. No refactors beyond the phase. Brand tokens only. Short confirmations.
- Never trust client price/distance/time/amount/date — recompute + validate server-side.

---

## PHASE 1 — Vehicle config fields (foundation)

Goal: add capacity/occupancy/min_occupancy to config; unblocks DB seed (Phase 5).
Files: `src/lib/config/vehicles.ts`
Steps:

1. Extend `VehicleConfig` with `capacity: number; occupancy: number; min_occupancy: number`.
2. Fill each VEHICLES entry (placeholders, user edits later):
   private_car cap4 occ0 min1 | taxi_private cap4 occ0 min1 | taxi_shared cap4 occ0 min2 |
   van_shared cap7 occ0 min3 | microbus_shared cap14 occ0 min5.
3. Do NOT change existing pure fns yet.
   Verify: get_errors clean; VEHICLE_LIST still typechecks in importing files.

---

## PHASE 2 — Reorder "Vehicle type" above "Pickup location"

Goal: vehicle select first in each trip card.
Files: `src/components/create/TripCycle.tsx`
Steps:

1. Move the entire Vehicle type `<div>` block (the `select#vehicle-...`) to render BEFORE the Pickup `<div>` block. Pure JSX move, no logic change.
   Verify: get_errors clean; visual order Vehicle → Pickup → Dropoff → route → arrival → pickup time → passengers.

---

## PHASE 3 — Multi-date calendar + multiple bookings + payment group

Goal: pick many dates in 7-day window; one Booking per date sharing groupId; single grouped payment.

### 3a — Date helper

Files: new `src/lib/time/bookingDates.ts`

- `earliestBookingDate(now = new Date()): string` → today+2 if now.getHours()>=20 else today+1 (YYYY-MM-DD, local).
- `bookingWindow(now?): string[]` → 7 days counted FROM earliest (the first selectable day): [earliest .. earliest+6]. Not from today.
- `isDateInWindow(date, now?): boolean`.
  Use date-fns (addDays, startOfDay, format).

### 3b — Frontend calendar (DatePicker → interactive multi-select)

Files: `src/components/create/DatePicker.tsx`, `src/components/create/CreateClient.tsx`

- DatePicker: props `{ value: string[]; onChange: (dates:string[])=>void }`. Render 7 selectable day chips/cells from bookingWindow(); toggle add/remove; disable outside window. Keep brand styling.
- CreateClient: replace `const date = ...` with `const [selectedDates, setSelectedDates] = useState<string[]>([earliest])`. Pass to DatePicker.
- Validation: require selectedDates.length >= 1 before preview.
- Preview + payment recap: perDayTotal = current totalEgp; grandTotal = perDayTotal \* selectedDates.length. Show dates list + "× N days".

### 3c — Booking model + trips API (multi-booking)

Files: `src/models/Booking.ts`, `src/app/api/trips/route.ts`

- Booking: add `groupId: { type: String, index: true }` (optional; set for grouped bookings).
- trips API: accept `dates: string[]` (keep back-compat: if `date` string given, treat as [date]).
  - Validate each date matches window server-side via bookingDates helper (reject out-of-window), dedupe, cap length 7.
  - Build serverTrips once (existing recompute logic). perDayAmount = sum.
  - Generate `groupId = crypto.randomUUID()`. Create N bookings (one per date) with same trips + groupId + amountEgp = perDayAmount.
  - Return `{ groupId, bookingIds: string[], amountEgp: perDayAmount * N }`.

### 3d — Payment group (session, wallet, webhook, callback)

Files: `src/app/api/payments/session/route.ts`, `src/app/api/payments/wallet/route.ts`,
`src/app/api/payments/webhook/route.ts`, `src/app/checkout/callback/*`, CreateClient submit.

- session/wallet: accept `groupId` (fallback single `bookingId`). Lookup all bookings by groupId (verify ownership), amount = sum of their amountEgp. Kashier orderId = groupId; store kashierOrderId=groupId on each.
- webhook: on success look up all bookings by groupId (orderId) → set paymentStatus paid, paidAt, status submitted for ALL.
- wallet: charge group total atomically; mark all paid.
- callback: read by groupId → show grouped state (N days paid).
- CreateClient handleSubmit: send `dates: selectedDates`; use returned groupId for payment calls; redirect unchanged.
  Verify: create booking with 2 dates → 2 Booking docs same groupId; pay once → both paid; wallet path same.

---

## PHASE 4 — Extra-passenger distinct points + 25% detour + reprice

Goal: each extra passenger may share main points OR set own pickup/dropoff (private vehicles only); enforce combined ≤ 1.25×base; reprice from combined distance server-side.

### 4a — Types

Files: `src/components/create/TripCycle.tsx` (TripData), `src/types/shared.ts` (optional shared type)

- Add `PassengerDetail = { id: string; sameAsMain: boolean; pickup: TripPoint|null; dropoff: TripPoint|null }`.
- TripData: add `passengers: PassengerDetail[]`; add `baseDistanceKm: number|null` (main P→D distance). Keep `extraPassengers` = passengers.length (derive/keep in sync).

### 4b — TripCycle UI

- Extra-passengers stepper: on +, push `{sameAsMain:true,...}`; on −, pop last. extraPassengers = length.
- For each passenger (private vehicles only): radio/toggle "Same as main" | "Different points". If different → render pickup+dropoff AddressInput (+ pick-from-map optional). For shared vehicles hide the toggle (always sameAsMain).
- Route effect: keep existing main P→D route as `baseDistanceKm`/`durationMinutes`. When any passenger has distinct points, additionally fetch combined route through waypoints [mainPickup, ...distinctPickups, ...distinctDropoffs, mainDropoff] via `fetchRoute`. Set `distanceKm`=combined, recompute price (priceFor on combined) and pickupTime (duration from combined route).
- If combined > 1.25 × baseDistanceKm → set locationError "Passenger detour exceeds 25% of the base route — adjust points." and block preview (surface in validate()).

### 4c — CreateClient

- updateTrip already generic. Ensure return-trip reset clears `passengers` + `baseDistanceKm`.
- Submit payload: include `passengers` per trip.

### 4d — CreateMap

- Render extra markers for each distinct passenger pickup/dropoff (reuse ORIGIN/DEST icons, smaller or distinct color). Draw combined route (already uses t.routeCoordinates — combined coords feed it). Low priority; keep minimal.

### 4e — Booking model + trips API (server authority)

Files: `src/models/Booking.ts`, `src/app/api/trips/route.ts`

- TripSchema: add `passengers: [{ sameAsMain:Boolean, pickup:PointSchema(optional), dropoff:PointSchema(optional) }]` (\_id:false).
- trips API per trip: if passengers with distinct points present AND vehicle is private:
  - Server recompute combined distance by calling internal directions proxy `${APP_URL}/api/directions?origin=&dest=&waypoints=` (build waypoints as above). Guard: 500 if APP_URL unset.
  - Compute base main P→D distance same way. If combined > 1.25×base → 400 "Detour exceeds 25%".
  - Set distanceKm = combined; priceEgp = finalPrice(priceFor(combined,vKey), extraPax, vKey); pickupTime from combined duration.
  - Reject distinct points for shared vehicles (ignore/strip → treat as sameAsMain).
  - Persist passengers array.
    Verify: distinct-point booking within 25% saves combined distance/price; >25% returns 400; shared vehicle strips distinct points.

---

## PHASE 5 — Vehicles → Database (model, seed, CRUD, admin, mobile-ready)

Goal: DB single source of truth for vehicles; stable public API for web + mobile; admin CRUD.

### 5a — Admin role

Files: `src/models/User.ts`, `src/lib/auth/session.ts`, `src/types/auth.ts`

- Add "admin" to User.role enum + SessionPayload.role union. Provide a way to flag a user admin (manual/db or a seed note). GET stays public; mutations require session.role==="admin".

### 5b — Vehicle model

Files: new `src/models/Vehicle.ts`

- Fields: key(unique enum of VehicleKey), label, rate, ride("private"|"shared"), buffer, window,
  capacity, occupancy, min_occupancy, sortOrder(int), active(bool default true). timestamps.

### 5c — Seed

Files: new `scripts/seed_vehicles.js` (or `src/lib/db/seedVehicles.ts` callable)

- Upsert each VEHICLES entry from vehicles.ts into Vehicle collection (idempotent by key). Document run command in confirmation only (no md).

### 5d — CRUD endpoints (snake_case JSON contract for mobile)

Files: new `src/app/api/vehicles/route.ts` (GET list public, POST admin),
`src/app/api/vehicles/[key]/route.ts` (GET one, PATCH admin, DELETE admin).

- Next 16: type `params` as `Promise<{key:string}>`, await it (repo memory rule).
- Response shape stable: `{ key, label, rate, ride, buffer, window, capacity, occupancy, min_occupancy, active }`. Validate inputs; admin guard via getSession role.

### 5e — Runtime hydration (parametrize pure fns, keep seed fallback)

Files: `src/lib/config/vehicles.ts`, `src/app/api/trips/route.ts`, `src/components/create/CreateClient.tsx`, `src/components/create/TripCycle.tsx`, `src/lib/time/pickupWindow.ts`

- Add optional `vehiclesMap` param to priceFor/finalPrice/maxExtraPassengers/computePickupTime, default = static seed VEHICLES. Minimize call-site changes (only where DB values must win).
- Server (trips API): add `getVehicles()` loader (connectDB → Vehicle.find, in-memory cache w/ TTL, fallback to seed). Use its map for recompute so DB prices/capacity are authoritative.
- Web client: CreateClient fetch `GET /api/vehicles` on mount (alongside wallet/addresses/stations), store list, pass to TripCycle for labels/pricing. If fetch fails, fall back to static VEHICLE_LIST.
- Note for mobile: contract documented via the endpoint response only (no md).
  Verify: GET /api/vehicles returns seeded rows; changing a rate in DB reflects in server recompute + web after refetch; admin-only mutations enforced (401/403 otherwise).

---

## Global verification (after all phases)

1. `npx tsc --noEmit` (or get_errors) clean.
2. Manual: pick 2 dates → 2 bookings groupId → pay once → both paid.
3. Private trip + 1 distinct passenger within 25% prices up; >25% blocked front + back.
4. Reorder + vehicle DB list render on /create.

## Scope excluded

- my-requests/my-trips grouping redesign for grouped bookings (they list per-booking; leave as-is unless asked).
- Driver-side capacity/occupancy consumption logic (fields added; consumption logic future phase).
- i18n.
