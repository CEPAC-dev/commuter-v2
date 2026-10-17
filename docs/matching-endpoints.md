# Matching and expiry endpoints

Matching is externally triggered; this repository does not define a scheduler.
A scheduler should call mutation routes with POST and must not include Trip or
passenger data in scheduler logs.

| Endpoint | Purpose | Caller and authorization | Safe frequency and repeat behavior |
| --- | --- | --- | --- |
| `GET /api/admin/match-ride` | Read-only matching options; only paid, submitted, unlinked Trips are eligible. | Admin session (`adminAuth`); no scheduler header. | Call when the admin opens or refreshes the matching tool. Does not create Rides or offers. |
| `POST /api/admin/addMatchedData` | Import matched groups from an uploaded workbook. | Admin session (`adminAuth`); no scheduler header. | Repeated calls only claim eligible Trips; conflicting groups are skipped and reported. |
| `GET /api/ride` | Read-only Ride lookup for driver/passenger query parameters. | No route-level authentication; the caller supplies a driver or passenger ID. | Read-only; no rate limiter was found. |
| `POST /api/ride` | Create a Ride from selected eligible Trips. | Admin session (`adminAuth`); no scheduler header. | Repeating the same Trip set returns 409 after its first successful claim. |
| `POST /api/trips/expire` | Expire eligible pending items and mark eligible submitted Trips `nomatch` after the configured cutoff. | External scheduler sends `x-cron-secret: $CRON_SECRET`; secret must be at least 32 characters. Invalid requests return 401; missing/short production configuration returns 500. | Safe to call repeatedly. Once-hourly POST is sufficient operational guidance; no provider-specific scheduler is assumed. |
| `GET /api/trips/expire` | Mutation via GET is not supported. | No authorization; returns 405. | Use POST only. |

Set `CRON_SECRET` in the server environment and `.env.local`; never expose it
to browser code. Configure an external scheduler to issue an HTTPS POST to
`/api/trips/expire` with the `x-cron-secret` header. No provider-specific cron
configuration exists in this repository.

Ride creation claims every Trip transactionally using `submitted`, paid
payment status, and an empty `rideId`. If any Trip cannot be claimed, the
transaction rolls back and no Ride, offer, or ride-offer notification is
created. Expiry writes are conditional and do not expire Trips linked to a
Ride; promo reservations are released only after the Request transition
succeeds.

The existing 23:00 Cairo nomatch cutoff remains unchanged. The D-1
17:00–19:00 cancellation-policy window is not a matching-endpoint time gate.

## Driver availability lock (read-only audit)

`canModifyAvailability` has no call sites. Driver availability PUT/DELETE,
admin availability create/update/delete/restore, and admin date-shift routes
do not enforce it. Apply the helper only after defining a target date for
recurring `dayOfWeek` records. Date-specific restore and shift mutations also
need an explicit lock policy first.
