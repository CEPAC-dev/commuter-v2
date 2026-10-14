# Trip chat

Messages are stored per Trip. A passenger may read and write only their own
Trip's thread. The assigned driver may read and write only when that Trip is in
the driver's Ride manifest and the manifest entry is not cancelled or a
no-show. Administrators may read messages but cannot send them. The API derives
the sender role from the authenticated session; client-supplied identity fields
are not used.

Chat is available while the Ride is confirmed or active and for 30 minutes
after completion. Cancelled Trips and Rides, unassigned Rides, and completed
Rides without a recorded completion time are closed to participants. The
completion time is written atomically with the Ride's completed status.
Administrators retain read access after closure.

## Message types

Preset messages are role-specific and validated against the server allowlist.
Only the preset key is persisted; clients translate the approved key to a
localized label. Existing messages with no `kind` are treated as text.

Free-text messages are off by default and limited to 500 characters when
enabled. Configure `CHAT_FREE_TEXT_ENABLED=true` to enable them. Do not use a
public environment variable for this setting.

## Rate limits

- POST: 30 messages per authenticated user and Trip per five-minute window.
- GET: 600 reads per authenticated user per five-minute window.
- Rate-limit responses use HTTP 429 and `CHAT_RATE_LIMITED`.

`CHAT_GRACE_MINUTES` is currently a code constant set to 30 in
`src/lib/tripChatAccess.ts`.
