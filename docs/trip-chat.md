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

## Contact-info filter and strikes

Before a free-text message is stored, it is normalized with Unicode NFKC,
Arabic-Indic digit conversion, zero-width-character removal, tashkeel/tatweel
removal, and lowercasing. The filter blocks:

- runs of seven or more digits, including separators between digits;
- seven consecutive spelled-out digit words in English or Arabic;
- HTTP(S) links, `www` links, domains ending in `.com`, `.net`, `.org`, `.me`,
  `.io`, `.app`, `.co`, or `.eg`, and the explicit `wa.me`, `t.me`, and `bit.ly`
  domains;
- email addresses and `@handles`;
- a messaging-app keyword (WhatsApp/واتس/واتساب, Telegram/تيليجرام, Signal,
  Viber/فايبر, or imo) accompanied by at least four digits.

Normal times, short durations, numbers of four digits or fewer, and plate
fragments containing letters are intended to pass. This filter is not perfect:
a user can split a number across messages or obfuscate contact details. The
filter, user reports, and admin review work together; do not treat filtering as
a guarantee that contact details cannot be shared.

Each blocked free-text attempt counts against that authenticated account and
Trip using the 24-hour `SecurityRateLimit` window. The third blocked attempt
suspends free text for that user on that Trip until the window expires. Blocked
messages are not stored. Presets remain available. The GET response's
`freeTextAllowed` field reflects both the feature flag and the caller's strike
state. `CONTACT_INFO_BLOCKED` returns HTTP 422 before suspension; reaching the
threshold and later free-text attempts return HTTP 403 `FREE_TEXT_SUSPENDED`.
The general POST limit remains 30 messages per user and Trip per five minutes.

## Reports and admin review

Passengers and assigned drivers can submit one open report per Trip, for abuse,
contact sharing, harassment, or another reason. Report submission is limited to
five reports per user per hour. Optional notes are limited to 300 characters.
Duplicate open reports return HTTP 409 `ALREADY_REPORTED`; rate-limited
submissions return HTTP 429 `CHAT_REPORT_RATE_LIMITED`.

Each report preserves a snapshot of the latest 30 messages with sender role,
message kind, preset key, text, and creation time. It intentionally excludes
message and sender IDs. Only admin-guarded report APIs expose this evidence and
the passenger/driver identities. Admins may mark reports reviewed or dismissed
and add a private admin note; admins cannot post into a chat. The admin page is
`/admin/chat-reports`. New-report notifications contain report, Trip, and Ride
IDs only, never chat text.

## Message retention

`CHAT_RETENTION_DAYS` is an optional whole-number environment variable from 1
through 24855; it defaults to 30. The `messages.createdAt` TTL index expires messages after
that many days. Reports and their snapshots are stored separately and are not
removed by the Message TTL index. The application does not create this index in
request handlers.

Check the current database index definitions without changing them:

```sh
node scripts/ensureIndexes.mjs --check
```

Create or update the managed indexes (including the open-report uniqueness
index and message retention TTL index):

```sh
node scripts/ensureIndexes.mjs
```

## Checklist before enabling free text

1. Keep `CHAT_FREE_TEXT_ENABLED=false` in all environments until the contact
   filter and strike tests pass in the deployment build.
2. Run the index check and ensure the `chat_reports` unique index and Message
   TTL index are ready; run the index command if they are missing or mismatched.
3. Confirm `/admin/chat-reports` is reachable only to admins and assign staff to
   review reports promptly.
4. Verify chat text is not written to application logs and is rendered as plain
   text in passenger, driver, and admin views.
5. Enable `CHAT_FREE_TEXT_ENABLED=true` only after the above checks and monitor
   reports and rate-limit responses.

## Rate limits

- POST: 30 messages per authenticated user and Trip per five-minute window.
- GET: 600 reads per authenticated user per five-minute window.
- Rate-limit responses use HTTP 429 and `CHAT_RATE_LIMITED`.
- Report POST: five reports per authenticated user per hour.

`CHAT_GRACE_MINUTES` is currently a code constant set to 30 in
`src/lib/tripChatAccess.ts`.
