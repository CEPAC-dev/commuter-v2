import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Car,
  MapPin,
  Clock,
  CalendarDays,
  ChevronRight,
  Route,
  Users,
  Phone,
} from "lucide-react";
import { getServerLocale } from "@/lib/i18n/server";
import { translate, formatDate, formatTime, formatEgp, toArabicDigits, formatDistanceKm, formatMinutes } from "@/lib/i18n";
import { isSharedVehicle } from "@/lib/geo/stations";
import { getSession } from "@/lib/auth/session";
import { listUserTrips, listDriverTrips, getUserTrip, type UserTripDetail } from "@/lib/services/trips";
import { getRidesByDriver } from "@/lib/services/rideService";
import { getOrCreateWallet } from "@/lib/wallet/wallet";
import { VEHICLES } from "@/lib/config/vehicles";
import type { VehicleKey } from "@/lib/config/vehicles";
import AppHeader from "@/components/layout/AppHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatusGroupFilter from "@/components/shared/StatusGroupFilter";
import DateRangeCalendar from "@/components/shared/DateRangeCalendar";
import Pagination from "@/components/shared/Pagination";
import type { BookingStatus, RideListRow, TripListRow } from "@/types/booking";
import ContinueCheckoutButton from "@/components/shared/ContinueCheckoutButton";
import RateTripModal from "@/components/trips/RateTripModal";

export const metadata = { title: "My trips — Commuter" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

// ── helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max = 38): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function prettyDate(locale: "en" | "ar", date: string): string {
  const intl = locale === "ar" ? "ar-EG" : "en-EG";
  const out = new Date(`${date}T12:00:00`).toLocaleDateString(intl, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return locale === "ar" ? toArabicDigits(out) : out;
}

function toArabicDigitsIf(locale: "en" | "ar", s: string): string {
  return locale === "ar" ? toArabicDigits(s) : s;
}

function getStatusPill(locale: "en" | "ar") {
  return {
    pending_payment: {
      label: translate(locale, "status.pending_payment"),
      bg: "#FFF3E0",
      color: "#E65100",
    },
    submitted: { label: translate(locale, "status.upcoming"), bg: "#E2E8F0", color: "#5A6A7A" },
    matched: { label: translate(locale, "status.ongoing"), bg: "#00C2A8", color: "#fff" },
    confirmed: { label: translate(locale, "status.upcoming"), bg: "#E2E8F0", color: "#5A6A7A" },
    active: { label: translate(locale, "status.ongoing"), bg: "#00C2A8", color: "#fff" },
    completed: { label: translate(locale, "status.previous"), bg: "#0B1E3D", color: "#fff" },
    cancelled: { label: translate(locale, "status.previous"), bg: "#0B1E3D", color: "#fff" },
    time_out: { label: translate(locale, "status.previous"), bg: "#0B1E3D", color: "#fff" },
  } as Record<BookingStatus, { label: string; bg: string; color: string }>;
}
function descriptionForVehicle(locale: "en" | "ar", vehicleType: string) {
  const key = `vehicles.${vehicleType}`;
  const translated = translate(locale, key);
  if (translated !== key) return translated;
  return VEHICLES[vehicleType as VehicleKey]?.label ?? vehicleType;
}

function rideTypeLabel(locale: "en" | "ar", rideType: string) {
  return translate(locale, `ride_type.${rideType}`);
}

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

function rideStatusPill(status: RideListRow["status"], locale: "en" | "ar") {
  const pills = getStatusPill(locale);
  if (status === "completed" || status === "cancelled") {
    return pills[status === "completed" ? "completed" : "cancelled"];
  }
  return pills.matched;
}

function driverInitials(name?: string | null): string {
  return (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function SharedSummaryCard({
  locale,
  driver,
  totalPersons,
  totalFees,
  pickupPoint,
  departureTime,
  dropoffPoint,
  arrivalTime,
}: {
  locale: "en" | "ar";
  driver?: UserTripDetail["assignedDriver"] | null;
  totalPersons: number;
  totalFees: number;
  pickupPoint: string;
  departureTime: string;
  dropoffPoint: string;
  arrivalTime: string;
}) {
  const carLine = [driver?.carBrand, driver?.carModel].filter(Boolean).join(" ");

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #F6FBFA 0%, #EEFBF8 100%)",
        border: "1px solid #D6F5EE",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {/* Driver identity row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0B1E3D",
            color: "#fff",
            fontWeight: 800,
            fontSize: 16,
          }}
          aria-hidden="true"
        >
          {driverInitials(driver?.name) || <Car size={18} />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 700,
              color: "#00806E",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {translate(locale, "my_trips.driver_heading")}
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 15,
              fontWeight: 800,
              color: "#0B1E3D",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {driver?.name ?? translate(locale, "my_trips.driver_fallback")}
          </p>
          {(carLine || driver?.plate) && (
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 12,
                fontWeight: 600,
                color: "#5A6A7A",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {carLine}
              {carLine && driver?.plate ? " · " : ""}
              {driver?.plate ?? ""}
            </p>
          )}
        </div>
        {driver?.phone && (
          <div
            aria-label={translate(locale, "auth.driver.phone")}
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              border: "1px solid #CBE9E2",
              color: "#00806E",
            }}
          >
            <Phone size={16} aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Route timeline */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #D6F5EE",
          background: "rgba(255,255,255,0.55)",
        }}
      >
        <div style={{ display: "flex", gap: 10 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 4,
            }}
            aria-hidden="true"
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#00C2A8",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                width: 2,
                flex: 1,
                minHeight: 22,
                background: "#D6F5EE",
                margin: "3px 0",
              }}
            />
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 3,
                background: "#E74C3C",
                flexShrink: 0,
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 16 }}>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#0B1E3D",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {pickupPoint}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5A6A7A" }}>
                {departureTime}
              </p>
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#0B1E3D",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {dropoffPoint}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5A6A7A" }}>
                {arrivalTime}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Passengers + fare */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 16px",
          borderTop: "1px solid #D6F5EE",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            color: "#5A6A7A",
          }}
        >
          <Users size={13} aria-hidden="true" />
          {totalPersons} {totalPersons === 1 ? translate(locale, "my_trips.passenger_singular") : translate(locale, "my_trips.passenger_plural")}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#00806E",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatEgp(locale, totalFees)}
        </span>
      </div>
    </div>
  );
}
type DayItem =
  | { kind: "trip"; data: TripListRow }
  | { kind: "ride"; data: RideListRow };

