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

## Notifications and review

The driver receives a localized confirmation after a successful report.
Passengers whose Trips were not cancelled when the incident was reported
receive a localized notification linking to `/my-trips/{tripId}`. Admins
receive an activity notification containing the ride number, incident type, and
ride status at report time. Notifications omit the driver's phone and the
report note. Notification failures do not undo or fail incident creation.

There is no incident resolution endpoint or admin review screen in this
release; those belong to the subsequent admin-review work. The model includes
resolution fields for that follow-up.

## Index release step

Before deploying, run the managed-index check against the target database:

```powershell
node scripts/ensureIndexes.mjs --check
```

If it reports missing indexes, apply the managed indexes:

```powershell
node scripts/ensureIndexes.mjs
```

This manages the unique partial index allowing one open incident per Ride and
the unique passenger-notification key allowing one incident notice per
passenger. Request handlers do not create indexes.
