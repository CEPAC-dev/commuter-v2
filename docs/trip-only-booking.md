# Trip-only booking

- One booking is one standalone Trip; new booking flow does not create Requests.
- The Request model and `requests` collection are legacy. Model creation APIs
  reject new documents and upserts; updates to existing records remain allowed.
- Legacy payment settlement, Kashier webhook/callback, refunds, admin waitlist
  review, expiry, and `/my-requests` redirects remain for existing Requests and
  Request-backed Trips. They must remain until legacy records and in-flight
  links are no longer needed.
- New Trips must be at least 30 minutes apart on the same date. Each arrival
  occupies a 30-minute window centered on its stored arrival slot; a further
  30-minute gap is enforced between windows. Pending, waiting, approved, and
  active ride statuses hold the slot; final statuses release it.
- Pending-payment Requests and standalone Trips expire after two hours if
  unpaid. Approved standalone Trips expire after pickup time. Expiry defers
  standalone Trips with a recent in-flight Payment (30-minute Kashier session
  lifetime), cancels stale Payments, releases wallet reservations, and releases
  promo usage.

When `node scripts/checkLegacyRequests.mjs` reports no live legacy Requests and
no non-final Request-backed Trips, the following compatibility code can be
removed in a later phase:

- Request grouping helpers and legacy grouping branches.
- `src/lib/services/requests.ts`'s duplicated Request expiry logic.
- `syncPaidTripsForRequest`.
- `/my-requests` redirect routes.
- The legacy Request branch in the payment webhook.
- The `Payment.bookingId` `ref: "Booking"` declaration.