// ── page ─────────────────────────────────────────────────────────────────────

export default async function MyTripsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/my-trips");
  if (session.role === "admin") redirect("/admin/dashboard");

  const isDriver = session.role === "driver";
  const isPassenger = !isDriver;
  const params = await searchParams;
  const groupFilter =
    typeof params.group === "string" &&
    ["upcoming", "ongoing", "previous", "pending_payment"].includes(
      params.group,
    )
      ? (params.group as
          | "upcoming"
          | "ongoing"
          | "previous"
          | "pending_payment")
      : undefined;
  const dateFrom =
    typeof params.dateFrom === "string" ? params.dateFrom : undefined;
  const dateTo = typeof params.dateTo === "string" ? params.dateTo : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  if (isDriver && groupFilter === "upcoming") {
    const qs = new URLSearchParams();
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo) qs.set("dateTo", dateTo);
    redirect(qs.toString() ? `/my-trips?${qs}` : "/my-trips");
  }

  const driverOngoingView = isDriver && groupFilter === "ongoing";
  const passengerOngoingView = isPassenger;

  const passengerListOptions = {
    page,
    pageSize: PAGE_SIZE,
    statusGroup: groupFilter ?? "ongoing",
    dateFrom,
    dateTo,
  };

  const driverListOptions = {
    page,
    pageSize: PAGE_SIZE,
    statusGroup: groupFilter && groupFilter !== "upcoming" ? groupFilter : undefined,
    dateFrom,
    dateTo,
  };

  let tripRows: TripListRow[] = [];
  let rideRows: RideListRow[] = [];
  let total = 0;

  if (isDriver) {
    const result = await getRidesByDriver(session.userId, driverListOptions);
    if (Array.isArray(result)) {
      rideRows = result;
      total = result.length;
    } else {
      rideRows = result.rows;
      total = result.total;
    }
  } else {
    const result = await listUserTrips(session.userId, passengerListOptions);
    tripRows = result.rows;
    total = result.total;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const wallet = isDriver ? null : await getOrCreateWallet(session.userId);
  const walletBalance = wallet?.balanceEgp ?? 0;

  // Today's date in YYYY-MM-DD format for comparison
  const todayStr = new Date().toISOString().split("T")[0];

  // Group consecutive items by day (order already sorted above).
  const dayGroups: { date: string; items: DayItem[] }[] = [];
  const listItems: DayItem[] = isDriver
    ? rideRows.map((ride) => ({ kind: "ride", data: ride }))
    : tripRows.map((trip) => ({ kind: "trip", data: trip }));

  const sharedTripDetailsById = !isDriver
    ? new Map(
        (
          await Promise.all(
            tripRows
              .filter((trip) => isSharedVehicle(trip.vehicleType))
              .map(async (trip) => [trip.id, await getUserTrip(session.userId, trip.id)] as const),
          )
        ).filter(([, tripDetail]) => Boolean(tripDetail)),
      )
    : new Map<string, UserTripDetail>();

  for (const item of listItems) {
    const date = item.data.date;
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.date === date) last.items.push(item);
    else dayGroups.push({ date, items: [item] });
  }

  const hasFilters = Boolean((isDriver ? groupFilter : undefined) || dateFrom || dateTo);
  const hiddenGroups: Array<
    "" | "upcoming" | "ongoing" | "previous" | "pending_payment"
  > = isPassenger
    ? [""]
    : ["upcoming"];

  const locale = await getServerLocale();

  let summaryText = "";
  if (total === 0) {
    if (hasFilters) summaryText = translate(locale, "my_trips.no_trips_filters");
    else summaryText = isDriver ? translate(locale, "my_trips.no_assigned_trips") : translate(locale, "my_trips.no_trips");
  } else {
    if (isDriver) {
      summaryText = driverOngoingView
        ? translate(locale, "my_trips.total_ongoing", { total })
        : translate(locale, "my_trips.total_assigned", { total });
    } else {
      summaryText = translate(locale, "my_trips.total_ongoing", { total });
    }
  }

  if (passengerOngoingView && total === 0 && !hasFilters) {
    summaryText = translate(locale, "my_trips.empty_ongoing");
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader
        authed
        email={session.email}
        role={isDriver ? "driver" : "passenger"}
        variant="app"
        backHref={isDriver ? "/my-trips" : "/"}
      />

      <main
        style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px 56px" }}
      >
        <div style={{ marginBottom: 22 }}>
            <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#0B1E3D",
              margin: "0 0 4px",
              letterSpacing: "-0.02em",
            }}
          >
            {translate(locale, "my_trips.title")}
          </h1>
          <p style={{ fontSize: 14, color: "#5A6A7A", margin: 0 }}>
            {summaryText}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <DateRangeCalendar />
          <StatusGroupFilter hiddenGroups={hiddenGroups} />
        </div>

        {listItems.length === 0 ? (
          <EmptyState
            icon={isDriver ? "🚗" : "🧾"}
            title={
              hasFilters
                ? translate(locale, "my_trips.empty_title_filtered")
                : isDriver
                  ? driverOngoingView
                    ? translate(locale, "my_trips.empty_ongoing")
                    : translate(locale, "my_trips.empty_assigned")
                  : translate(locale, "my_trips.empty_ongoing")
            }
            description={
              hasFilters
                ? translate(locale, "my_trips.empty_description_filtered")
                : isDriver
                  ? driverOngoingView
                    ? translate(locale, "my_trips.empty_description_ongoing")
                    : translate(locale, "my_trips.empty_description_assigned")
                  : translate(locale, "my_trips.empty_description_ongoing")
            }
            action={
              !isDriver ? (
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
              ) : undefined
            }
          />
        ) : (
          <>
            {dayGroups.map((group) => (
              <div key={group.date} style={{ marginBottom: 20 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <CalendarDays size={14} color="#00806E" aria-hidden="true" />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#0B1E3D",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {group.date === todayStr ? translate(locale, "my_trips.today") : prettyDate(locale, group.date)}
                  </span>
                  <span
                    style={{ fontSize: 12, color: "#9aa7b4", fontWeight: 600 }}
                  >
                    · {group.items.length} {group.items.length === 1 ? (isDriver ? translate(locale, "my_trips.ride_singular") : translate(locale, "my_trips.trip_singular")) : (isDriver ? translate(locale, "my_trips.ride_plural") : translate(locale, "my_trips.trip_plural"))}
                    {isDriver ? (
                      ` · ${group.items.reduce((sum, item) => item.kind === "ride" ? sum + item.data.passengerCount : sum, 0)} ${translate(locale, "my_trips.passengers")}`
                    ) : ""}
                  </span>
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {group.items.map((item) => {
                    if (item.kind === "ride") {
                      const ride = item.data;
                      const vLabel = descriptionForVehicle(locale, ride.vehicleType);
                      const detailHref = `/my-trips/${ride.id}`;

                      return (
                        <div
                          key={ride.id}
                          style={{
                            background: "#fff",
                            borderRadius: 14,
                            border: "1px solid #eef0f3",
                            overflow: "hidden",
                          }}
                        >
                          {detailHref ? (
                            <Link
                              href={detailHref}
                              style={{
                                textDecoration: "none",
                                color: "inherit",
                                display: "block",
                              }}
                            >
                              <div style={{ padding: "16px 18px" }}>
                                <div style={{ marginBottom: 10 }}>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: "#9aa7b4",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {translate(locale, "my_trips.ride_number", { rideNumber: ride.rideNumber })} · {ride.passengers.length} {ride.passengers.length === 1 ? translate(locale, "my_trips.trip_singular") : translate(locale, "my_trips.trip_plural")} · {toArabicDigitsIf(locale, new Date(ride.createdAt).toLocaleString(locale === "ar" ? "ar-EG" : "en-EG", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 8,
                                    marginBottom: 8,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <Car
                                      size={20}
                                      color="#00806E"
                                      aria-hidden="true"
                                    />
                                    <span
                                      style={{
                                        fontSize: 18,
                                        fontWeight: 800,
                                        color: "#0B1E3D",
                                        letterSpacing: "-0.01em",
                                      }}
                                    >
                                      {vLabel}
                                    </span>
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        padding: "2px 8px",
                                        borderRadius: 999,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        background:
                                          ride.rideType === "shared"
                                            ? "#E8F8F5"
                                            : "#EEF2FF",
                                        color:
                                          ride.rideType === "shared"
                                            ? "#00806E"
                                            : "#0B1E3D",
                                        textTransform: "capitalize",
                                      }}
                                    >
                                      {rideTypeLabel(locale, ride.rideType)}
                                    </span>
                                  </div>
                                  <span
                                    style={{
                                      fontWeight: 800,
                                      fontSize: 16,
                                      color: "#00C2A8",
                                      fontVariantNumeric: "tabular-nums",
                                    }}
                                  >
                                    {formatEgp(locale, ride.totalCost)}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flexWrap: "wrap",
                                    marginBottom: 12,
                                  }}
                                >
                                  <Pill {...rideStatusPill(ride.status, locale)} />
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      fontSize: 12,
                                      color: "#5A6A7A",
                                      fontWeight: 600,
                                    }}
                                  >
                                    <Users size={12} aria-hidden="true" />
                                    {ride.passengerCount} {ride.passengerCount === 1 ? translate(locale, "my_trips.passenger_singular") : translate(locale, "my_trips.passenger_plural")}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 16,
                                    marginBottom: 12,
                                    flexWrap: "wrap",
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
                                    <span
                                      style={{ fontSize: 12, color: "#5A6A7A" }}
                                    >
                                      {translate(locale, "my_trips.window_label")} {" "}
                                      <strong style={{ color: "#0B1E3D" }}>
                                        {formatTime(locale, ride.startTime)} –{" "}
                                        {formatTime(locale, ride.endTime)}
                                      </strong>
                                    </span>
                                  </div>
                                  {ride.route.length > 0 && (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 5,
                                        fontSize: 12,
                                        color: "#5A6A7A",
                                      }}
                                    >
                                      <Route size={12} aria-hidden="true" />
                                      {ride.route.length} {ride.route.length === 1 ? translate(locale, "my_trips.stop_singular") : translate(locale, "my_trips.stop_plural")}
                                    </span>
                                  )}
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 10,
                                    marginBottom: 12,
                                  }}
                                >
                                  {ride.passengers.map((passenger) => (
                                    <div
                                      key={passenger.tripId}
                                      style={{
                                        padding: "10px 12px",
                                        borderRadius: 10,
                                        background: "#F8FAFB",
                                        border: "1px solid #eef0f3",
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: 8,
                                          marginBottom: 6,
                                          flexWrap: "wrap",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: "#00806E",
                                          }}
                                        >
                                          {translate(locale, "my_trips.pickup_prefix", { n: passenger.pickupOrder })}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: "#E74C3C",
                                          }}
                                        >
                                          {translate(locale, "my_trips.dropoff_prefix", { n: passenger.dropoffOrder })}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: 11,
                                            color: "#9aa7b4",
                                            fontWeight: 600,
                                          }}
                                        >
                                          · {passenger.numberOfPassengers}{" "}
                                          {translate(locale, passenger.numberOfPassengers === 1 ? "my_trips.passenger_singular_short" : "my_trips.passenger_plural_short")} · {formatEgp(locale, passenger.tripCost)}
                                        </span>
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: 4,
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
                                            style={{
                                              marginTop: 2,
                                              flexShrink: 0,
                                            }}
                                            aria-hidden="true"
                                          />
                                          <span
                                            style={{
                                              fontSize: 13,
                                              color: "#0B1E3D",
                                            }}
                                          >
                                            {truncate(
                                              ride.rideType === "shared"
                                                ? (passenger.pickupStation?.name ??
                                                  ride.pickupStation?.name ??
                                                  passenger.pickupAddress)
                                                : passenger.pickupAddress,
                                            )}
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
                                            style={{
                                              marginTop: 2,
                                              flexShrink: 0,
                                            }}
                                            aria-hidden="true"
                                          />
                                          <span
                                            style={{
                                              fontSize: 13,
                                              color: "#0B1E3D",
                                            }}
                                          >
                                            {truncate(
                                              ride.rideType === "shared"
                                                ? (passenger.dropoffStation?.name ??
                                                  ride.dropoffStation?.name ??
                                                  passenger.dropoffAddress)
                                                : passenger.dropoffAddress,
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "flex-end",
                                    paddingTop: 10,
                                  }}
                                >
                                  <ChevronRight
                                    size={16}
                                    color="#9aa7b4"
                                    aria-hidden="true"
                                  />
                                </div>
                              </div>
                            </Link>
                          ) : (
                            <div style={{ padding: "16px 18px" }}>
                              <Pill {...rideStatusPill(ride.status, locale)} />
                            </div>
                          )}
                        </div>
                      );
                    }

                    const trip = item.data;
                    const vLabel = descriptionForVehicle(locale, trip.vehicleType);
                    const timedOut = trip.status === "time_out";
                    const hasAssignedDriver = Boolean(trip.assignedDriver);
                    const sharedDetail = !isDriver ? sharedTripDetailsById.get(trip.id) : null;
                    const showSharedSummary =
                      !isDriver &&
                      isSharedVehicle(trip.vehicleType) &&
                      Boolean(sharedDetail?.rideDetails);
                    const needsPayment =
                      trip.paymentStatus === "pending" ||
                      trip.paymentStatus === "failed";
                    return (
                      <div
                        key={trip.id}
                        style={{
                          background: "#fff",
                          borderRadius: 14,
                          border: "1px solid #eef0f3",
                          overflow: "hidden",
                          opacity: timedOut ? 0.55 : 1,
                        }}
                      >
                        <Link
                          href={`/my-trips/${trip.id}`}
                          style={{
                            textDecoration: "none",
                            color: "inherit",
                            display: "block",
                          }}
                        >
                          <div style={{ padding: "16px 18px" }}>
                            <div style={{ marginBottom: 10 }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "#9aa7b4",
                                  fontWeight: 600,
                                }}
                              >
                                {translate(locale, "my_trips.trip_number", { n: trip.tripNumber })} · {translate(locale, "my_trips.requested_label")} {" "}
                                {toArabicDigitsIf(locale, new Date(trip.createdAt).toLocaleString(locale === "ar" ? "ar-EG" : "en-EG", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                }))}
                              </span>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                                marginBottom: 8,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Car size={20} color="#00806E" aria-hidden="true" />
                                <span style={{ fontSize: 18, fontWeight: 800, color: "#0B1E3D", letterSpacing: "-0.01em" }}>
                                  {vLabel}
                                </span>
                              </div>
                              <span style={{ fontWeight: 800, fontSize: 16, color: "#00C2A8", fontVariantNumeric: "tabular-nums" }}>
                                {formatEgp(locale, trip.priceEgp)}
                              </span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                              <Pill {...(getStatusPill(locale)[trip.status] ?? getStatusPill(locale).pending_payment)} />
                            </div>

                            {showSharedSummary ? (
                              <div style={{ marginBottom: 12 }}>
                                <SharedSummaryCard
                                  locale={locale}
                                  driver={sharedDetail?.assignedDriver ?? trip.assignedDriver}
                                  totalPersons={sharedDetail?.rideDetails?.passengerCount ?? sharedDetail?.numberOfPassengers ?? 1}
                                  totalFees={sharedDetail?.rideDetails?.totalCost ?? trip.bookingAmountEgp}
                                  pickupPoint={sharedDetail?.pickupStation?.name ?? trip.pickupAddress}
                                  departureTime={trip.pickupTime}
                                  dropoffPoint={sharedDetail?.dropoffStation?.name ?? trip.dropoffAddress}
                                  arrivalTime={trip.arrivalTime}
                                />
                              </div>
                            ) : (
                              <>
                                {!isDriver && hasAssignedDriver && (
                                  <div style={{ marginBottom: 12, background: "linear-gradient(135deg, #F6FBFA 0%, #EEFBF8 100%)", border: "1px solid #D6F5EE", borderRadius: 14, overflow: "hidden" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
                                      {trip.assignedDriver?.profilePic ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={trip.assignedDriver.profilePic}
                                          alt={trip.assignedDriver?.name ?? translate(locale, "my_trips.driver_fallback")}
                                          style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                                        />
                                      ) : (
                                        <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0B1E3D", color: "#fff", fontWeight: 800, fontSize: 15 }} aria-hidden="true">
                                          {(trip.assignedDriver?.name ?? "").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
                                        </div>
                                      )}
                                      <div style={{ minWidth: 0, flex: 1 }}>
                                        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#00806E", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                          {translate(locale, "my_trips.driver_heading")}
                                        </p>
                                        <p style={{ margin: "1px 0 0", fontSize: 14, fontWeight: 700, color: "#0B1E3D" }}>
                                          {trip.assignedDriver?.name ?? "—"}
                                        </p>
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: "1px solid #D6F5EE", background: "rgba(255,255,255,0.5)" }}>
                                      <Car size={16} color="#00806E" style={{ flexShrink: 0 }} aria-hidden="true" />
                                      <span style={{ fontSize: 13, fontWeight: 600, color: "#0B1E3D" }}>
                                        {trip.assignedDriver?.carBrand ?? ""}
                                        {trip.assignedDriver?.carBrand && trip.assignedDriver?.carModel ? " " : ""}
                                        {trip.assignedDriver?.carModel ?? ""}
                                        {trip.assignedDriver?.modelYear ? ` · ${trip.assignedDriver.modelYear}` : ""}
                                      </span>
                                      <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 8, background: "#fff", border: "1px solid #CBE9E2", fontSize: 13, fontWeight: 800, color: "#0B1E3D", letterSpacing: "0.08em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                                        {trip.assignedDriver?.plate ?? "—"}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                                    <MapPin size={13} color="#00C2A8" style={{ marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
                                    <span style={{ fontSize: 13, color: "#0B1E3D" }}>{truncate(trip.pickupAddress)}</span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                                    <MapPin size={13} color="#E74C3C" style={{ marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
                                    <span style={{ fontSize: 13, color: "#0B1E3D" }}>{truncate(trip.dropoffAddress)}</span>
                                  </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                    <Clock size={12} color="#5A6A7A" aria-hidden="true" />
                                    <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                                      {isSharedVehicle(trip.vehicleType) ? translate(locale, "board_station_by") : translate(locale, "pickup")} <strong style={{ color: "#0B1E3D" }}>{formatTime(locale, trip.pickupTime)}</strong>
                                    </span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                    <Clock size={12} color="#5A6A7A" aria-hidden="true" />
                                    <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                                      {isSharedVehicle(trip.vehicleType) ? translate(locale, "latest_arrival_time") : translate(locale, "arrive")} <strong style={{ color: "#0B1E3D" }}>{formatTime(locale, trip.arrivalTime)}</strong>
                                    </span>
                                  </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 10, borderTop: "1px solid #f4f6f8" }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#9aa7b4" }}>
                                    <Route size={12} aria-hidden="true" />
                                    {formatDistanceKm(locale, trip.distanceKm ?? 0)} · {formatMinutes(locale, trip.durationMinutes ?? 0)}
                                  </span>
                                  <ChevronRight size={16} color="#9aa7b4" aria-hidden="true" />
                                </div>
                              </>
                            )}
                          </div>
                        </Link>
                        {!isDriver && needsPayment && (
                          <div style={{ padding: "0 18px 16px" }}>
                            <ContinueCheckoutButton bookingId={trip.requestId} amountEgp={trip.bookingAmountEgp} walletBalance={walletBalance} />
                          </div>
                        )}
                        {!isDriver && trip.status === "completed" && (
                          <div style={{ padding: "0 18px 16px" }}>
                            <RateTripModal tripId={trip.id} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <Pagination page={page} totalPages={totalPages} />
          </>
        )}
      </main>
    </div>
  );
}
