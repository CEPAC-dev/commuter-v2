# Execution prompt — Private-ride stations + admin export APIs

Instructions for Sonnet. Execute ONE phase at a time. Stop after each phase. Run
`npm run lint` after each phase. Do NOT touch shared-ride flow, UI, or the map.

Locked decisions:

- Excel = real `.xlsx` via **exceljs** (add dependency).
- Two-file delivery = **one ZIP download** containing both JSON and `.xlsx` files.
- Export filter = **private vehicleTypes only** (`private_car`, `taxi_private`).
- No backfill for old trips (missing station → `null` in export).

---

## Phase 1 — Attach nearest stations to private trips (server-only, invisible)

File: `src/app/api/trips/route.ts`

Goal: every newly created **private** trip stores `pickupStation` and
`dropoffStation` (nearest active station to pickup / dropoff). Purely
informational. NOTHING the user sees changes — no map markers, no station
options, no walking time, no route/duration/price change, no client payload.

Steps:

1. The private branch (`if (!isShared) { ... continue; }`) currently pushes a
   `serverTrip` WITHOUT stations. Fix that.
2. Station data is currently fetched only inside the shared branch
   (`await connectDB(); const stations = await Station.find({ active: true })...`).
   Hoist a canonical station list so BOTH branches can use it:
   - Before the `for (const t of trips)` loop, call `await connectDB()` once and
     build a reusable array from `Station.find({ active: true }).lean()`:
     ```ts
     const stationDocs = await Station.find({ active: true }).lean();
     const canonicalStations = stationDocs.map((s) => ({
       id: s.objectId,
       name: s.name || s.direction || "",
       lat: s.lat,
       lng: s.lng,
       popupInfo: [s.direction, s.landmark, s.stationType]
         .filter(Boolean)
         .join("\n"),
     }));
     ```
   - Remove the duplicate fetch inside the shared branch and reuse
     `canonicalStations` there (keep shared behaviour identical — it uses
     `findNearestStations`).
3. Import `findNearestStation` from `@/lib/geo/stations` (single-nearest helper).
4. In the private branch, after `route` is computed and before
   `serverTrips.push(...)`, compute:
   ```ts
   const nearPickup = findNearestStation(
     t.pickup.lat,
     t.pickup.lng,
     canonicalStations,
   );
   const nearDropoff = findNearestStation(
     t.dropoff.lat,
     t.dropoff.lng,
     canonicalStations,
   );
   ```
5. Add to the pushed private `serverTrip` object (only when a station exists):
   ```ts
   ...(nearPickup && {
     pickupStation: { id: nearPickup.id, lat: nearPickup.lat, lng: nearPickup.lng, name: nearPickup.name },
   }),
   ...(nearDropoff && {
     dropoffStation: { id: nearDropoff.id, lat: nearDropoff.lat, lng: nearDropoff.lng, name: nearDropoff.name },
   }),
   ```
6. `ServerTrip` interface already declares optional `pickupStation`/`dropoffStation`
   — no type change needed. `Trip` schema already has these fields — no migration.
7. Do NOT set `pickupStationOptions`, `walkingMinToStation`, etc. for private.

Verify: create a private ride → `trips` doc has `pickupStation`/`dropoffStation`;
route/price/duration and all UI unchanged.

---

## Phase 2 — `getPrivateRideRequests` export API (JSON + Excel)

Add dependency first: `npm i exceljs`.

New file: `src/app/api/admin/getPrivateRideRequests/route.ts`

Public for now. Add a comment: `// TODO: restrict to admin once dashboard exists`.

Behaviour:

- `GET`. Download one ZIP containing both files:
  - `private-ride-requests.json`
  - `private-ride-requests.xlsx`
- Query `Trip`:
  ```ts
  { status: "submitted", paymentStatus: "paid",
    vehicleType: { $in: ["private_car", "taxi_private"] } }
  ```
- Resolve `passId` (`userNumber`) from `users`. Collect distinct `userId`s, then
  `User.find({ _id: { $in: ids } }).select("userNumber")` → build
  `Map<string, number>`. (Do NOT trust any client value.)
