# Option C rollout runbook

## Pre-flight checklist

- [ ] Confirm MongoDB is running as a replica set; Request settlement and
  group cancellation require transactions.
- [ ] Confirm a production scheduler calls `POST /api/trips/expire` with
  `CRON_SECRET`. This repository defines the endpoint but no recurring
  scheduler; confirm the external deployment configuration and schedule.
- [ ] Confirm whether commit `c11c0b4` (`support multi-date standalone trips`)
  is deployed. With it deployed, flag-off multi-date submissions create
  standalone Trip batches. Without it, do not assume that same flag-off
  behavior exists in production.
- [ ] Confirm the target environment uses the intended `MONGODB_URI` and
  `MULTI_DAY_REQUESTS_ENABLED` value.
- [ ] Run the audit script and explain every non-zero report before enabling
  group creation (report-specific actions are below).
- [ ] Verify the five Request payment scenarios in staging/Kashier sandbox:
  - [ ] Wallet-only Request payment settles the group.
  - [ ] Kashier sandbox card payment settles the group.
  - [ ] Replaying the same successful webhook does not settle or notify twice.
  - [ ] The first partial refund on a card payment succeeds and is recorded.
  - [ ] A second sequential partial refund on that same card payment succeeds
    and cumulative amounts remain correct. Partial card refund support is
    unconfirmed until this test passes.
- [ ] Confirm admins can find payment exceptions in Admin > Transactions and
  the admin alert feed.

## Audit script

The script is read-only and prints only report counts and record IDs. It exits
with code 0 when all seven counts are zero, code 1 when any report is non-zero,
and a non-zero Node.js error exit if it cannot connect or lacks configuration.

Run locally from the repository root in PowerShell. `@next/env` loads the local
`.env.local` file:

```powershell
node scripts/audit-request-groups.mjs
```

Run against staging from a secure shell where the approved secret manager has
injected `MONGODB_URI` into the process environment. Do not paste credentials
into shell commands or the repository:

```powershell
node scripts/audit-request-groups.mjs
```

| Report | Non-zero result | Operator action |
|---|---|---|
| 1. Unpaid, non-cancelled Request amount differs from remaining child total | The Request aggregate may not match what checkout should collect. | Hold rollout. Compare the Request and remaining child records in Admin > Transactions; reconcile through the supported payment/request workflow before retrying checkout. Do not edit the database directly. |
| 2. Non-cancelled Request has no remaining non-cancelled children | Parent lifecycle and child lifecycle disagree. | Hold rollout. Inspect the Request and payment history; resolve with an approved repair/reconciliation before any checkout or cancellation retry. |
| 3. Child Trip references a missing Request | The child cannot be treated as a valid group member. | Hold rollout. Inspect the Trip and transaction history; identify the correct parent or confirm it is standalone before an approved data repair. Do not infer a parent from dates or user data alone. |
| 4. Cancelled Request still has non-cancelled children | Children may remain visible/bookable under a terminal parent. | Hold rollout. Review the Request and all children; reconcile each child to the cancelled parent through an approved repair, then rerun the audit. |
| 5. Cancelled child has `paymentStatus: paid` | A cancelled day has a captured/settled payment state. | Hold rollout. Open the Payment in Admin > Transactions, determine whether funds were captured, and use the admin refund/reconciliation flow. Do not settle or reactivate the child automatically. |
| 6. Request has an active-status Payment older than 35 minutes | An abandoned Payment may retain a wallet reservation or block cancellation/retry. | Open the Request Payment in Admin > Transactions and use the existing payment verification/failure handling to close it and release any wallet reservation; confirm the Payment is no longer active, then rerun the audit. |
| 7. Payment has a `request_payment_manual_review` timeline event | A captured or unmatched Request payment needs a human decision. | Open the admin alert and Admin > Transactions; follow the matching case under Manual review cases. Confirm the timeline and alert are resolved before rollout. |

The script does not repair any row. If a supported admin action cannot resolve a
report, keep the rollout disabled and obtain an approved repair plan.

## Rollout stages

1. **Internal allowlist:** set `MULTI_DAY_REQUESTS_ENABLED=true` and set
   `MULTI_DAY_REQUESTS_ALLOWED_USER_IDS` to comma-separated internal user IDs.
   Verify group creation, payment, cancellation and expiry for those accounts.
2. **Everyone:** keep the global flag true and unset the allowlist or set it to
   an empty/whitespace-only value. Continue monitoring before and after
   expansion.

