# Option C rollout runbook

## Pre-flight

- Confirm MongoDB is running as a replica set; Request settlement and group
  cancellation require transactions.
- Confirm the Request-expiry endpoint is scheduled in production and that its
  schedule is healthy.
- Run `node scripts/audit-request-groups.mjs`; review and resolve all reported
  rows before enabling multi-day creation.
- Verify the five payment scenarios in staging/Kashier sandbox:
  1. Wallet-only Request payment settles the group.
  2. Kashier sandbox card payment settles the group.
  3. Replaying the same successful webhook does not settle or notify twice.
  4. The first partial refund on a card payment succeeds and is recorded.
  5. A second sequential partial refund on that same card payment succeeds and
     cumulative amounts remain correct.
- Confirm admins can see payment exceptions in Admin > Transactions and the
  admin alert feed.

## Rollout

1. Keep `MULTI_DAY_REQUESTS_ENABLED=false` by default.
2. Enable group creation for a small internal allowlist first. Verify group
   creation, payment, cancellation and expiry behavior before expanding.
3. Enable for everyone only after the internal stage is clean.
4. Watch the `[multiday]` logs and admin payment alerts. Re-run the audit script
   during rollout and investigate any new mismatches or orphaned records.

## Rollback

Set `MULTI_DAY_REQUESTS_ENABLED=false`. This disables creation of new Request
groups; it does not delete or disable existing groups. Existing Requests remain
payable and cancellable through their existing flows. Let in-flight groups
complete payment or cancellation, and use the admin transaction tools for
payment exceptions. Do not delete Request or child Trip records.

## Manual review cases

Request payment exceptions produce the admin alert type
`late_gateway_payment`. Find the alert in the admin alert feed, or open
Admin > Transactions and select the Payment. The Payment timeline records the
case and the linked Request; the alert includes paid amount, expected amount,
and reason.

| Case | Payment timeline event | Admin action |
|---|---|---|
| Late payment for a cancelled Request | `request_payment_manual_review` (`request_cancelled`) | Open the Payment from the alert or Admin > Transactions. Refund the captured payment through the admin refund flow. |
| Late payment for an expired Request | `request_payment_manual_review` (`request_expired`) | Open the Payment from the alert or Admin > Transactions. Refund the captured payment through the admin refund flow. |
| Late payment when the Request is already paid | `request_payment_manual_review` (`request_already_paid`) | Open the Payment from the alert or Admin > Transactions. Refund this late Payment through the admin refund flow; do not change the already-paid Request. |
| Payment exceeds the remaining child-trip total | `request_payment_amount_mismatch` (`amount_mismatch`) | Compare paid and expected amounts in the alert/timeline. For an overpayment, refund the difference to the passenger through the admin refund flow. If paid is below expected, leave for manual review; do not assume an amount to collect. |
| Kashier captured the card portion after its wallet reservation was released | `request_payment_manual_review` (`wallet_reservation_released`) | Refund the captured card portion through the admin refund flow. Do not debit/collect the released wallet portion. |

The admin alert type for these cases is `late_gateway_payment`, even when the
timeline event is `request_payment_amount_mismatch`. The notification is
deduped per Payment ID.

## Known limitations

- Trip numbers can have gaps after failed group-creation transactions.
- Promo usage and pending-trip limits are counted per child Trip.
- Cancellation is blocked while a Payment is active; the passenger may need to
  retry after its session expires.
- Late captured payments with a released wallet reservation require manual
  refund; they are not automatically settled or refunded.
