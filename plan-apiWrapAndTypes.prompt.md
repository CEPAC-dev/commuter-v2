---
description: Wrap all CRUD ops under /src/app/api as reusable REST endpoints, move server pages onto a shared service layer, centralize types under /src/types, and regenerate the Postman collection for the mobile developer.
---

# Plan: API-wrap CRUD + centralize types

Expose ALL data operations as reusable REST APIs under `src/app/api` (for the mobile dev +
Postman), move the 7 direct-DB server pages onto a **shared service layer**, and consolidate
scattered types into `src/types`. Pure refactor + new read endpoints. NO behavior change.

## Architecture decision

Data access = **shared service layer** (`src/lib/services/*`). Both the new GET API routes AND
the server pages import the same functions. Server pages do NOT `fetch()` their own API (avoids
extra HTTP hop, absolute `APP_URL`, cookie-forwarding fragility). One source of truth per query.

Profile endpoint: **extend `GET /api/auth/me`** (add driver branch) rather than a new route.
Booking status: **new `GET /api/bookings/[id]/status`** (clean REST for mobile).

## Credit rules for executor

- One phase at a time, STOP after each.
- Reuse files; never rewrite working code. Keep service query logic byte-identical to the current
  page logic (copy, don't redesign).
- No dev server. Batch reads. No new markdown docs.
- Don't touch dead nav files (BottomNav / UserNavbar / DriverBottomNav / PageHeader).
- Next 16: dynamic route `params` typed `Promise<{ id: string }>`, `await` before use.
- Read files before editing. Verify with tsc after each phase
  (`node ./node_modules/typescript/bin/tsc --noEmit` — `npx` is unavailable in this shell).

## Phase 1 — Types consolidation ✅ DONE

Created:

- `src/types/geo.ts` — `LatLng`, `GeoPoint`, `StationSelection`.
- `src/types/booking.ts` — `PaymentStatus`, `BookingStatus`, `TripStatus`, `TripListRow`,
  `BookingTripRow`, `BookingRow`.
- `src/types/forms.ts` — `PassengerInput`, `StopInput`, `TripInput` (moved from `api/trips/route.ts`).

Replaced inline dups (import + alias, deleted local copies) in: `my-trips/page.tsx`,
`my-trips/[id]/page.tsx`, `my-requests/page.tsx`, `my-requests/[id]/page.tsx`,
`api/trips/route.ts`, `api/driver/availability/route.ts`, `availability/AvailabilityClient.tsx`.
Page-local view-model rows left in place where page-specific. tsc clean.

## Phase 2 — Service layer (extract, no behavior change) ✅ DONE

Create `src/lib/services/` mirroring current page queries EXACTLY (same filters, sort, pagination):

- `trips.ts`: `listUserTrips(userId, { page, pageSize=12, paymentStatus?, vehicleType? })` →
  `{ rows: TripListRow[], total, page }`; `getUserTrip(userId, tripId)` → detail | null.
- `requests.ts`: `expireStaleForUser(userId)` (the >2h `updateMany` on Request + Trip →
  status `time_out` / paymentStatus `expired`); `listUserRequests(userId, { page, pageSize=8,
paymentStatus?, status? })` → `{ rows: BookingRow[], total, page }`; `getUserRequest(userId, reqId)`
  → `{ request, trips, wallet }` | null.
- `profile.ts`: `getProfile(userId, role)` → user (+ driver doc if role=driver).
- `availability.ts`: `listDriverAvailability(driverId)`.
- `booking-status.ts`: `getBookingStatus(userId, bookingId)` (select paymentStatus, amountEgp,
  status, dates).
  Each returns plain serializable objects (`.lean()` + `_id`→string) typed by Phase-1 types.

Implemented under `src/lib/services/`: `trips.ts`, `requests.ts`, `profile.ts`,
`availability.ts`, and `booking-status.ts`. Query filters, sort orders, page sizes, and the
two-hour pending-payment expiry behavior match current page logic. Pages still use their
existing direct queries until Phase 4. tsc clean.

## Phase 3 — New GET API routes (thin wrappers over services) ✅ DONE

- `GET /api/trips` (add to existing POST file) → `listUserTrips`. Query: page, paymentStatus,
  vehicleType. Auth via `getSession`.
- `GET /api/trips/[id]` (NEW) → `getUserTrip`. 404 if not owner.
- `GET /api/requests` (NEW) → `expireStaleForUser` + `listUserRequests`. Query: page, paymentStatus,
  status.
- `GET /api/requests/[id]` (NEW) → expire single + `getUserRequest`.
- Profile: extend `GET /api/auth/me` with driver branch → `getProfile`.
- `GET /api/availability` (driver) → confirm/refactor to `listDriverAvailability`.
- `GET /api/bookings/[id]/status` (NEW) → `getBookingStatus`.
  All: Next 16 `params` Promise + await; JSON `{ data, ... }` or `{ error }`; 401 unauth, 404 not-owner.
  Read-only — no client-trusted recompute needed here.

Implemented: `GET /api/trips`, `GET /api/trips/[id]`, `GET /api/requests`,
`GET /api/requests/[id]`, `GET /api/auth/me`, `GET /api/driver/availability`, and
`GET /api/bookings/[id]/status`. List endpoints include `page`, `pageSize`, `total`, and
`totalPages`; all detail endpoints owner-scope records. tsc clean.

## Phase 4 — Repoint server pages to services ✅ DONE

Replace inline model queries in the 7 pages with the Phase-2 service calls (same data, same render,
same pagination/filters/expiry). Pages remain server components importing service fns (NOT fetching
own API). Verify no UI/props change.

Rewired `my-trips`, `my-trips/[id]`, `my-requests`, `my-requests/[id]`, `profile`,
`availability`, and `checkout/callback`. Payment callback retains its server-side Kashier
verification/settlement, then reads booking state through `getBookingStatus`. No target page now
imports `connectDB` or a Mongoose model. tsc clean.

## Phase 5 — Postman collection regen ✅ DONE

Rewrite `commuter.postman_collection.json`: one folder per domain (auth, trips, requests, profile,
driver, availability, payments, wallet, vehicles, stations, places, geocode, directions, upload).
Each request: method, `{{baseUrl}}` URL, cookie/JWT auth note, example body/query, sample 200 + error.
Add collection var `baseUrl` and a login request that captures the auth cookie. Include all new GETs.

Updated `commuter.postman_collection.json` with the `Requests` and `Bookings` folders plus
trip list/detail reads; added `requestId` and `CRON_SECRET` variables and a Login cookie assertion.
Removed stale DELETE requests for stations and vehicles (those handlers do not exist). All 45 current
route methods are represented. JSON parses clean; final tsc clean.

## Verification (per phase)

1. `node ./node_modules/typescript/bin/tsc --noEmit` clean.
2. grep: no inline `PaymentStatus`/`BookingStatus`/`LatLng`/`Point`/`StationSelection` outside `src/types`.
3. Postman: each new GET logged-in → 200 correct shape; logged-out → 401; other user's id → 404.
4. `my-trips`/`my-requests`/`profile`/`availability` render identical (pagination, filters, expiry).
5. Postman collection imports clean; all endpoints resolve.
