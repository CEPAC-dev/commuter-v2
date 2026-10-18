# Driver ride incidents

## Reporting

An assigned driver may report `vehicle_breakdown`, `accident`, `emergency`,
`passenger_issue`, or `other` on a confirmed or active ride using
`POST /api/actions/ride/{rideId}/incident`. An optional note is limited to 300
characters. Reports do not cancel rides, charge penalties, or automatically
refund passengers. The ride remains in its current status while an incident is
open.

The route allows five report attempts per driver in each one-hour rate-limit
window. Only one open incident may exist for a ride. A duplicate report returns
HTTP 409 with `ALREADY_REPORTED` and the existing incident id. The Ride flag
and incident record are written in one MongoDB transaction.

## Driver actions while an incident is open

Starting a ride and confirming a pickup/boarding transition return HTTP 409
with `INCIDENT_OPEN`. Alighting, no-show, and ending the ride remain available
so passengers already on board can complete their trip. An active ride cannot
be cancelled directly; `DELETE /api/ride/{id}` returns HTTP 409 with
`USE_INCIDENT_REPORT`. Cancellation of a confirmed ride retains its existing
behavior. Admin cancellation is unchanged.

## Notifications and admin review

The driver receives a localized confirmation after a successful report.
Passengers whose Trips were not cancelled when the incident was reported
receive a localized notification linking to `/my-trips/{tripId}`. Admins
receive an activity notification containing the ride number, incident type, and
ride status at report time. Notifications omit the driver's phone and the
report note. Notification failures do not undo or fail incident creation.

Admins can review open and resolved incidents at `/admin/incidents`. Each
resolution requires an admin note of at most 500 characters:

| Action | Ride and Trip behavior | Wallet behavior |
| --- | --- | --- |
| `continue` | Clear the open-incident flag; leave the Ride and Trips unchanged. | None. |
| `cancel_no_penalty` | Cancel a confirmed or active Ride. Reset only not-yet-picked-up Trips; preserve picked-up or finished Trips and return their IDs for follow-up. | None. |
| `cancel_with_penalty` | Same cancellation and Trip behavior as `cancel_no_penalty`. | Apply the entered amount using the existing atomic penalty/debt rule; the amount must not exceed the maximum configured cancellation tier for the Ride price. |

All incident resolution writes (incident, Ride, eligible Trips, optional
wallet changes, and audit Log) run in one MongoDB transaction. A resolved
incident cannot be resolved again. After commit, the driver and non-cancelled
affected passengers receive localized outcome notifications. Notifications
contain no phone numbers or admin/driver free-text notes.

### Manual refund follow-up for picked-up Trips

Trips whose passenger is already boarding, on board, picked up, or dropped off,
and completed Trips, are not reset by an incident cancellation. Their IDs are
stored as `needsFollowUpTripIds` and shown to the admin after resolution. Review
those Trips in the existing refund requests screen and process any refund
separately through the established refund workflow. Incident resolution does
not automatically refund passengers.

## Index release step

Before deploying, run the managed-index check against the target database:

```powershell
node scripts/ensureIndexes.mjs --check
```

If it reports missing indexes, apply the managed indexes:

```powershell
node scripts/ensureIndexes.mjs
```

This manages the unique partial index allowing one open incident per Ride,
the unique passenger-notification key allowing one initial incident notice per
passenger, and the unique recipient/outcome key used to deduplicate resolution
notifications. Request handlers do not create indexes.
