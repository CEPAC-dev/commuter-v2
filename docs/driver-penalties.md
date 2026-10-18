# Driver cancellation penalties and wallet debt

The existing cancellation tiers and time windows are unchanged:

| Cancellation tier | Penalty |
| --- | ---: |
| Before 17:00 | 0% |
| 19:00–21:00 | 25% |
| 21:00–23:00 | 50% |
| 23:00 onward | 110% |
| 17:00–19:00 blocked tier | Cancellation remains blocked |

The penalty is calculated from the Ride price using the current tier. The wallet's
default 200 EGP reserve only limits withdrawals; it does not shield funds from a
penalty. A penalty deducts the wallet balance first. If the balance is
too small, it is set to zero and the remaining penalty is added to `owedEgp`.
Missing wallets are created with a zero balance and the full shortfall as debt.
Penalty recording, Ride cancellation, and Trip reset use one MongoDB transaction.

Only completed driver Trip earnings are applied to debt automatically. Each
earning repays debt first; any remainder is credited to the wallet balance.
Other wallet credits (such as top-ups, refunds, and referral bonuses) are not
treated as driver earnings. While `owedEgp` is greater than zero, withdrawable
funds are zero. Once debt is cleared, the existing reserve and pending withdrawal
rules determine the withdrawable amount.

Admins can use `POST /api/admin/wallets/{driverId}/adjust` with a required note:

- `waive_debt` reduces debt by the lesser of the requested amount and current debt.
- `refund_penalty` reduces debt first, then credits any remainder to the balance.

Both adjustment types are audited. Refunds credited to the wallet are also
recorded in the wallet ledger.

## Rollback

If a deployment needs to be rolled back, retain `owedEgp` values and penalty
audit/ledger entries; do not reset them or run a data migration to remove them.
Pause driver cancellation and earnings settlement while reverting to code that
does not understand debt, because the older cancellation path can reject a
short-balance penalty. Restore a debt-compatible release before resuming those
operations, then verify wallet balances, outstanding debt, and penalty logs
against the ledger.
