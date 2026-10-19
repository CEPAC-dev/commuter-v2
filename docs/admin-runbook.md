# Admin runbook

Use the admin portal only for assigned operational work. Never include
passenger or driver phone numbers, private notes, or identifying details in a
notification.

## Driver problem reports

1. Open **Incidents** at `/admin/incidents` and select an open report.
2. Review the Ride status, route, affected Trips, driver details, and suggested
   penalty. The suggestion reflects the configured cancellation tier at the
   current Cairo time; it is guidance, not an automatic charge.
3. Record a required admin note (maximum 500 characters) that explains the
   decision without including phone numbers or sensitive information.
4. Choose exactly one outcome:
   - **Continue:** clears the open incident and leaves Ride and Trip states
     unchanged.
   - **Cancel without penalty:** cancels an eligible confirmed/active Ride
     without changing the driver's wallet.
   - **Cancel with penalty:** cancels the Ride and applies the entered penalty.
     The amount must be non-negative and no greater than Ride price multiplied
     by the highest configured tier. A shortfall becomes driver debt.
5. Confirm the action. Once resolved, an incident cannot be resolved again.

## Picked-up passengers after an incident cancellation

Already picked-up or finished Trips are preserved when an incident cancellation
occurs; they are not reset to submitted. The resolution response lists their
Trip IDs as follow-up. Review the affected passengers and use
`/admin/refund-requests` to create/review any refund requests through the
existing refund process. Incident cancellation itself does not issue an
automatic refund.

## Chat reports

1. Open `/admin/chat-reports`.
2. Select an open report and inspect its reason and conversation snapshot.
3. Decide whether the report needs action, then mark it reviewed or dismissed
   using the available review controls.
4. Keep follow-up notes in the approved internal workflow; do not copy
   personal data into notifications.

## No-show reviews and driver counts

- Passenger no-show review requests appear in `/admin/refund-requests`. Review
  the request and approve or reject it using the existing refund workflow.
  Approval credits the passenger wallet according to the request; it does not
  automatically reverse driver earnings.
- The driver no-show count is available from the admin-authenticated
  `GET /api/admin/drivers/no-shows` endpoint. It defaults to the last 30 days;
  `?days=<positive integer>` selects another window. The response contains
  driver identifiers and aggregate counts, not passenger personal data. The
  repository currently provides this as an API endpoint; use an approved
  admin API client rather than assuming there is a dedicated portal page.
- A no-show does not automatically settle driver earnings under the current
  policy. Escalate payment-policy questions rather than manually marking the
  Trip completed.

## Wallet debt adjustments

There is no wallet-adjustment UI. An admin may use the authenticated endpoint:

```http
POST /api/admin/wallets/<driverId>/adjust
Content-Type: application/json
```

Request body:

```json
{
  "type": "waive_debt",
  "amountEgp": 100,
  "note": "Approved debt waiver reference"
}
```

`type` must be `waive_debt` or `refund_penalty`; `amountEgp` must be a positive
amount with at most two decimal places; `note` is required and must be 1–500
characters. `waive_debt` reduces owed debt only. `refund_penalty` reduces
outstanding debt first and credits any remainder to the wallet. Verify the
driver ID and obtain the required approval before submitting. The route is
admin-authenticated and records an audit log/ledger entry.

## Passenger cancellation notices

The cancellation notice tells affected passengers: **“Your ride was
cancelled. Our team will follow up with you.”** This promises follow-up, not an
automatic refund or a specific resolution. The response-time target for the
operations team is: **[TEAM: fill in expected response time]**.
