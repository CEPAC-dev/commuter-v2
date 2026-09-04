import { redirect } from "next/navigation";
import { getServerLocale } from "@/lib/i18n/server";
import Link from "next/link";
import { MapPin, Clock, Car } from "lucide-react";
import { isSharedVehicle } from "@/lib/geo/stations";
import { getSession } from "@/lib/auth/session";
import AppHeader from "@/components/layout/AppHeader";
import { translate, localeDirection } from "@/lib/locale";
import { formatTime } from "@/lib/i18n";
import { expireStaleForUser, listUserRequests } from "@/lib/services/requests";
import { VEHICLES } from "@/lib/config/vehicles";
import EmptyState from "@/components/shared/EmptyState";
import FilterBar, { type FilterDef } from "@/components/shared/FilterBar";
import Pagination from "@/components/shared/Pagination";
import RouteMap from "@/components/shared/RouteMapOsmLoader";
import ContinueCheckoutButton from "@/components/shared/ContinueCheckoutButton";
import { getOrCreateWallet } from "@/lib/wallet/wallet";
import type { VehicleKey } from "@/lib/config/vehicles";
import type { PaymentStatus, BookingStatus } from "@/types/booking";
import type { Locale } from "@/lib/i18n";

export const metadata = { title: "My requests — Commuter" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 8;

// ── helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max = 34): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

const PAY_PILL_KEYS: Record<PaymentStatus, string> = {
  pending: "payments.pending",
  paid: "payments.paid",
  failed: "payments.failed",
  refunded: "payments.refunded",
  expired: "payments.expired",
};

const PAY_PILL_COLORS: Record<PaymentStatus, { bg: string; color: string }> = {
  pending: { bg: "#FFF8E1", color: "#E65100" },
  paid: { bg: "#E8F5E9", color: "#27AE60" },
  failed: { bg: "#FFEBEE", color: "#E74C3C" },
  refunded: { bg: "#EDE7F6", color: "#6A1B9A" },
  expired: { bg: "#F5F5F5", color: "#9aa7b4" },
};

const STATUS_PILL_KEYS: Record<BookingStatus, string> = {
  pending_payment: "status.pending_payment",
  submitted: "filters.status_submitted",
  matched: "filters.status_matched",
  confirmed: "filters.status_confirmed",
  active: "filters.status_active",
  completed: "driver.completed",
  cancelled: "filters.status_cancelled",
  time_out: "status.previous",
};

const STATUS_PILL_COLORS: Record<BookingStatus, { bg: string; color: string }> =
  {
    pending_payment: { bg: "#FFF3E0", color: "#E65100" },
    submitted: { bg: "#E2E8F0", color: "#5A6A7A" },
    matched: { bg: "#00C2A8", color: "#fff" },
    confirmed: { bg: "#E8F5E9", color: "#27AE60" },
    active: { bg: "#00C2A8", color: "#fff" },
    completed: { bg: "#0B1E3D", color: "#fff" },
    cancelled: { bg: "#FFEBEE", color: "#E74C3C" },
    time_out: { bg: "#F5F5F5", color: "#9aa7b4" },
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

function filterOptions(locale: Locale): {
  payment: FilterDef;
  status: FilterDef;
} {
  return {
    payment: {
      key: "payment",
      label: translate(locale, "filters.payment_label"),
      options: [
        { value: "paid", label: translate(locale, "payments.paid") },
        { value: "pending", label: translate(locale, "payments.pending") },
        { value: "failed", label: translate(locale, "filters.status_failed") },
        { value: "refunded", label: translate(locale, "payments.refunded") },
      ],
    },
    status: {
      key: "status",
      label: translate(locale, "my_trips.status_filter_label"),
      options: [
        {
          value: "pending_payment",
          label: translate(locale, "status.pending_payment"),
        },
        {
          value: "submitted",
          label: translate(locale, "filters.status_submitted"),
        },
        {
          value: "matched",
          label: translate(locale, "filters.status_matched"),
        },
        {
          value: "confirmed",
          label: translate(locale, "filters.status_confirmed"),
        },
        { value: "active", label: translate(locale, "filters.status_active") },
        { value: "completed", label: translate(locale, "driver.completed") },
        {
          value: "cancelled",
          label: translate(locale, "filters.status_cancelled"),
        },
      ],
    },
  };
}

export default async function MyTripsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/my-requests");
  if (session.role === "admin") redirect("/admin/dashboard");

  const locale = await getServerLocale();

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
      payment && payment in PAY_PILL_KEYS
        ? (payment as PaymentStatus)
        : undefined,
    status:
      statusFilter && statusFilter in STATUS_PILL_KEYS
        ? (statusFilter as BookingStatus)
        : undefined,
  });
  const { rows: bookings, total } = result;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const hasFilters = Boolean(payment || statusFilter);
  const options = filterOptions(locale);
  const dateLocale = locale === "ar" ? "ar-EG" : "en-EG";

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader authed email={session.email} variant="app" backHref="/" />

      <main
        dir={localeDirection(locale)}
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
            {translate(locale, "my_requests.page_title")}
          </h1>
          <p style={{ fontSize: 14, color: "#5A6A7A", margin: 0 }}>
            {total === 0
              ? hasFilters
                ? translate(locale, "my_requests.no_match_filters")
                : translate(locale, "my_requests.no_requests_yet")
              : translate(locale, "my_requests.count_label", {
                  count: total,
                  plural: total === 1 ? "" : "s",
                })}
          </p>
        </div>

        <FilterBar filters={[options.payment, options.status]} />

        {bookings.length === 0 ? (
          <EmptyState
            icon="🚗"
            title={
              hasFilters
                ? translate(locale, "my_trips.empty_title_filtered")
                : translate(locale, "my_trips.empty")
            }
            description={
              hasFilters
                ? translate(locale, "my_requests.empty_description_filtered")
                : translate(locale, "my_requests.empty_description_first_time")
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
                {translate(locale, "my_trips.book_ride")}
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
                            dateLocale,
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
                          label={translate(
                            locale,
                            PAY_PILL_KEYS[booking.paymentStatus] ??
                              PAY_PILL_KEYS.pending,
                          )}
                          {...(PAY_PILL_COLORS[booking.paymentStatus] ??
                            PAY_PILL_COLORS.pending)}
                        />
                        <Pill
                          label={translate(
                            locale,
                            STATUS_PILL_KEYS[booking.status] ??
                              STATUS_PILL_KEYS.pending_payment,
                          )}
                          {...(STATUS_PILL_COLORS[booking.status] ??
                            STATUS_PILL_COLORS.pending_payment)}
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
                      translate(locale, `vehicles.${trip.vehicleType}`) !==
                      `vehicles.${trip.vehicleType}`
                        ? translate(locale, `vehicles.${trip.vehicleType}`)
                        : (VEHICLES[trip.vehicleType as VehicleKey]?.label ??
                          trip.vehicleType);
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
                              {isSharedVehicle(trip.vehicleType)
                                ? translate(locale, "board_station_by")
                                : translate(locale, "pickup")}{" "}
                              <strong style={{ color: "#0B1E3D" }}>
                                {formatTime(locale, trip.pickupTime)}
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
                              {isSharedVehicle(trip.vehicleType)
                                ? translate(locale, "latest_arrival_time")
                                : translate(locale, "arrive")}{" "}
                              <strong style={{ color: "#0B1E3D" }}>
                                {formatTime(locale, trip.arrivalTime)}
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