Flag off always disables Request-group creation. When `c11c0b4` is deployed,
multi-date submissions then use the standalone Trip-batch path; each Trip
remains a separate booking/payment. The server applies the allowlist decision;
the create UI only reflects it.

For one local user, add these values to `.env.local` (replace the example with
that user's MongoDB ObjectId):

```dotenv
MULTI_DAY_REQUESTS_ENABLED=true
MULTI_DAY_REQUESTS_ALLOWED_USER_IDS=64b000000000000000000001
```

To allow everyone while testing locally, keep the flag true and set the list
empty:

```dotenv
MULTI_DAY_REQUESTS_ENABLED=true
MULTI_DAY_REQUESTS_ALLOWED_USER_IDS=
```

## What to watch

- The structured `[multiday]` events: `group_created`,
  `group_create_rejected`, `day_cancelled`, `request_cancelled`,
  `cancel_blocked`, and `settlement_amount_mismatch`.
- Admin payment alerts and manual-review timeline events.
- Audit reports; rerun after resolving any non-zero row.
- Support tickets about cancellation being blocked during checkout.

`session_blocked` is not currently emitted. Adding it at the payment-session
route would require changing payment-session code, which is outside this
rollout-preparation change; do not treat its absence as evidence that no
sessions were blocked.

The `settlement_amount_mismatch` event is emitted when the payment is already
captured; settlement proceeds for the remaining children. Review the related
Request and Payment rather than retrying settlement.

## Rollback

Set `MULTI_DAY_REQUESTS_ENABLED=false`. This stops new Request-group creation;
it does not delete Requests or disable their existing payment/cancellation
flows. Existing groups remain payable and cancellable for every user.

An in-flight create request that already passed the server's allowlist check
may still finish creating a group; treat this timing case as inferred from the
request flow. Any such group remains payable and cancellable after rollback.
An in-flight payment or cancellation for an existing group is not disabled by
this creation flag. Never delete Requests or child Trips as a rollback action.

## Manual review cases

Request payment exceptions produce the admin alert type
`late_gateway_payment`. Find the alert in the admin alert feed or open
Admin > Transactions and select the Payment. Its timeline records the case and
the linked Request; the alert contains the Request ID, paid amount, expected
amount and reason. The notification is deduped per Payment ID.

| Case | Payment timeline event / reason | Manual action |
|---|---|---|
| Late payment for a cancelled Request | `request_payment_manual_review`; `request_cancelled` | Open the Payment from the alert or Admin > Transactions. Refund the captured payment through the admin refund flow. |
| Late payment for an expired Request | `request_payment_manual_review`; `request_expired` | Open the Payment from the alert or Admin > Transactions. Refund the captured payment through the admin refund flow. |
| Late payment when the Request is already paid | `request_payment_manual_review`; `request_already_paid` | Refund this late Payment through the admin refund flow; do not change the already-paid Request. |
| Late payment on a CLOSED Payment whose total no longer matches the remaining children | `request_payment_manual_review`; `late_payment_amount_mismatch` | No settlement and no automatic refund occur. Refund the full captured Kashier charge through the admin refund flow; then have the passenger pay again at the current amount. |
| Payment exceeds the remaining child-trip total while the Request is otherwise settleable | `request_payment_amount_mismatch`; `amount_mismatch` | Settlement proceeds and the admin alert is created. Refund the overpayment difference to the passenger through the admin refund flow. If paid is below expected, leave for manual review; do not assume an amount to collect. |
| Kashier captured the card portion after its wallet reservation was released | `request_payment_manual_review`; `wallet_reservation_released` | Decide between refunding the captured card portion and collecting the wallet portion. The current policy is to refund the captured card portion through the admin refund flow; do not debit or collect the released wallet portion. |

The event name is `request_payment_amount_mismatch` for a settleable mismatch;
the event name is `request_payment_manual_review` for late/unmatched cases.
Both use the `late_gateway_payment` admin alert type. Confirm the `reason` value
in the Payment timeline before taking action.

## Operational notes and known limitations

- A passenger blocked from cancelling by a fresh active Payment can retry after
  it expires; the wait can be up to 35 minutes (30-minute session plus
  5-minute grace).
- Audit exit codes: 0 means all seven report counts are zero; 1 means one or
  more counts are non-zero. Connection/configuration errors also exit
  unsuccessfully.
- Trip-number gaps can occur after failed group-creation transactions.
- Promo reservations and pending-trip limits are counted per child Trip. A
  single-use promo therefore fails on the second child in a multi-day group.
- Cancellation can remain blocked for up to 35 minutes after checkout is
  abandoned while an active Payment is closed and its reservation released.
