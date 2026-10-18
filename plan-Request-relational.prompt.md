# Commuter — Request/Trip relational migration

Execute one phase at a time. Wait for phase name. Implement only that phase, validate it, report changed files and result, then stop.

## Product change

Current model uses one `Booking` document containing `dates[]` and embedded `trips[]`.
Replace it with:

- `Request` document in MongoDB collection `requests`.
- `Trip` document in MongoDB collection `trips`.
- One Request per form submission.
- One Trip per selected date × configured trip cycle.
- One payment for complete Request.

Example: 3 selected dates + 2 configured trips = 1 Request + 6 Trip documents:

- Trip 1 / date 1
- Trip 2 / date 1
- Trip 1 / date 2
- Trip 2 / date 2
- Trip 1 / date 3
- Trip 2 / date 3

Trips are created when Request is created with `pending_payment`. Payment settlement updates Request and every related Trip.

## Locked decisions

- Fully relational. Request has no embedded trips.
- `Trip.requestId` references Request.
- `Trip.userId` is denormalized for efficient `/my-trips` queries.
- Trip stores its own `date`.
- Trip stores denormalized `paymentStatus` and lifecycle `status`, kept in sync with Request during payment settlement.
- `Request.amountEgp` = sum of one cycle's prices × selected date count.
- Each materialized Trip stores one cycle price in `priceEgp`.
- Keep API response compatibility: POST `/api/trips` returns `{ bookingId, amountEgp }`; `bookingId` contains Request `_id` until API naming is intentionally changed later.
- No old-data migration. Development database may drop old `bookings` collection manually.
- New detail route is `/my-trips/[id]`.
- Existing private/shared vehicle rules, date window, server-side route recomputation, 25% detour cap, and DB vehicle source of truth remain unchanged.

## Hard implementation rules

- Do one phase only when named. Stop after phase validation.
- Reuse existing helpers and JSX. Avoid unrelated refactors.
- Do not re-read files already included in current context unless required by an error.
- Batch edits per file. Keep changes minimal.
- Never trust client price, distance, duration, pickup time, amount, vehicle configuration, or dates. Recompute and validate server-side.
- Preserve auth ownership checks on every Request and Trip query.
- Never expose another user's Request or Trip by accepting only an ID.
- Use `connectDB()` before model queries.
- Next 16 dynamic route params use `params: Promise<{ id: string }>` and `await params`.
- Keep Mongoose development model-cache guards so stale schemas do not survive hot reload.
- Do not touch unrelated React effect/lint warnings.
- No new documentation files during implementation.
- Run focused diagnostics after edits. Run `npm run build` at phase end when requested or available.

## Phase 1 — Models

Goal: create relational models before changing readers/writers.

### Create `src/models/Request.ts`

Move Request-owned fields from current Booking model:

- `userId`: ObjectId ref User, required, indexed.
- `dates`: required non-empty `string[]`, `YYYY-MM-DD` values.
- `amountEgp`: required server-computed number.
- `paymentStatus`: `pending | paid | failed | refunded | expired`.
- `kashierSessionId`.
- `kashierOrderId`.
- `paidAt`.
- `status`: `pending_payment | submitted | matching | confirmed | active | completed | cancelled | time_out`.
- timestamps.

Use model name `Request`, collection name `requests`.
Do not include embedded `trips`.
Keep development stale-model protection appropriate for renamed schema.
Export an inferred document type.

### Create `src/models/Trip.ts`

Move trip-owned schemas and fields from Booking:

- `requestId`: ObjectId ref Request, required, indexed.
- `userId`: ObjectId ref User, required, indexed.
- `date`: required `YYYY-MM-DD` string, indexed.
- `cycleIndex`: required integer identifying configured cycle order.
- `pickup` and `dropoff` Point subdocuments.
- `vehicleType` enum.
- `rideType` enum.
- `arrivalTime` and computed `pickupTime`.
- `distanceKm`, `durationMinutes`, `priceEgp`.
- `extraPassengers`.
- passenger details with optional distinct pickup/dropoff points.
- optional station and walking-time fields already supported by current Booking trip schema.
- denormalized `paymentStatus` and `status` with same enums as Request.
- timestamps.

