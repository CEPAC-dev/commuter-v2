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
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { listUserTrips, listDriverTrips } from "@/lib/services/trips";
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

function to12h(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function truncate(s: string, max = 38): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function prettyDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-EG", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const STATUS_PILL: Record<
  BookingStatus,
  { label: string; bg: string; color: string }
> = {
  pending_payment: {
    label: "Pending payment",
    bg: "#FFF3E0",
    color: "#E65100",
  },
  submitted: { label: "Upcoming", bg: "#E2E8F0", color: "#5A6A7A" },
  matched: { label: "Ongoing", bg: "#00C2A8", color: "#fff" },
  confirmed: { label: "Upcoming", bg: "#E2E8F0", color: "#5A6A7A" },
  active: { label: "Ongoing", bg: "#00C2A8", color: "#fff" },
  completed: { label: "Previous", bg: "#0B1E3D", color: "#fff" },
  cancelled: { label: "Previous", bg: "#0B1E3D", color: "#fff" },
  time_out: { label: "Previous", bg: "#0B1E3D", color: "#fff" },
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

function rideStatusPill(status: RideListRow["status"]) {
  if (status === "completed" || status === "cancelled") {
    return STATUS_PILL[status === "completed" ? "completed" : "cancelled"];
  }
  return STATUS_PILL.matched;
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

  const listOptions = {
    page,
    pageSize: PAGE_SIZE,
    statusGroup: groupFilter,
    dateFrom,
    dateTo,
  };

  let tripRows: TripListRow[] = [];
  let rideRows: RideListRow[] = [];
  let total = 0;

  if (driverOngoingView) {
    const result = await getRidesByDriver(session.userId, {
      page,
      pageSize: PAGE_SIZE,
      statusGroup: "ongoing",
      dateFrom,
      dateTo,
    });
    if (Array.isArray(result)) {
      rideRows = result;
      total = result.length;
    } else {
      rideRows = result.rows;
      total = result.total;
    }
  } else {
    const result = isDriver
      ? await listDriverTrips(session.userId, listOptions)
      : await listUserTrips(session.userId, listOptions);
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
  const listItems: DayItem[] = driverOngoingView
    ? rideRows.map((ride) => ({ kind: "ride", data: ride }))
    : tripRows.map((trip) => ({ kind: "trip", data: trip }));

  for (const item of listItems) {
    const date = item.data.date;
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.date === date) last.items.push(item);
    else dayGroups.push({ date, items: [item] });
  }

  const hasFilters = Boolean(groupFilter || dateFrom || dateTo);

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
            My trips
          </h1>
          <p style={{ fontSize: 14, color: "#5A6A7A", margin: 0 }}>
            {total === 0
              ? hasFilters
                ? "No trips match these filters."
                : isDriver
                  ? "No assigned trips yet."
                  : "No trips yet."
              : isDriver
                ? driverOngoingView
                  ? `${total} ongoing ride${total === 1 ? "" : "s"}`
                  : `${total} assigned trip${total === 1 ? "" : "s"}`
                : `${total} trip${total === 1 ? "" : "s"} in your history`}
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
          <StatusGroupFilter hiddenGroups={isDriver ? ["upcoming"] : []} />
        </div>

        {listItems.length === 0 ? (
          <EmptyState
            icon={isDriver ? "🚗" : "🧾"}
            title={
              hasFilters
                ? "Nothing here"
                : isDriver
                  ? driverOngoingView
                    ? "No ongoing rides yet"
                    : "No assigned trips yet"
                  : "No trips yet"
            }
            description={
              hasFilters
                ? "Try clearing the filters to see your full history."
                : isDriver
                  ? driverOngoingView
                    ? "Matched rides with your assigned passengers will show here."
                    : "Once a trip is assigned to you, it will show up here."
                  : "Every trip from your requests will be logged here."
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
                  Book a ride
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
                    {group.date === todayStr ? "Today" : prettyDate(group.date)}
                  </span>
                  <span
                    style={{ fontSize: 12, color: "#9aa7b4", fontWeight: 600 }}
                  >
                    · {group.items.length}{" "}
                    {driverOngoingView ? "ride" : "trip"}
                    {group.items.length === 1 ? "" : "s"}
                    {driverOngoingView
                      ? ` · ${group.items.reduce(
                          (sum, item) =>
                            item.kind === "ride"
                              ? sum + item.data.passengerCount
                              : sum,
                          0,
                        )} passengers`
                      : ""}
                  </span>
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {group.items.map((item) => {
                    if (item.kind === "ride") {
                      const ride = item.data;
                      const vLabel =
                        VEHICLES[ride.vehicleType as VehicleKey]?.label ??
                        ride.vehicleType;
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
                                    Ride #{ride.rideNumber} ·{" "}
                                    {ride.passengers.length} trip
                                    {ride.passengers.length === 1 ? "" : "s"} ·{" "}
                                    {new Date(ride.createdAt).toLocaleString(
                                      "en-EG",
                                      {
                                        month: "short",
                                        day: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                      },
                                    )}
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
                                      {ride.rideType}
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
                                    {ride.totalCost} EGP
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
                                  <Pill {...rideStatusPill(ride.status)} />
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
                                    {ride.passengerCount} passenger
                                    {ride.passengerCount === 1 ? "" : "s"}
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
                                      Window{" "}
                                      <strong style={{ color: "#0B1E3D" }}>
                                        {to12h(ride.startTime)} –{" "}
                                        {to12h(ride.endTime)}
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
                                      {ride.route.length} stop
                                      {ride.route.length === 1 ? "" : "s"}
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
                                          Pickup #{passenger.pickupOrder}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: "#E74C3C",
                                          }}
                                        >
                                          Dropoff #{passenger.dropoffOrder}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: 11,
                                            color: "#9aa7b4",
                                            fontWeight: 600,
                                          }}
                                        >
                                          · {passenger.numberOfPassengers}{" "}
                                          pax · {passenger.tripCost} EGP
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
                                            {truncate(passenger.pickupAddress)}
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
                                            {truncate(passenger.dropoffAddress)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {ride.route.length > 0 && (
                                  <div
                                    style={{
                                      paddingTop: 10,
                                      borderTop: "1px solid #f4f6f8",
                                    }}
                                  >
                                    <p
                                      style={{
                                        margin: "0 0 8px",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "#00806E",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                      }}
                                    >
                                      Route order
                                    </p>
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                      }}
                                    >
                                      {ride.route.map((stop, index) => (
                                        <div
                                          key={`${ride.id}-stop-${index}`}
                                          style={{
                                            display: "flex",
                                            alignItems: "flex-start",
                                            gap: 8,
                                          }}
                                        >
                                          <span
                                            style={{
                                              minWidth: 18,
                                              fontSize: 11,
                                              fontWeight: 800,
                                              color: "#9aa7b4",
                                            }}
                                          >
                                            {index + 1}.
                                          </span>
                                          <div style={{ minWidth: 0 }}>
                                            <span
                                              style={{
                                                fontSize: 13,
                                                color: "#0B1E3D",
                                              }}
                                            >
                                              {truncate(stop.address, 46)}
                                            </span>
                                            <span
                                              style={{
                                                display: "block",
                                                fontSize: 11,
                                                color: "#9aa7b4",
                                                marginTop: 2,
                                              }}
                                            >
                                              +{stop.boarding} / -{stop.alighting}
                                              {stop.waitingMinutes
                                                ? ` · ${stop.waitingMinutes} min wait`
                                                : ""}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

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
                              <Pill {...rideStatusPill(ride.status)} />
                            </div>
                          )}
                        </div>
                      );
                    }

                    const trip = item.data;
                    const vLabel =
                      VEHICLES[trip.vehicleType as VehicleKey]?.label ??
                      trip.vehicleType;
                    const timedOut = trip.status === "time_out";
                    const hasAssignedDriver = Boolean(trip.assignedDriver);
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
                            {/* Created at */}
                            <div style={{ marginBottom: 10 }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "#9aa7b4",
                                  fontWeight: 600,
                                }}
                              >
                                Trip #{trip.tripNumber} · Requested{" "}
                                {new Date(trip.createdAt).toLocaleString(
                                  "en-EG",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                            </div>

                            {/* Vehicle (large) + price */}
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
                              </div>
                              <span
                                style={{
                                  fontWeight: 800,
                                  fontSize: 16,
                                  color: "#00C2A8",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {trip.priceEgp} EGP
                              </span>
                            </div>

                            {/* Status pill */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                                marginBottom: 12,
                              }}
                            >
                              <Pill
                                {...(STATUS_PILL[trip.status] ??
                                  STATUS_PILL.pending_payment)}
                              />
                            </div>

                            {/* Driver + car (ongoing only — passenger view) */}
                            {!isDriver && hasAssignedDriver && (
                              <div
                                style={{
                                  marginBottom: 12,
                                  background:
                                    "linear-gradient(135deg, #F6FBFA 0%, #EEFBF8 100%)",
                                  border: "1px solid #D6F5EE",
                                  borderRadius: 14,
                                  overflow: "hidden",
                                }}
                              >
                                {/* Driver row */}
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "12px 14px",
                                  }}
                                >
                                  {trip.assignedDriver?.profilePic ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={trip.assignedDriver.profilePic}
                                      alt={
                                        trip.assignedDriver?.name ?? "Driver"
                                      }
                                      style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                        flexShrink: 0,
                                      }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: "50%",
                                        flexShrink: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: "#0B1E3D",
                                        color: "#fff",
                                        fontWeight: 800,
                                        fontSize: 15,
                                      }}
                                      aria-hidden="true"
                                    >
                                      {(trip.assignedDriver?.name ?? "")
                                        .split(" ")
                                        .filter(Boolean)
                                        .slice(0, 2)
                                        .map((p) => p[0]?.toUpperCase())
                                        .join("")}
                                    </div>
                                  )}
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <p
                                      style={{
                                        margin: 0,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: "#00806E",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                      }}
                                    >
                                      Driver
                                    </p>
                                    <p
                                      style={{
                                        margin: "1px 0 0",
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: "#0B1E3D",
                                      }}
                                    >
                                      {trip.assignedDriver?.name ?? "—"}
                                    </p>
                                  </div>
                                </div>

                                {/* Car + plate row */}
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "10px 14px",
                                    borderTop: "1px solid #D6F5EE",
                                    background: "rgba(255,255,255,0.5)",
                                  }}
                                >
                                  <Car
                                    size={16}
                                    color="#00806E"
                                    style={{ flexShrink: 0 }}
                                    aria-hidden="true"
                                  />
                                  <span
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: "#0B1E3D",
                                    }}
                                  >
                                    {trip.assignedDriver?.carBrand ?? ""}
                                    {trip.assignedDriver?.carBrand &&
                                    trip.assignedDriver?.carModel
                                      ? " "
                                      : ""}
                                    {trip.assignedDriver?.carModel ?? ""}
                                    {trip.assignedDriver?.modelYear
                                      ? ` · ${trip.assignedDriver.modelYear}`
                                      : ""}
                                  </span>
                                  <span
                                    style={{
                                      marginLeft: "auto",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      padding: "4px 10px",
                                      borderRadius: 8,
                                      background: "#fff",
                                      border: "1px solid #CBE9E2",
                                      fontSize: 13,
                                      fontWeight: 800,
                                      color: "#0B1E3D",
                                      letterSpacing: "0.08em",
                                      fontVariantNumeric: "tabular-nums",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {trip.assignedDriver?.plate ?? "—"}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Pickup → Dropoff */}
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                                marginBottom: 12,
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
                                <span
                                  style={{ fontSize: 13, color: "#0B1E3D" }}
                                >
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
                                <span
                                  style={{ fontSize: 13, color: "#0B1E3D" }}
                                >
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
                                marginBottom: 10,
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
                                <span
                                  style={{ fontSize: 12, color: "#5A6A7A" }}
                                >
                                  Arrive{" "}
                                  <strong style={{ color: "#0B1E3D" }}>
                                    {to12h(trip.arrivalTime)}
                                  </strong>
                                </span>
                              </div>
                            </div>

                            {/* Meta: distance + duration */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                                paddingTop: 10,
                                borderTop: "1px solid #f4f6f8",
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  fontSize: 12,
                                  color: "#9aa7b4",
                                }}
                              >
                                <Route size={12} aria-hidden="true" />
                                {trip.distanceKm?.toFixed(1)} km ·{" "}
                                {trip.durationMinutes} min
                              </span>
                              <ChevronRight
                                size={16}
                                color="#9aa7b4"
                                aria-hidden="true"
                              />
                            </div>
                          </div>
                        </Link>
                        {!isDriver && needsPayment && (
                          <div style={{ padding: "0 18px 16px" }}>
                            <ContinueCheckoutButton
                              bookingId={trip.requestId}
                              amountEgp={trip.bookingAmountEgp}
                              walletBalance={walletBalance}
                            />
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