- Map each trip to this EXACT shape (property order preserved). Missing values
  → `null`:
  ```ts
  {
    rideId: trip.tripNumber,
    passId: userNumberMap.get(String(trip.userId)) ?? null,
    originNearestStationNo: trip.pickupStation?.id ?? null,
    originLat: trip.pickup?.lat ?? null,
    originLong: trip.pickup?.lng ?? null,
    destinationNearestStationNo: trip.dropoffStation?.id ?? null,
    destinationLat: trip.dropoff?.lat ?? null,
    destinationLong: trip.dropoff?.lng ?? null,
    stop1Lat: s[0]?.point?.lat ?? null,
    stop1Long: s[0]?.point?.lng ?? null,
    stop1Alighting: s[0]?.alighting ?? null,
    stop1Boarding: s[0]?.boarding ?? null,
    stop1WaitingTime: s[0]?.waitingMinutes ?? null,
    stop2Lat: s[1]?.point?.lat ?? null,
    stop2Long: s[1]?.point?.lng ?? null,
    stop2Alighting: s[1]?.alighting ?? null,
    stop2Boarding: s[1]?.boarding ?? null,
    stop2WaitingTime: s[1]?.waitingMinutes ?? null,
    stop3Lat: s[2]?.point?.lat ?? null,
    stop3Long: s[2]?.point?.lng ?? null,
    stop3Alighting: s[2]?.alighting ?? null,
    stop3Boarding: s[2]?.boarding ?? null,
    stop3WaitingTime: s[2]?.waitingMinutes ?? null,
    stop4Lat: s[3]?.point?.lat ?? null,
    stop4Long: s[3]?.point?.lng ?? null,
    stop4Alighting: s[3]?.alighting ?? null,
    stop4Boarding: s[3]?.boarding ?? null,
    stop4WaitingTime: s[3]?.waitingMinutes ?? null,
    readyFrom: trip.pickupTime,
    shouldArrivebefore: trip.arrivalTime,
    rideType: trip.vehicleType === "private_car" ? 1 : 2,
    totalStartedPassengers: trip.numberOfPassengers,
  }
  ```
  where `const s = trip.stops ?? []`.
- Keep the field key list in ONE shared `const COLUMNS: (keyof Row)[]` array so
  JSON and Excel stay in sync.

Response:

- Build the Excel file with exceljs — one worksheet, header row = `COLUMNS`,
  one data row per record (values in `COLUMNS` order, `null` → empty cell).
  ```ts
  import ExcelJS from "exceljs";
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("PrivateRideRequests");
  ws.addRow(COLUMNS);
  for (const r of rows) ws.addRow(COLUMNS.map((c) => r[c]));
  const buf = await wb.xlsx.writeBuffer();
  ```
- Package JSON and XLSX together using `jszip`.
  ```ts
  import JSZip from "jszip";
  const zip = new JSZip();
  zip.file("private-ride-requests.json", JSON.stringify(rows, null, 2));
  zip.file("private-ride-requests.xlsx", Buffer.from(buf));
  const body = await zip.generateAsync({ type: "blob" });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition":
        'attachment; filename="private-ride-requests.zip"',
    },
  });
  ```
- Add `export const dynamic = "force-dynamic";` and `export const runtime = "nodejs";`
  (exceljs needs Node runtime).
- `await connectDB()` before querying.

Verify: mark a private trip `status:"submitted"` + `paymentStatus:"paid"`; hit
`/api/admin/getPrivateRideRequests` → ZIP downloads with exact JSON structure,
stops null-padded to 4, `rideType` 1/2, and valid `.xlsx` with matching columns.

---

## Phase 3 — APIs #2 and #3

Specs not provided yet. Do NOT build. Wait for the user to define each API's
name, filter, and output structure. When given, mirror Phase-2 conventions
(public + `// TODO admin guard`, `force-dynamic`, nodejs runtime, shared COLUMNS).

---

## Guardrails

- Server recomputes / re-reads everything from DB. Never trust client values.
- Do not modify shared-ride logic, `TripCycle.tsx`, `CreateMap.tsx`, or any UI.
- Do not add markers/options/walking for private rides.
- One phase per run; `npm run lint` must pass before stopping.
