# No-show Trips

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
