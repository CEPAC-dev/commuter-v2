import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, Clock, Car } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import AppHeader from "@/components/layout/AppHeader";
import { expireStaleForUser, listUserRequests } from "@/lib/services/requests";
import { VEHICLES } from "@/lib/config/vehicles";
import EmptyState from "@/components/shared/EmptyState";
import FilterBar, { type FilterDef } from "@/components/shared/FilterBar";
import Pagination from "@/components/shared/Pagination";
import RouteMap from "@/components/shared/RouteMap";
import ContinueCheckoutButton from "@/components/shared/ContinueCheckoutButton";
import { getOrCreateWallet } from "@/lib/wallet/wallet";
import type { VehicleKey } from "@/lib/config/vehicles";
import type { PaymentStatus, BookingStatus } from "@/types/booking";

export const metadata = { title: "My requests — Commuter" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 8;

// ── helpers ──────────────────────────────────────────────────────────────────

function to12h(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function truncate(s: string, max = 34): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

const PAY_PILL: Record<
  PaymentStatus,
  { label: string; bg: string; color: string }
> = {
  pending: { label: "Awaiting payment", bg: "#FFF8E1", color: "#E65100" },
  paid: { label: "Paid", bg: "#E8F5E9", color: "#27AE60" },
  failed: { label: "Payment failed", bg: "#FFEBEE", color: "#E74C3C" },
  refunded: { label: "Refunded", bg: "#EDE7F6", color: "#6A1B9A" },
  expired: { label: "Expired", bg: "#F5F5F5", color: "#9aa7b4" },
};

const STATUS_PILL: Record<
  BookingStatus,
  { label: string; bg: string; color: string }
> = {
  pending_payment: {
    label: "Pending payment",
    bg: "#FFF3E0",
    color: "#E65100",
  },
  submitted: { label: "Submitted", bg: "#E2E8F0", color: "#5A6A7A" },
  matched: { label: "Matched", bg: "#00C2A8", color: "#fff" },
  confirmed: { label: "Confirmed", bg: "#E8F5E9", color: "#27AE60" },
  active: { label: "Active", bg: "#00C2A8", color: "#fff" },
  completed: { label: "Completed", bg: "#0B1E3D", color: "#fff" },
  cancelled: { label: "Cancelled", bg: "#FFEBEE", color: "#E74C3C" },
  time_out: { label: "Timed out", bg: "#F5F5F5", color: "#9aa7b4" },
};

function Pill({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

const PAYMENT_OPTIONS: FilterDef = {
  key: "payment",
  label: "Payment",
  options: [
    { value: "paid", label: "Paid" },
    { value: "pending", label: "Awaiting payment" },
    { value: "failed", label: "Failed" },
    { value: "refunded", label: "Refunded" },
  ],
};

const STATUS_OPTIONS: FilterDef = {
  key: "status",
  label: "Status",
  options: [
    { value: "pending_payment", label: "Pending payment" },
    { value: "submitted", label: "Submitted" },
    { value: "matched", label: "Matched" },
    { value: "confirmed", label: "Confirmed" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ],
};

export default async function MyTripsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/my-requests");
  if (session.role === "admin") redirect("/admin/dashboard");

  const params = await searchParams;
  const payment =
    typeof params.payment === "string" ? params.payment : undefined;
  const statusFilter =
    typeof params.status === "string" ? params.status : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  await expireStaleForUser(session.userId);
  const wallet = await getOrCreateWallet(session.userId);
  const walletBalance: number = wallet.balanceEgp ?? 0;
  const result = await listUserRequests(session.userId, {
    page,
    pageSize: PAGE_SIZE,
    paymentStatus:
      payment && payment in PAY_PILL ? (payment as PaymentStatus) : undefined,
    status:
      statusFilter && statusFilter in STATUS_PILL
        ? (statusFilter as BookingStatus)
        : undefined,
  });
  const { rows: bookings, total } = result;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const hasFilters = Boolean(payment || statusFilter);

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader authed email={session.email} variant="app" backHref="/" />

      <main
        style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px 56px" }}
      >
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#0B1E3D",
              margin: "0 0 4px",
              letterSpacing: "-0.02em",
            }}
          >
            My requests
          </h1>
          <p style={{ fontSize: 14, color: "#5A6A7A", margin: 0 }}>
            {total === 0
              ? hasFilters
                ? "No requests match these filters."
                : "No requests yet."
              : `${total} request${total === 1 ? "" : "s"}`}
          </p>
        </div>

        <FilterBar filters={[PAYMENT_OPTIONS, STATUS_OPTIONS]} />

        {bookings.length === 0 ? (
          <EmptyState
            icon="🚗"
            title={hasFilters ? "Nothing here" : "No trips yet"}
            description={
              hasFilters
                ? "Try clearing the filters to see all your requests."
                : "Book your first commute ride and it will appear here."
            }
            action={
              <Link
                href="/create"
                style={{
                  display: "inline-block",
                  padding: "12px 24px",
                  background: "#0B1E3D",
                  color: "#fff",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                Book a ride
              </Link>
            }
          />
        ) : (
          bookings.map((booking) => {
            const needsPayment =
              booking.paymentStatus === "pending" ||
              booking.paymentStatus === "failed";
            const timedOut = booking.status === "time_out";
            return (
              <div
                key={booking.id}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid #eef0f3",
                  marginBottom: 12,
                  overflow: "hidden",
                  opacity: timedOut ? 0.55 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                <Link
                  href={`/my-requests/${booking.id}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    display: "block",
                  }}
                >
                  <RouteMap
                    pickup={booking.trips[0]?.pickup}
                    dropoff={booking.trips[0]?.dropoff}
                    height={120}
                  />
                  {/* Booking header row */}
                  <div
                    style={{
                      padding: "14px 18px",
                      borderBottom: "1px solid #f4f6f8",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#5A6A7A",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 8,
                      }}
                    >
                      {booking.dates
                        .map((d) =>
                          new Date(`${d}T12:00:00`).toLocaleDateString(
                            "en-EG",
                            {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            },
                          ),
                        )
                        .join(", ")}
                      {booking.dates.length > 1 &&
                        ` (× ${booking.dates.length} days)`}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <Pill
                          {...(PAY_PILL[booking.paymentStatus] ??
                            PAY_PILL.pending)}
                        />
                        <Pill
                          {...(STATUS_PILL[booking.status] ??
                            STATUS_PILL.pending_payment)}
                        />
                      </div>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: 16,
                          color: "#0B1E3D",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {booking.amountEgp} EGP
                      </span>
                    </div>
                  </div>

                  {/* Trip rows */}
                  {booking.trips.map((trip, i) => {
                    const vLabel =
                      VEHICLES[trip.vehicleType as VehicleKey]?.label ??
                      trip.vehicleType;
                    return (
                      <div
                        key={i}
                        style={{
                          padding: "14px 18px",
                          borderBottom:
                            i < booking.trips.length - 1
                              ? "1px solid #f4f6f8"
                              : "none",
                        }}
                      >
                        {/* Vehicle + price */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 10,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Car size={14} color="#00C2A8" aria-hidden="true" />
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#0B1E3D",
                              }}
                            >
                              {vLabel}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#00C2A8",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {trip.priceEgp} EGP
                          </span>
                        </div>

                        {/* Pickup → Dropoff */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 8,
                            }}
                          >
                            <MapPin
                              size={13}
                              color="#00C2A8"
                              style={{ marginTop: 2, flexShrink: 0 }}
                              aria-hidden="true"
                            />
                            <span style={{ fontSize: 13, color: "#0B1E3D" }}>
                              {truncate(trip.pickupAddress)}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 8,
                            }}
                          >
                            <MapPin
                              size={13}
                              color="#E74C3C"
                              style={{ marginTop: 2, flexShrink: 0 }}
                              aria-hidden="true"
                            />
                            <span style={{ fontSize: 13, color: "#0B1E3D" }}>
                              {truncate(trip.dropoffAddress)}
                            </span>
                          </div>
                        </div>

                        {/* Times */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            marginTop: 10,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <Clock
                              size={12}
                              color="#5A6A7A"
                              aria-hidden="true"
                            />
                            <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                              Pickup{" "}
                              <strong style={{ color: "#0B1E3D" }}>
                                {to12h(trip.pickupTime)}
                              </strong>
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <Clock
                              size={12}
                              color="#5A6A7A"
                              aria-hidden="true"
                            />
                            <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                              Arrive{" "}
                              <strong style={{ color: "#0B1E3D" }}>
                                {to12h(trip.arrivalTime)}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </Link>
                {needsPayment && (
                  <ContinueCheckoutButton
                    bookingId={booking.id}
                    amountEgp={booking.amountEgp}
                    walletBalance={walletBalance}
                  />
                )}
              </div>
            );
          })
        )}

        {bookings.length > 0 && (
          <Pagination page={page} totalPages={totalPages} />
        )}
      </main>
    </div>
  );
}
