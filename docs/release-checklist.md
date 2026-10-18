# Release checklist

## Environment variables

Set these for the features in this release. Do not use quoted literal values
for secrets.

| Variable | Meaning and format | Default |
| --- | --- | --- |
| `PICKUP_PIN_SECRET` | Required secret used to derive pickup PINs. At least 32 characters; do not wrap the value in literal quotes. | None |
| `CRON_SECRET` | Secret for the expiry scheduler's `x-cron-secret` header. At least 32 characters in production. | None |
| `CHAT_FREE_TEXT_ENABLED` | Free-text chat switch. Only the exact string `true` enables it; keep `false` at first launch. | Disabled when unset |
| `CHAT_RETENTION_DAYS` | Whole-number retention period for chat messages, from 1 through the supported MongoDB TTL range. | `30` |
| `NO_SHOW_MIN_WAIT_MINUTES` | Positive integer the driver must wait after confirming pickup-stop arrival before marking a no-show. | `5` |
| `MONGODB_URI` | MongoDB connection string used by the application and operational scripts. The database must support transactions. | None |
| `DB_NAME` | Optional database name used by capacity/index maintenance scripts when connecting. | Driver default |

No additional environment variable names were introduced in the feature diff
from `test/live-plus-latest` to `feat/no-show-trips`.

## Database and indexes

MongoDB must run as a replica set (or another transaction-capable deployment).
Before deployment, run:

```sh
node scripts/ensureIndexes.mjs --check
node scripts/ensureIndexes.mjs
```

The managed indexes added in this work are:

- `chat_reporter_trip_one_open` — at most one open report per reporter and Trip.
- `chat_messages_created_at_ttl` — expire messages after `CHAT_RETENTION_DAYS`.
- `chat_read_state_trip_user_unique` — one read-state record per Trip and user.
- `chat_read_state_updated_at_ttl` — expire stale read-state records after the retention period plus seven days.
- `ride_one_open_incident` — at most one open incident per Ride.
- `ride_incident_passenger_notification_unique` — deduplicate incident notices per passenger/incident.
- `ride_incident_outcome_notification_unique` — deduplicate incident outcome notices per recipient/incident/outcome.
- `no_show_trip_notification_unique` — deduplicate no-show notices per Trip.

The index script checks for duplicate data before creating managed unique
indexes. Resolve any reported duplicates before deployment; do not create
indexes from request handlers.

## One-off capacity scripts

1. Run `node scripts/updateSharedCarCapacity.mjs` first. This is a dry run and
   reports the proposed `shared_car` and `taxi_shared` occupancy changes.
2. Review the output, then run
   `node scripts/updateSharedCarCapacity.mjs --apply` to apply the changes.
3. Run `node scripts/checkVehicleCapacity.mjs` to report any over-capacity
   Trips or Rides. It is read-only.

Both scripts require `MONGODB_URI`; `DB_NAME` may be set to select a database.

## Expiry scheduler

Configure the external scheduler to send:

- **URL:** `https://<APP_HOST>/api/trips/expire`
- **Method:** `POST`
- **Header:** `x-cron-secret: <CRON_SECRET>`
- **Suggested frequency:** every five minutes.

The endpoint expires stale pending requests and sweeps eligible unmatched
Trips. The old `Authorization: Bearer` header is not accepted, and the GET
alias returns `405 Method not allowed`; if the scheduler is not updated,
eligible records will stop expiring and becoming `nomatch`.

## Deploy-time risks

- Rides already in progress at deployment may have no persisted pickup
  `arrivedAt`; a driver must confirm arrival after deployment before the
  server-enforced no-show wait can be satisfied.
- The admin matching tool no longer lists `matched` or `pending_payment` Trips.
- Admins cannot edit capacities on built-in vehicle types. Custom vehicle
  classes remain configurable; they still need corresponding static
  seat-grid/capacity support before they can be safely used for matching.
- Test the scheduler secret and a production transaction-capable MongoDB
  connection in the deployment environment before accepting live rides.

## Manual smoke tests

Use test accounts, test payments, and a staging database. Do not create test
financial adjustments against production wallets.

1. **Pickup PIN lockout:** Match a passenger Trip, submit an incorrect pickup
   PIN repeatedly, confirm rate limiting/lockout is shown, then verify a
   correct PIN works after the lockout policy permits it.
2. **Multi-seat boarding:** Assign a Trip with multiple passengers to a shared
   vehicle, start the Ride, board it at the correct stop, and verify each
   passenger seat changes as expected.
3. **Chat both directions and presets:** Send a preset from driver to
   passenger, reply from passenger to driver, and confirm both messages appear
   in order for both users.
4. **Free text disabled:** With `CHAT_FREE_TEXT_ENABLED=false`, verify preset
   messages work and arbitrary free text is unavailable/rejected.
5. **Chat report to admin:** Submit a report from a conversation; verify it
   appears in `/admin/chat-reports` with the report snapshot and can be
   reviewed.
6. **Unread badge:** Send an unread message, verify the recipient's unread
   indicator increments, then open/read the conversation and confirm it clears.
7. **Matched driver phone visibility:** Confirm the matched passenger can see
   the driver's phone while the Ride is live; confirm it is hidden after the
   Ride ceases to be live or the passenger is no longer eligible.
8. **Shared-car capacity:** Verify `shared_car` and `taxi_shared` allow at most
   three passengers in the app, Ride assignment, and seat grid.
9. **Driver cancellation debt:** In staging, cancel an eligible confirmed Ride
   with a wallet too low for its policy penalty; confirm the Ride cancellation
   and resulting debt follow the configured wallet behavior.
10. **Debt repayment:** Credit/settle a driver's completed Trip and verify
    outstanding debt is repaid from earnings before the remaining earning is
    credited.
11. **Incident report and resolutions:** Report a problem from an active
    driver Ride. As an admin, test each resolution separately on fresh
    incidents: `continue`, `cancel_no_penalty`, and `cancel_with_penalty`.
    Verify the suggestion, required admin note, cancellation result, and any
    picked-up passenger follow-up list.
12. **No-show wait and passenger review:** Confirm arrival at a pickup stop,
    verify the driver cannot mark no-show before the configured wait, then
    mark no-show after the wait. Verify the passenger notice and submit a
    review request from Trip details.
13. **Admin cancellation preserves boarded passengers:** Cancel a Ride with
    both not-yet-picked-up and already picked-up passengers; verify only the
    former Trips reset and the preserved IDs are returned for follow-up.
14. **Expiry endpoint with and without secret:** Call `POST /api/trips/expire`
    with no header and expect unauthorized; repeat with the configured
    `x-cron-secret` and verify the sweep response. Confirm a GET call returns
    405.

## Rollback

Application behavior can be rolled back by redeploying the previous release.
Database state is not automatically rolled back: chat messages/read states,
reports, incidents, no-show Trip statuses and timestamps, wallet/debt changes,
notifications, and capacity updates persist. Managed indexes also remain after
code rollback. Review those records and any index removal separately; do not
assume a redeploy reverses financial or operational actions.

## Privacy page updates

Update the public privacy notice to cover:

- Chat retention and automatic deletion after 30 days by default.
- Chat report snapshots retained for admin review.
- Ride incident reports and no-show records retained as operational history.
- The matched passenger can see the driver's phone only while the Ride is live
  and the passenger remains eligible.