Keep Point and passenger subdocuments non-independent where current schema does so. Add indexes useful for queries: `{ requestId: 1, date: 1 }`, `{ userId: 1, date: -1 }`.

### Remove old model

Delete `src/models/Booking.ts` only after all imports are changed in later phases. If deleting in this phase causes broad compile failures, keep a temporary compatibility export only until Phase 3, then remove it. Do not leave two sources of truth after migration.

### Verify

- TypeScript diagnostics for new models.
- Confirm schemas contain no embedded `trips` in Request.
- Confirm Trip contains `requestId`, `userId`, and `date`.

## Phase 2 — Request creation and Trip fan-out

Goal: POST `/api/trips` creates one Request and materializes all date/cycle combinations.

Edit `src/app/api/trips/route.ts`:

1. Replace Booking import with Request and Trip imports.
2. Keep current auth, date-window validation, vehicle validation, route recomputation, passenger detour validation, shared/private handling, and server pricing.
3. Build server cycle templates exactly once. Do not multiply client input blindly.
4. Calculate:

   `perDateAmountEgp = sum(serverTrip.priceEgp)`

   `amountEgp = perDateAmountEgp * dates.length`

5. Create one Request with `dates`, `amountEgp`, pending payment, and pending lifecycle status.
6. Create Trip documents using date × server-trip fan-out:

   ```ts
   const tripDocuments = dates.flatMap((date) =>
     serverTrips.map((trip, cycleIndex) => ({
       requestId: request._id,
       userId: new Types.ObjectId(session.userId),
       date,
       cycleIndex,
       ...trip,
       paymentStatus: "pending",
       status: "pending_payment",
     })),
   );
   await Trip.insertMany(tripDocuments);
   ```

7. Preserve response shape `{ bookingId: String(request._id), amountEgp }` so CreateClient and payment UI do not change in this phase.
8. Avoid partial writes: use a transaction if existing DB setup supports it. Otherwise delete the created Request if Trip insertion fails, then return 500.

### Verify

- POST with 3 dates + 2 cycles creates 1 Request and 6 Trips.
- Every Trip has correct `requestId`, `userId`, `date`, `cycleIndex`.
- Request amount equals six Trip prices.
- Invalid/out-of-window dates still reject.
- Server ignores client-supplied price/time/amount.

## Phase 3 — Payment session, wallet, webhook, callback

Goal: one payment updates one Request and all its Trips.

Files:

- `src/app/api/payments/session/route.ts`
- `src/app/api/payments/wallet/route.ts`
- `src/app/api/payments/webhook/route.ts`
- `src/lib/payments/kashier.ts`
- `src/app/checkout/callback/page.tsx`

### Kashier session

- Replace Booking lookup with Request lookup.
- Keep owner validation.
- Use Request `amountEgp` as sole payment amount.
- Keep Kashier order ID and callback semantics compatible with current `bookingId` parameter.
- Store session/order IDs on Request only.

### Wallet payment

- Debit exactly Request `amountEgp` once.
- Mark Request paid/submitted.
- `Trip.updateMany({ requestId }, { paymentStatus: "paid", status: "submitted" })`.
- If later operation fails, refund wallet transaction and avoid a partially settled state.
- Make update idempotent: repeated payment callback must not charge twice.

### Webhook and direct verification

- Locate Request by Kashier order ID or Request ID according to current flow.
- Validate signature before settlement.
- Mark Request paid/submitted once.
- Update all related Trips with matching payment/lifecycle state.
- Preserve wallet top-up handling.
- Callback may verify directly, but webhook remains supported and settlement must be idempotent.

### Callback page

- Replace Booking model import with Request.
- Read Request `dates`, amount, payment status, and status.
- Do not read embedded trips.
- Keep redirect/auth ownership behavior.

### Verify

- Kashier session amount equals Request total.
- Wallet charges once for complete Request.
- Webhook/callback updates one Request + all related Trips.
- Repeated webhook does not duplicate charge or corrupt status.

## Phase 4 — `/my-requests` and Request detail

Goal: Request pages show one Request while loading related Trips relationally.

Files:

- `src/app/my-requests/page.tsx`
- `src/app/my-requests/[id]/page.tsx`

### List page

