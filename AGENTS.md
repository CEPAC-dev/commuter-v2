# Project: Commuter — Uber-style ride booking (Cairo, Egypt)

Stack: Next.js 16.2.9 (App Router) + React 19 + Tailwind v4 + TypeScript.
CRITICAL: This Next.js has breaking changes — follow AGENTS.md and consult the bundled
Next docs BEFORE using any Next API (routing, cookies, middleware, server actions, params).

## Hard rules (conserve my credits — top priority)

- Work ONLY on the phase I name. Never build ahead or refactor unrelated files.
- REUSE existing files in src/components, src/lib, src/types, src/models. Do not rewrite working code.
- Do not run the dev server or re-read files you've already seen. Minimize tool calls.
- Short confirmations only — no essays, no new markdown docs unless I ask.
- Ask me ONLY when a decision blocks you; otherwise follow the constants below.

## Product flow

"/" landing: Header + Hero (Pickup, Dropoff + "See prices" + "Log in to see your recent
activity") + How-it-works + Vehicle types & pricing + CTA + Footer. No visible map on landing.
On submit: store pickup+dropoff in a Zustand store (persisted to sessionStorage), go to /create.
"/create": SERVER-side check of the httpOnly auth cookie → if missing/invalid redirect to
/login. Layout = form LEFT, Google map RIGHT (like m.uber.com/go/home).

## /create form — one trip ("cycle")

1. Pickup + Dropoff — autofilled from the Zustand store if present, else empty placeholders.
2. Vehicle type (select) — from VEHICLES.
3. Arrival time (HH:MM, MANDATORY for EVERY vehicle).
4. Pickup time — ONE READ-ONLY field, computed via computePickupTime():
   pickup_time = arrival − duration − buffer
   duration_minutes comes from fetchRoute() in src/lib/openrouteservice.ts after both
   pickup & dropoff are set.
5. Date — pick ONE day from the next 7 days only (today .. today+6).
   A day can hold MANY trips → "Add another trip" appends another cycle for the same date.
   Then "Preview" popup lists every trip → "Submit" → POST /api/trips → proceed to PAYMENT.

## Constants (already created — import, don't redefine)

- src/lib/config/vehicles.ts → VEHICLES, VEHICLE_LIST, priceFor()
- src/lib/time/pickupWindow.ts → computePickupTime(), toMinutes/toHHMM
  Vehicle rates & timing (buffer minutes; window now unused):
  private_car 15 private buffer 20 | taxi_private 12 private buffer 20
  taxi_shared 9 shared buffer 30 | van_shared 7 shared buffer 45 | microbus_shared 5 shared buffer 45
  Price per trip = round(distance_km \* rate). Booking amount = sum of trip prices.
  Times "HH:MM" 24h internally, render 12h. Dates "YYYY-MM-DD".

## State

src/lib/store/useTripStore.ts — Zustand: { pickup, dropoff } persisted to sessionStorage.

## Auth (httpOnly cookie + JWT)

JWT via `jose` in an httpOnly, Secure, SameSite=Lax cookie. Passwords via bcryptjs.
APIs: /api/auth/register, /api/auth/login, /api/auth/logout. Helper src/lib/auth/session.ts
→ getSession() usable in server components. Protect /create, /profile, /my-requests on the server.

## Database (Mongoose — models already defined)

src/lib/db/mongoose.ts — cached connection. src/models/User.ts, src/models/Booking.ts
(Booking = one date with trips[]; has amountEgp + paymentStatus + kashier fields).
SECURITY: in POST /api/trips recompute rideType, pickupTime, priceEgp and amountEgp on the
server from distanceKm + vehicleType + arrivalTime. Never trust client prices/times/amount.

## Map / autocomplete (Google Maps)

Use committed src/lib/googleMapsStyle.ts (MAP_STYLE) + src/lib/nominatim.ts. Proxy routes read
server-only GOOGLE_MAPS_API_KEY (never expose):
/api/places/autocomplete?q= /api/places/details?id= /api/geocode/reverse?lat=&lng=
/api/directions?origin=&dest=&waypoints=
Map render uses NEXT_PUBLIC_GOOGLE_MAPS_API_KEY via @react-google-maps/api + MAP_STYLE.

## Payment (Kashier — Payment Sessions API)

On Submit: create Booking (status pending_payment, paymentStatus pending, amountEgp = server sum).
Then SERVER-side POST a payment session:
TEST https://test-api.kashier.io/v3/payment/sessions | LIVE https://api.kashier.io/v3/payment/sessions
headers: Authorization: KASHIER_SECRET_KEY, api-key: KASHIER_API_KEY, Content-Type: application/json
body: { amount: String(amountEgp), currency:"EGP", orderId: booking.\_id, merchantId: KASHIER_MERCHANT_ID,
mode: KASHIER_MODE, paymentType:"credit", type:"one-time", maxFailureAttempts:3,
expireAt: <ISO ~30min>, display:"en", allowedMethods:"card,wallet",
merchantRedirect: urlencode(<APP_URL>/checkout/callback),
serverWebhook: <APP_URL>/api/payments/webhook }
Response → sessionUrl → redirect the user (or iframe) to pay.
/api/payments/webhook: unauthenticated POST; VALIDATE the Kashier signature; on success set
booking.paymentStatus="paid", paidAt, status="submitted". The webhook is the ONLY thing that
fulfills — /checkout/callback just shows a "processing/paid" status to the user.
Recompute amount server-side; never trust client or query-string amounts.

## Landing "/" structure

Header (logo + nav + Login) → Hero (headline + two-field form + "See prices" + "Log in to see
your recent activity") → How-it-works (3–4 steps) → Vehicle types & pricing (VEHICLE_LIST cards)
→ CTA band → Footer. Animate with `motion`: hero fade/slide on mount; sections reveal on scroll
(whileInView, once:true); ≤300ms, subtle; respect prefers-reduced-motion. Brand tokens only
(primary #0B1E3D, secondary #00C2A8, accent #F5A623; globals.css + MAP_COLORS.md).

## Pages

/login — email + password; on success set cookie, redirect to /create (or stored intent).
/checkout/callback — post-payment landing; reads booking, shows paid/processing/failed state.
/profile — server: getSession(); name/email/phone + minimal edit (PATCH /api/auth/me).
/my-requests — server: user's Bookings newest-first, grouped by date; show vehicle, pickup→dropoff,
pickup time, price, paymentStatus + status pill. Reuse StatusPill + EmptyState.
All protected pages redirect to /login when no session.

## Dependencies (ALREADY installed — do NOT reinstall)

zustand mongoose jose bcryptjs @react-google-maps/api motion lucide-react date-fns
(+ dev @types/bcryptjs @types/google.maps). Kashier = plain REST, no package.
i18n DEFERRED: if a reused component imports next-intl, swap to plain English strings.

## Env (.env.local)

MONGODB_URI, JWT_SECRET, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, NEXT_PUBLIC_ORS_API_KEY,
GOOGLE_MAPS_API_KEY (server), APP_URL,
KASHIER_SECRET_KEY, KASHIER_API_KEY, KASHIER_MERCHANT_ID, KASHIER_MODE=test.

## Build phases (one at a time; I'll say which)

0 Setup: mongoose.ts + places/geocode/directions routes (constants & models exist — verify).
1 Landing. 2 Auth. 3 Create form (single pickup time). 4 Map.
5 Preview + Submit (POST /api/trips → Booking pending_payment, server totals).
6 Payment (Kashier session create + redirect + /api/payments/webhook + /checkout/callback).
7 Profile + My-requests.

## START

Wait for me to name a phase. Do that phase only, then STOP.

# Commuter — modifications round 2 (build on existing phases 0-7)

Stack same: Next.js 16.2.9, React 19, Tailwind v4, TS. Mongoose, jose, bcryptjs,
Google Maps, Kashier REST, motion, lucide, date-fns. Brand: primary #0B1E3D,
secondary #00C2A8, accent #F5A623. REUSE existing code. One phase only when named.

## Domain model (no change)

Booking = ONE date + trips[] + amountEgp + paymentStatus(pending|paid|failed|refunded)

- status(pending_payment→submitted→...). "Request" = a Booking. "Trip" = one trips[] item.

## What changes

1. /my-requests stays = bookings list (per date, w/ status pills). ADD "Continue to
   checkout" button on any booking with paymentStatus pending/failed → calls
   /api/payments/session → redirect kashier sessionUrl. Reuse Phase-6 endpoint.
2. NEW /my-trips = flat history: every trip from every booking, newest-first,
   pickup→dropoff, vehicle, pickup/arrival time, price, date, parent paymentStatus.
   Read-only logs. Reuse StatusPill + EmptyState.
3. Fix Kashier: APP_URL must be absolute valid URL (http://localhost:3000 dev).
   merchantRedirect + serverWebhook built from APP_URL. Guard: 500 if APP_URL unset.
   Webhook unreachable on localhost — callback page reads booking from DB to show state.

## Constraints

Server recompute amount always. Auth-guard /my-requests /my-trips /profile server-side.
Short confirmations. No new docs. Brand tokens only.
