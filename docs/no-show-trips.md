# No-show Trips

## Policy defaults

- `no_show` is terminal. No automatic refund is created when the driver marks
  the passenger absent.
- The driver can mark a passenger absent only after explicitly confirming
  arrival at that passenger's pickup and waiting at least
  `NO_SHOW_MIN_WAIT_MINUTES` (default: 5 minutes).
- The server rejects early attempts with `409 NO_SHOW_TOO_EARLY` and reports
  remaining seconds.
- The passenger receives a localized notification immediately after the no-show
  Trip status is committed.

## Arrival and wait rule

Arrival is stored once on the embedded Ride passenger as `arrivedAt` by a
conditional update requiring the passenger to still be `waiting` and the Ride
to be `active`. Subsequent arrival confirmations do not reset the timestamp.
The driver interface shows a countdown and disables no-show confirmation until
the full configured wait has elapsed. The server enforces the same rule for
both station confirmation and the direct no-show action.

Set `NO_SHOW_MIN_WAIT_MINUTES` to a positive integer to override the five-minute
default. Invalid values prevent the server module from starting rather than
silently changing the policy.

## Passenger review request

The passenger's Trip detail shows **Marked as not present** and explains how to
request review. For paid no-show Trips, the passenger can submit a review
request through the existing `RefundRequest` flow. The request is submitted for
the full Trip price and remains pending for an admin to approve or reject. This
does not automatically refund the payment or change the Trip status. The
existing admin refund-request page and approval/rejection endpoints handle the
review. Repeat submissions are prevented per Trip.

## Driver earnings decision

No-show Trips are not settled automatically. `settleTripEarning` accepts only
Trips whose status is `completed` and which have an assigned driver. The
reconciliation query also requires `paymentStatus: "paid"`, but the settlement
function itself does not verify that payment was captured. A `no_show` Trip
therefore does not meet the safe-settlement conditions, so it remains without a
driver earning. No wallet credit, ledger entry, or debt repayment is attempted
for it.

Evidence: [`src/lib/services/tripEarnings.ts`](../src/lib/services/tripEarnings.ts)
checks `completed` in `settleTripEarning` and filters paid Trips only in the
reconciliation query.

## Admin ride cancellation

Plain admin ride cancellation restores only not-yet-picked-up Trips to
`submitted`. Trips already boarding, on board, picked up, dropped off, completed,
or `no_show` keep their Trip status and remain linked to the cancelled Ride.
The endpoint returns the preserved Trip IDs and existing passenger
notifications continue for the affected rides. Driver cancellation of a
confirmed Ride continues to reset its passengers as before.

## Release

Before deployment, run `node scripts/ensureIndexes.mjs --check` to verify the
notification deduplication index, then run `node scripts/ensureIndexes.mjs` to
apply any missing managed indexes.