- Replace Booking queries with Request queries.
- Preserve server auth guard, filters, pagination, existing UI, status pills, wallet balance, and Continue checkout behavior.
- Query Requests by authenticated `userId` and payment/status filters.
- Query related Trips by Request IDs, group by `requestId`, and attach trip rows to each Request.
- Do not duplicate Request cards per date.
- Display selected dates from Request.
- Use related Trips for cycle details. Decide display convention explicitly: show cycle templates once, or show date-expanded trips grouped by date. Prefer grouped by date because each Trip is materialized.
- Preserve empty state and existing design.

### Detail page

- Validate ObjectId and authenticated ownership.
- Fetch one Request by `_id` + `userId`.
- Fetch all Trips by `requestId`, sorted by `date`, then `cycleIndex`.
- Group/display Trips by date while preserving current route, vehicle, times, price, station, and passenger details.
- Continue checkout must use parent Request ID.
- Never trust route parameter alone.

### Verify

- One Request with 3 dates + 2 cycles renders one Request card.
- Detail shows 3 date groups, each containing 2 Trips.
- Pending Request still shows Continue checkout.
- Other user's Request returns not found.

## Phase 5 — Flat `/my-trips` and Trip detail

Goal: `/my-trips` becomes flat materialized Trip history.

### Rewrite `src/app/my-trips/page.tsx`

- Replace Booking aggregate/unwind with Trip queries.
- Filter by authenticated `userId`.
- Apply payment and vehicle filters to Trip fields.
- Sort newest/relevant first. Prefer `{ date: -1, createdAt: -1, cycleIndex: 1 }` or current product ordering; keep consistent.
- Paginate with `skip`/`limit` and `countDocuments`.
- Each card represents exactly one materialized Trip, not a Request template.
- Show date, route, vehicle, pickup/arrival time, price, and parent payment state.
- Card link: `/my-trips/${trip._id}`.
- Preserve existing RouteMap, EmptyState, FilterBar, Pagination, pills, and responsive styling.
- Driver branch remains untouched unless current role handling requires compile fixes.

### Create `src/app/my-trips/[id]/page.tsx`

Server page requirements:

- `params: Promise<{ id: string }>`; await params.
- Auth guard.
- Validate Trip ObjectId.
- Fetch Trip by `_id` + authenticated `userId`.
- `notFound()` when absent.
- Render full Trip detail: date, cycle number, route map, pickup/dropoff, vehicle, ride type, pickup/arrival times, distance/duration, price, extra passengers, passenger points when present, payment status, lifecycle status.
- Link to parent `/my-requests/${trip.requestId}`.
- Reuse existing visual language and components. No new design system.

### Verify

- 3 dates + 2 cycles produces 6 rows in `/my-trips`.
- Each row opens its own detail.
- Parent Request link works.
- User cannot open another user's Trip.
- Filters and pagination count materialized Trips, not Requests.

## Phase 6 — Cleanup and consistency

Goal: remove stale Booking terminology and verify complete flow.

Search all `src` files for:

- imports from `@/models/Booking`.
- `Booking.find`, `Booking.aggregate`, `Booking.create`.
- embedded `trips` assumptions on Request.
- singular Request date assumptions where date belongs to Trip.
- `groupId` logic from old grouped-booking implementation.
- payment code that expects multiple Booking records.
- `booking` labels in user-visible text where product now says Request.

Update only relevant stale references. Keep API compatibility names (`bookingId`) until separately approved.

Do not remove `src/lib/config/vehicles.ts` or change vehicle DB behavior.
Do not implement deferred private-vehicle UI changes.

## Final verification

1. TypeScript diagnostics clean for changed files.
2. `npm run build` passes.
3. New Request creation with 3 dates + 2 cycles:
   - 1 document in `requests`.
   - 6 documents in `trips`.
   - 6 Trips reference same Request.
   - 6 Trips have correct dates and cycle indexes.
4. Request amount equals all six Trip prices.
5. One Kashier or wallet payment settles Request and all six Trips once.
6. `/my-requests` shows one Request.
7. `/my-requests/[id]` shows date groups and cycles.
8. `/my-trips` shows six flat Trips.
9. `/my-trips/[id]` shows one Trip and links to parent Request.
10. Unauthorized and cross-user access rejected.
