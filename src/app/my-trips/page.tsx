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
  ShieldCheck,
  ArrowDown,
} from "lucide-react";
import { getServerLocale } from "@/lib/i18n/server";
import { translate, formatDate, formatTime, formatEgp, toArabicDigits, formatDistanceKm, formatMinutes } from "@/lib/i18n";
import { isSharedVehicle } from "@/lib/geo/stations";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { listUserTrips, listDriverTrips, getUserTrip, type UserTripDetail } from "@/lib/services/trips";
import { getRidesByDriver } from "@/lib/services/rideService";
import { getOrCreateWallet } from "@/lib/wallet/wallet";
import { VEHICLES } from "@/lib/config/vehicles";
import type { VehicleKey } from "@/lib/config/vehicles";
import AppHeader from "@/components/layout/AppHeader";
import EmptyState from "@/components/shared/EmptyState";
import { PassengerEmptyIcon, DriverEmptyIcon } from "@/components/icons/EmptyStateIcons";
import StatusGroupFilter from "@/components/shared/StatusGroupFilter";
import TripTabs from "@/components/trips/TripTabs";
import NextTripCard from "@/components/trips/NextTripCard";
import DateRangeCalendar from "@/components/shared/DateRangeCalendar";
import Pagination from "@/components/shared/Pagination";
import type { BookingStatus, RideListRow, TripListRow } from "@/types/booking";
import ContinueCheckoutButton from "@/components/shared/ContinueCheckoutButton";
import RateTripModal from "@/components/trips/RateTripModal";
import MatchedTripCountdown from "@/components/trips/MatchedTripCountdown";
import CancelTripModal from "@/components/trips/CancelTripModal";
import { getDisplayStatus, getRejectionDisplay } from "@/lib/statusDisplay.ts";
import { buildTripTabView, type TripTabKey } from "@/lib/tripTabView.ts";
import { getNextTrip } from "@/lib/nextTrip.ts";

export const metadata = { title: "My trips — Commuter" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

// ── helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max = 38): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const safe = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${safe.trimEnd()}…`;
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
    waiting_list: {
      label: translate(locale, "request_status.waiting_for_approval"),
      bg: "#FFF8E1",
      color: "#8A5A00",
    },
    approved: {
      label: translate(locale, "request_status.approved_pay_now"),
      bg: "#E8F5E9",
      color: "#20834A",
    },
    rejected: {
      label: translate(locale, "request_status.rejected"),
      bg: "#FFEBEE",
      color: "#C0392B",
    },
    submitted: { label: translate(locale, "status.upcoming"), bg: "#E2E8F0", color: "#5A6A7A" },
    matched: { label: translate(locale, "status.ongoing"), bg: "#00C2A8", color: "#fff" },
    confirmed: { label: translate(locale, "status.upcoming"), bg: "#E2E8F0", color: "#5A6A7A" },
    active: { label: translate(locale, "status.ongoing"), bg: "#00C2A8", color: "#fff" },
    completed: { label: translate(locale, "status.completed"), bg: "#0B1E3D", color: "#fff" },
    cancelled: { label: translate(locale, "status.cancelled"), bg: "#0B1E3D", color: "#fff" },
    time_out: { label: translate(locale, "status.expired"), bg: "#0B1E3D", color: "#fff" },
    nomatch: { label: translate(locale, "status.nomatch"), bg: "#FFEBEE", color: "#E74C3C" },
  } satisfies Record<BookingStatus, { label: string; bg: string; color: string }>;
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

function displayPill(locale: "en" | "ar", status: ReturnType<typeof getDisplayStatus>) {
  const tone = {
    neutral: { bg: "#EEF2F2", color: "#5A6A7A" },
    warning: { bg: "#FFF3E0", color: "#E65100" },
    success: { bg: "#E8F5E9", color: "#20834A" },
    danger: { bg: "#FFEBEE", color: "#C0392B" },
    info: { bg: "#E2F8F5", color: "#007A6A" },
  }[status.tone];
  return {
    label: translate(locale, status.key),
    ...tone,
  };
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
  const avatarUrl = driver?.profilePicture ?? driver?.profilePic;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #DDF0EC",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(11,30,61,0.04)",
      }}
    >
      {/* Driver identity row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          background: "linear-gradient(135deg, #F2FAF8 0%, #FFFFFF 100%)",
          borderBottom: "1px solid #E8F5F2",
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={driver?.name ?? translate(locale, "my_trips.driver_fallback")}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
              border: "2px solid #00C2A8",
            }}
          />
        ) : (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #00C2A8 0%, #0B1E3D 100%)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 15,
            }}
            aria-hidden="true"
          >
            {driverInitials(driver?.name) || <Car size={18} />}
          </div>
        )}

        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14.5,
              fontWeight: 800,
              color: "#0B1E3D",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {driver?.name ?? translate(locale, "my_trips.driver_fallback")}
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 3,
              flexWrap: "wrap",
            }}
          >
            {carLine && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#5A6A7A",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {carLine}
              </span>
            )}
            {driver?.plate && (
              <span
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  padding: "1px 7px",
                  borderRadius: 6,
                  background: "#fff",
                  border: "1px solid #CBE9E2",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#0B1E3D",
                  letterSpacing: "0.06em",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {driver.plate}
              </span>
            )}
          </div>
        </div>

        {driver?.phone && (
          <div
            aria-label={translate(locale, "auth.driver.phone")}
            title={driver.phone}
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#00C2A8",
              color: "#0B1E3D",
              boxShadow: "0 2px 6px rgba(0,194,168,0.25)",
              userSelect: "none",
            }}
          >
            <Phone size={15} aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Route timeline */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", gap: 12 }}>
          {/* Vertical indicator line */}
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
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#00C2A8",
                flexShrink: 0,
                boxShadow: "0 0 0 3px #E8F8F5",
              }}
            />
            <span
              style={{
                width: 2,
                flex: 1,
                minHeight: 28,
                background: "repeating-linear-gradient(180deg, #CBE9E2 0 4px, transparent 4px 8px)",
                margin: "4px 0",
              }}
            />
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: "#E74C3C",
                flexShrink: 0,
                boxShadow: "0 0 0 3px #FDECEA",
              }}
            />
          </div>

          {/* Points list */}
          <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 14 }}>
            {/* Pickup */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#00806E",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {translate(locale, "pickup")}
                </span>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "#0B1E3D",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pickupPoint}
                </p>
              </div>
              <span
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  borderRadius: 8,
                  background: "#E8F8F5",
                  color: "#00806E",
                  fontSize: 12,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <Clock size={11} aria-hidden="true" />
                {departureTime}
              </span>
            </div>

            {/* Dropoff */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#E74C3C",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {translate(locale, "dropoff")}
                </span>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "#0B1E3D",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {dropoffPoint}
                </p>
              </div>
              <span
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  borderRadius: 8,
                  background: "#FDECEA",
                  color: "#C0392B",
                  fontSize: 12,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <Clock size={11} aria-hidden="true" />
                {arrivalTime}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Passengers footer */}
      <div
        style={{
          padding: "10px 16px",
          background: "#FAFCFB",
          borderTop: "1px solid #E8F5F2",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: "#5A6A7A",
          }}
        >
          <Users size={13} color="#00806E" aria-hidden="true" />
          {totalPersons} {totalPersons === 1 ? translate(locale, "my_trips.passenger_singular") : translate(locale, "my_trips.passenger_plural")}
        </span>
      </div>
    </div>
  );
}
type DayItem =
  | { kind: "trip"; data: TripListRow }
  | {
      kind: "request_group";
      data: { requestId: string; date: string; trips: TripListRow[] };
    }
  | { kind: "ride"; data: RideListRow };

function RequestTripGroupCard({
  requestId,
  trips,
  walletBalance,
  locale,
  allowPay,
  sharedTripDetailsById,
}: {
  requestId: string;
  trips: TripListRow[];
  walletBalance: number;
  locale: "en" | "ar";
  allowPay: boolean;
  sharedTripDetailsById: Map<string, UserTripDetail | null>;
}) {
  const firstTrip = trips[0];
  const displayStatus = getDisplayStatus({
    request: {
      status: firstTrip.parentRequestStatus ?? firstTrip.status,
      paymentStatus: firstTrip.parentPaymentStatus ?? firstTrip.paymentStatus,
      rejectionReason: firstTrip.rejectionReason,
      hasPastTrip: firstTrip.hasPastTrip,
    },
    trip: firstTrip,
  });
  const rejectionDisplay = getRejectionDisplay({
    request: {
      status: firstTrip.parentRequestStatus ?? firstTrip.status,
      rejectionReason: firstTrip.rejectionReason,
    },
    trip: firstTrip,
  });
  const secondaryText = rejectionDisplay.showReasonCard
    ? rejectionDisplay.reason ?? translate(locale, "rejection.no_reason")
    : displayStatus.secondaryKey
      ? translate(locale, displayStatus.secondaryKey)
      : displayStatus.secondaryText;

  return (
    <div
      className="request-group-card"
      style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #eef0f3",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          padding: "15px 18px",
          borderBottom: "1px solid #f4f6f8",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <strong style={{ color: "#0B1E3D", fontSize: 14 }}>
            {translate(locale, "my_trips.booking_group", {
              count: trips.length,
              plural: trips.length === 1 ? "" : "s",
            })}
          </strong>
          <Pill {...displayPill(locale, displayStatus)} />
        </div>
        <strong style={{ color: "#0B1E3D", fontSize: 16, fontVariantNumeric: "tabular-nums" }}>
          {formatEgp(locale, firstTrip.bookingAmountEgp)}
        </strong>
      </div>

      {secondaryText && (
        <p
          className={displayStatus.secondaryKey === "status.approved_by_admin" ? "trip-approved-caption" : undefined}
          title={rejectionDisplay.showReasonCard ? secondaryText : undefined}
          style={{
            ...(displayStatus.secondaryKey === "status.approved_by_admin"
              ? { margin: "-6px 0 8px", marginInlineStart: 18, padding: 0, fontSize: 11, lineHeight: 1.35, color: "#687978" }
              : {
                  margin: 0,
                  padding: "11px 18px 0",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "#5A6A7A",
                  ...(rejectionDisplay.showReasonCard
                    ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }
                    : {}),
                }),
          }}
        >
          {secondaryText}
        </p>
      )}

      <div style={{ display: "grid", gap: 0 }}>
        {trips.map((trip) => {
          const detail = sharedTripDetailsById.get(trip.id);
          const shared = isSharedVehicle(trip.vehicleType);
          const pickupName = detail?.pickupStation?.name ?? trip.pickupAddress;
          const dropoffName = detail?.dropoffStation?.name ?? trip.dropoffAddress;
          return (
            <Link
              key={trip.id}
              className="trip-card-link"
              href={`/my-trips/${trip.id}`}
              style={{
                display: "grid",
                gap: 8,
                padding: "13px 18px",
                color: "inherit",
                textDecoration: "none",
                borderTop: "1px solid #f4f6f8",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span className="trip-card-date">{formatDate(locale, trip.date)}<span>{formatTime(locale, trip.pickupTime)}</span></span>
                  <span className="trip-type-badge">{translate(locale, shared ? "ride.shared" : "ride.private")}</span>
                  <span style={{ color: "#526262", fontSize: 12, fontWeight: 700 }}>{descriptionForVehicle(locale, trip.vehicleType)}</span>
                </span>
                <span style={{ color: "#006D60", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{formatEgp(locale, trip.priceEgp)}</span>
              </span>
              <span className="trip-card-route-row">
                <MapPin size={13} color="#00C2A8" aria-hidden="true" />
                <span title={pickupName}>{truncate(pickupName)}</span>
              </span>
              <span className="trip-card-route-row">
                <MapPin size={13} color="#D46A32" aria-hidden="true" />
                <span title={dropoffName}>{truncate(dropoffName)}</span>
              </span>
              <span className="trip-card-view-action">
                {translate(locale, "my_trips.view_trip")}
                <ChevronRight size={15} aria-hidden="true" />
              </span>
            </Link>
          );
        })}
      </div>

      {allowPay && displayStatus.canPay && (
        <div style={{ borderTop: "1px solid #f4f6f8" }}>
          <ContinueCheckoutButton
            bookingId={requestId}
            amountEgp={firstTrip.bookingAmountEgp}
            walletBalance={walletBalance}
          />
        </div>
      )}
    </div>
  );
}

function TripsPageHeader({
  locale,
  summaryText,
}: {
  locale: "en" | "ar";
  summaryText: string;
}) {
  return (
    <>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: "#0B1E3D",
          margin: "0 0 var(--space-4)",
          letterSpacing: "-0.02em",
        }}
      >
        {translate(locale, "my_trips.title")}
      </h1>
      <p style={{ fontSize: 14, color: "#5A6A7A", margin: 0 }}>{summaryText}</p>
    </>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function MyTripsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/my-trips");
  if (session.role === "admin") redirect("/admin/dashboard");
  await connectDB();

  const isDriver = session.role === "driver";
  const isPassenger = !isDriver;
  const params = await searchParams;
  const groupFilter =
    typeof params.group === "string" &&
    ["all", "pending", "upcoming", "ongoing", "pending_payment"].includes(
      params.group,
    )
      ? (params.group as
          | "all"
          | "pending"
          | "upcoming"
          | "ongoing"
          | "pending_payment")
      : isPassenger
        ? "all"
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
  const passengerOngoingView = isPassenger && groupFilter === "ongoing";
  const activePassengerTab: TripTabKey =
    groupFilter === "pending" || groupFilter === "pending_payment"
      ? "pending"
      : groupFilter === "upcoming" || groupFilter === "ongoing"
        ? groupFilter
        : "all";

  const passengerListOptions = {
    page: 1,
    pageSize: PAGE_SIZE,
    groupByRequest: true,
    fetchAll: true,
    dateFrom,
    dateTo,
  };

  const passengerHasActiveStatusFilter = Boolean(
    groupFilter &&
      groupFilter !== "all" &&
      groupFilter !== "ongoing" &&
      ["pending", "upcoming", "pending_payment"].includes(groupFilter),
  );

  const driverListOptions = {
    page,
    pageSize: PAGE_SIZE,
    statusGroup:
      groupFilter === "ongoing" || groupFilter === "pending_payment"
        ? groupFilter
        : undefined,
    dateFrom,
    dateTo,
  };

  let tripRows: TripListRow[] = [];
  let allPassengerTrips: TripListRow[] = [];
  let rideRows: RideListRow[] = [];
  let listItems: DayItem[] = [];
  let total = 0;
  let paginationTotal = 0;
  let tabCounts: Record<TripTabKey, number> = {
    all: 0,
    pending: 0,
    upcoming: 0,
    ongoing: 0,
  };
  const displayNow = new Date();
  if (isDriver) {
    const result = await getRidesByDriver(session.userId, driverListOptions);
    if (Array.isArray(result)) {
      rideRows = result;
      total = result.length;
      paginationTotal = result.length;
    } else {
      rideRows = result.rows;
      total = result.total;
      paginationTotal = result.total;
    }
    listItems = rideRows.map((ride) => ({ kind: "ride", data: ride }));
  } else {
    const result = await listUserTrips(session.userId, passengerListOptions);
    allPassengerTrips = result.rows;
    const selectedTab: TripTabKey =
      groupFilter === "pending" || groupFilter === "pending_payment"
        ? "pending"
        : groupFilter === "upcoming" || groupFilter === "ongoing"
          ? groupFilter
          : "all";
    const view = buildTripTabView(result.rows, selectedTab, displayNow);
    tabCounts = view.counts;
    total = view.items.length;
    paginationTotal = total;
    const pageItems = view.items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    tripRows = pageItems.flatMap((item) =>
      item.kind === "request" ? item.trips : [item.trip],
    );
    listItems = pageItems.map((item): DayItem =>
      item.kind === "request"
        ? {
            kind: "request_group",
            data: {
              requestId: item.requestId,
              date: item.date,
              trips: item.trips as TripListRow[],
            },
          }
        : { kind: "trip", data: item.trip as TripListRow },
    );
  }

  const totalPages = Math.ceil(paginationTotal / PAGE_SIZE);

  const wallet = isDriver ? null : await getOrCreateWallet(session.userId);
  const walletBalance = wallet?.balanceEgp ?? 0;

  // Today's date in YYYY-MM-DD format for comparison
  const todayStr = new Date().toISOString().split("T")[0];

  // Group consecutive items by day (order already sorted above).
  const dayGroups: { date: string; items: DayItem[] }[] = [];

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

  const nextTrip = isPassenger ? getNextTrip({ trips: allPassengerTrips, now: displayNow }) : null;
  const nextTripDetail =
    nextTrip && isSharedVehicle(nextTrip.vehicleType)
      ? sharedTripDetailsById.get(nextTrip.id) ?? await getUserTrip(session.userId, nextTrip.id)
      : null;
  const paymentRequestCount = new Set(
    allPassengerTrips
      .filter((trip) =>
        getDisplayStatus({
          request: {
            status: trip.parentRequestStatus ?? trip.status,
            paymentStatus: trip.parentPaymentStatus ?? trip.paymentStatus,
            hasPastTrip: trip.hasPastTrip,
            rejectionReason: trip.rejectionReason,
          },
          trip,
        }).canPay,
      )
      .map((trip) => trip.requestId),
  ).size;
  const approvalRequestCount = new Set(
    allPassengerTrips
      .filter((trip) => trip.parentRequestStatus === "waiting_list")
      .map((trip) => trip.requestId),
  ).size;

  for (const item of listItems) {
    const date = item.data.date;
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.date === date) last.items.push(item);
    else dayGroups.push({ date, items: [item] });
  }

  const hasFilters = Boolean(
    (isDriver ? groupFilter : passengerHasActiveStatusFilter) || dateFrom || dateTo,
  );
  const hiddenGroups: Array<
    "all" | "upcoming" | "ongoing" | "pending_payment"
  > = isPassenger ? [] : ["upcoming", "pending_payment"];

  const locale = await getServerLocale();

  let summaryText = "";
  if (total === 0) {
    if (hasFilters) summaryText = translate(locale, "my_trips.no_trips_filters");
    else summaryText = isDriver ? translate(locale, "my_trips.no_assigned_trips") : translate(locale, "my_trips.no_trips");
  } else {
    if (isDriver) {
      summaryText = driverOngoingView
        ? translate(locale, "my_trips.total_ongoing", { total, plural: total === 1 ? "" : "s" })
        : translate(locale, "my_trips.total_assigned", { total, plural: total === 1 ? "" : "s" });
    } else {
      summaryText = passengerOngoingView
        ? translate(locale, "my_trips.total_ongoing", { total, plural: total === 1 ? "" : "s" })
        : activePassengerTab === "pending"
          ? translate(locale, "my_trips.total_pending_requests", { total })
          : activePassengerTab === "upcoming"
            ? translate(locale, "my_trips.total_upcoming", { total, plural: total === 1 ? "" : "s" })
            : translate(locale, "my_trips.total_active", { total, plural: total === 1 ? "" : "s" });
    }
  }

  if (passengerOngoingView && total === 0 && !hasFilters) {
    summaryText = translate(locale, "my_trips.empty_ongoing");
  }

  const activeGroupLabel =
    !groupFilter || groupFilter === "all"
      ? translate(locale, "filter.all")
      : translate(locale, `status.${groupFilter}`);

  const pendingPaymentCount = !isDriver
    ? paymentRequestCount
    : 0;

  return (
    <div className="my-trips-page" style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader
        authed
        email={session.email}
        role={isDriver ? "driver" : "passenger"}
        variant="app"
        backHref={isDriver ? "/my-trips" : "/"}
      />

      <style>{`
        .my-trips-page {
          --my-trips-tabbar-height: 45px;
          overflow-x: clip;
          overflow-y: visible;
        }
        .empty-state-icon { width: 80px; height: 80px; }
        .my-trips-shell {
          width: 100%;
          max-width: 1200px;
          margin-inline: auto;
          padding-block: var(--space-24) calc(var(--space-48) + env(safe-area-inset-bottom) + 72px);
          padding-inline: var(--space-16);
          overflow: visible;
        }
        .my-trips-heading { margin-bottom: var(--space-20); }
        .my-trips-alerts { display: grid; gap: var(--space-8); margin-block: var(--space-16); }
        .my-trips-alert {
          display: flex;
          align-items: center;
          gap: var(--space-8);
          min-height: 42px;
          padding: 8px 12px;
          border: 1px solid #EAD5AB;
          border-radius: 6px;
          background: #FFF8E9;
          color: #71470D;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
        }
        .my-trips-alert.approval { border-color: #D8E7E3; background: #EFF7F4; color: #16594F; }
        .my-trips-alert:focus-visible, .my-trips-history-link:focus-visible,
        .next-trip-action:focus-visible, .my-trips-book-link:focus-visible {
          outline: 3px solid #F5A623;
          outline-offset: 3px;
        }
        .my-trips-tabbar {
          position: sticky;
          position: -webkit-sticky;
          top: var(--app-header-h);
          z-index: 90;
          box-sizing: border-box;
          isolation: isolate;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 0;
          min-height: var(--my-trips-tabbar-height);
          margin-block: 0 var(--space-24);
          margin-inline: calc(-1 * var(--space-16));
          padding-inline: var(--space-16);
          background: var(--color-surface);
          box-shadow: none;
        }
        .my-trips-tabbar.is-stuck::after {
          content: "";
          position: absolute;
          inset-inline: 0;
          inset-block-end: 0;
          height: 1px;
          background: #DCE6E4;
          pointer-events: none;
        }
        .my-trips-tab-sentinel { display: block; height: 1px; margin-block-end: -1px; }
        .my-trips-tab-scroll {
          width: 100%;
          min-width: 0;
          overflow-x: auto;
          overflow-y: hidden;
          overscroll-behavior-inline: contain;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          mask-image: linear-gradient(to right, transparent, #000 14px, #000 calc(100% - 14px), transparent);
        }
        .my-trips-tab-items { display: flex; width: max-content; min-width: 100%; flex-wrap: nowrap; align-items: stretch; gap: 6px; }
        .my-trips-tab-scroll::-webkit-scrollbar { display: none; }
        .my-trips-history-link-desktop { display: none; }
        .my-trips-history-link-mobile {
          display: inline-flex;
          align-items: center;
          gap: var(--space-4);
          min-height: 40px;
          margin-block: 0 var(--space-16);
          color: #006D60;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
        }
        .my-trips-history-link {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: var(--space-4);
          min-height: 42px;
          color: #006D60;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
        }
        .my-trips-filters-mobile {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: var(--space-8);
          margin-bottom: var(--space-24);
        }
        .my-trips-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: var(--space-24);
          align-items: start;
        }
        .my-trips-content { min-width: 0; }
        .my-trips-header-desktop { display: none; }
        .my-trips-sidebar { display: none; background: var(--color-surface); }
        .next-trip-card, .next-trip-empty {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: var(--space-20);
          margin-bottom: var(--space-20);
          min-width: 0;
          padding: var(--space-16);
          border: 1px solid #D8E7E3;
          border-radius: 8px;
          background: #fff;
          box-shadow: 0 8px 24px rgba(11, 30, 61, 0.06);
        }
        .next-trip-main { min-width: 0; }
        .next-trip-meta { display: flex; align-items: center; gap: var(--space-8); flex-wrap: nowrap; min-width: 0; }
        .next-trip-eyebrow { margin: 0; color: #006D60; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        .next-trip-type { padding: 4px 8px; border-radius: 4px; background: #EEF2F2; color: #526262; font-size: 11px; font-weight: 700; }
        .next-trip-relative-time { margin: 9px 0 2px; color: #0B1E3D; font-size: 20px; font-weight: 800; line-height: 1.3; overflow-wrap: anywhere; }
        .next-trip-date { margin: 0 0 12px; color: #647575; font-size: 11px; font-weight: 600; }
        .next-trip-route { display: flex; align-items: stretch; gap: 10px; min-height: 64px; min-width: 0; }
        .next-trip-route-rail { display: flex; flex-direction: column; align-items: center; padding: 5px 0; }
        .next-trip-dot { width: 9px; height: 9px; border: 2px solid #007A6A; border-radius: 50%; background: #fff; }
        .next-trip-dot.dropoff { border-color: #D46A32; }
        .next-trip-route-line { width: 1px; flex: 1; min-height: 24px; background: #AAC8C0; }
        .next-trip-stations { display: grid; gap: 9px; min-width: 0; flex: 1; }
        .next-trip-stations p { display: grid; gap: 2px; margin: 0; min-width: 0; }
        .next-trip-stations p > span { color: #647575; font-size: 11px; }
        .next-trip-stations strong { display: -webkit-box; min-width: 0; overflow: hidden; color: #173337; font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
        .next-trip-driver { display: flex; align-items: center; gap: 7px; margin-top: 12px; color: #24454A; font-size: 12px; font-weight: 700; }
        .next-trip-vehicle { color: #647575; font-weight: 500; }
        .next-trip-aside { display: flex; flex-direction: column; align-items: stretch; gap: 8px; padding-top: 12px; border-top: 1px solid #EEF2F2; }
        .next-trip-status { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; width: max-content; max-width: 100%; padding: 5px 9px; border-radius: 4px; font-size: 11px; font-weight: 800; white-space: normal; }
        .next-trip-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .next-trip-vehicle-name { color: #526262; font-size: 12px; }
        .next-trip-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 44px;
          width: 100%;
          margin-inline-start: 0;
          padding: 0 13px;
          border-radius: 5px;
          background: #0B1E3D;
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
        }
        .next-trip-empty > div { display: flex; align-items: center; gap: 12px; }
        .next-trip-empty-mark { display: grid; place-items: center; width: 40px; height: 40px; flex: 0 0 40px; border-radius: 6px; background: #E7F4F0; color: #006D60; }
        .next-trip-empty h2 { margin: 0; color: #173337; font-size: 16px; }
        .next-trip-empty p { margin: 4px 0 0; color: #647575; font-size: 13px; line-height: 1.5; }
        .next-trip-empty .next-trip-action { width: 100%; }
        .trip-card:focus-within { outline: 2px solid #007A6A; outline-offset: 2px; }
        .trip-card-link:focus-visible { outline: 3px solid #F5A623; outline-offset: -3px; }
        .trip-type-badge { padding: 4px 8px; border-radius: 4px; background: #EEF2F2; color: #405555; font-size: 10px; font-weight: 800; }
        .trip-card-date { display: grid; gap: 3px; min-width: 88px; padding: 7px 9px; border-inline-start: 2px solid #00C2A8; background: #F2F8F6; color: #173337; font-size: 12px; font-weight: 800; }
        .trip-card-date span { color: #526262; font-size: 11px; font-weight: 600; }
        .trip-card-route { display: grid; gap: 9px; margin-block: 10px 12px; }
        .trip-card-route-row { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
        .trip-card-route-row span { min-width: 0; overflow: hidden; color: #24454A; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
        .trip-card-view-action { display: flex; align-items: center; justify-content: flex-end; gap: 6px; padding-top: 10px; border-top: 1px solid #EEF2F2; color: #006D60; font-size: 12px; font-weight: 800; }
        .trip-approved-caption { margin-block-start: 2px; color: #687978; font-size: 11px; line-height: 1.35; font-weight: 600; }
        .my-trips-day-group, .trip-card, .request-group-card {
          scroll-margin-top: calc(var(--app-header-h) + var(--my-trips-tabbar-height));
          scroll-margin-block-start: calc(var(--app-header-h) + var(--my-trips-tabbar-height));
        }
        .my-trips-history-link:focus-visible { outline: 3px solid #F5A623; outline-offset: 3px; }
        @media (min-width: 640px) {
          .empty-state-icon { width: 96px; height: 96px; }
          .my-trips-tabbar { grid-template-columns: minmax(0, 1fr) auto; }
          .my-trips-history-link-desktop { display: inline-flex; }
          .my-trips-history-link-mobile { display: none; }
        }
        @media (min-width: 900px) {
          .empty-state-icon { width: 120px; height: 120px; }
        }
        @media (min-width: 1024px) {
          .my-trips-shell {
            padding-block: var(--space-32) calc(var(--space-48) + 96px + env(safe-area-inset-bottom));
            padding-inline: var(--space-32);
          }
          .my-trips-header h1 {
            font-size: 28px;
          }
          .my-trips-tabbar { margin-inline: calc(-1 * var(--space-32)); padding-inline: var(--space-32); }
          .my-trips-tab-scroll { mask-image: none; }
          .my-trips-history-link-desktop { display: inline-flex; }
          .my-trips-history-link-mobile { display: none; }
          .my-trips-filters-mobile { display: none; }
          .my-trips-tabbar { margin-bottom: var(--space-24); }
          .my-trips-layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 300px;
            gap: var(--space-32);
            align-items: start;
            overflow: visible;
          }
          .my-trips-header-mobile { display: block; }
          .my-trips-header-desktop { display: none; }
          .my-trips-sidebar {
            display: block;
            position: sticky;
            top: calc(var(--app-header-h) + var(--my-trips-tabbar-height) + var(--space-16));
            grid-column: 2;
            grid-row: 1;
            min-width: 0;
            z-index: 2;
            height: fit-content;
          }
          .my-trips-sidebar-pin {
            position: static;
            width: 100%;
          }
          .my-trips-content { grid-column: 1; grid-row: 1; }
          .next-trip-card { grid-template-columns: minmax(0, 1fr) 250px; align-items: stretch; gap: var(--space-24); padding: var(--space-16); }
          .next-trip-relative-time { font-size: 23px; }
          .next-trip-aside { display: flex; flex-direction: row; align-items: center; justify-content: flex-start; flex-wrap: wrap; gap: 10px; padding: 0; border-top: 0; border-inline-start: 1px solid #EEF2F2; padding-inline-start: var(--space-16); }
          .next-trip-action { width: auto; min-width: 116px; margin-inline-start: auto; }
          .next-trip-empty .next-trip-action { width: auto; }
          .my-trips-sidebar { background: var(--color-surface); }
          .my-trips-sidebar-panel {
            background: #fff;
            border: 1px solid #eef0f3;
            border-radius: 14px;
            padding: var(--space-16);
            margin-block-end: var(--space-16);
          }
          .my-trips-sidebar-panel:last-child {
            margin-bottom: 0;
          }
          .my-trips-sidebar-label {
            font-size: 11px;
            font-weight: 800;
            color: #5A6A7A;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin: 0 0 var(--space-12);
          }
          .my-trips-stat-row {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: var(--space-8);
            padding: var(--space-8) 0;
            border-bottom: 1px solid #f4f6f8;
          }
          .my-trips-stat-row:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }
          .my-trips-stat-row:first-of-type {
            padding-top: 0;
          }
        }
      `}</style>

      <main className="my-trips-shell">
        <div
          className="my-trips-header my-trips-header-mobile"
          style={{ marginBottom: "var(--space-16)" }}
        >
          <TripsPageHeader locale={locale} summaryText={summaryText} />
        </div>

        <div className="my-trips-filters-mobile">
          <DateRangeCalendar />
          {isDriver && <StatusGroupFilter hiddenGroups={hiddenGroups} />}
        </div>

        {isPassenger && (
          <>
            <NextTripCard
              trip={nextTrip}
              pickupName={nextTripDetail?.pickupStation?.name}
              dropoffName={nextTripDetail?.dropoffStation?.name}
              locale={locale}
              now={displayNow}
            />
            {(paymentRequestCount > 0 || approvalRequestCount > 0) && (
              <div className="my-trips-alerts" aria-label={translate(locale, "my_trips.request_alerts")}>
                {paymentRequestCount > 0 && (
                  <Link className="my-trips-alert" href="/my-trips?group=pending" aria-label={translate(locale, paymentRequestCount === 1 ? "my_trips.payment_alert_one" : "my_trips.payment_alert_many", { count: paymentRequestCount })}>
                    <Clock size={15} aria-hidden="true" />
                    {translate(locale, paymentRequestCount === 1 ? "my_trips.payment_alert_one" : "my_trips.payment_alert_many", { count: toArabicDigitsIf(locale, String(paymentRequestCount)) })}
                    <ChevronRight size={15} aria-hidden="true" />
                  </Link>
                )}
                {approvalRequestCount > 0 && (
                  <div className="my-trips-alert approval" role="status">
                    <ShieldCheck size={15} aria-hidden="true" />
                    {translate(locale, approvalRequestCount === 1 ? "my_trips.approval_alert_one" : "my_trips.approval_alert_many", { count: toArabicDigitsIf(locale, String(approvalRequestCount)) })}
                  </div>
                )}
              </div>
            )}
            <TripTabs active={activePassengerTab} counts={tabCounts} />
          </>
        )}

        <div className="my-trips-layout">
          <aside className="my-trips-sidebar" aria-label={translate(locale, "my_trips.title")}>
            <div className="my-trips-sidebar-pin">
            <div className="my-trips-sidebar-panel">
              <p className="my-trips-sidebar-label">{translate(locale, "my_trips.sidebar_filters")}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)" }}>
                <DateRangeCalendar fullWidth />
                {isDriver && (
                  <StatusGroupFilter hiddenGroups={hiddenGroups} orientation="vertical" />
                )}
              </div>
            </div>

            <div className="my-trips-sidebar-panel">
              <p className="my-trips-sidebar-label">{translate(locale, "my_trips.sidebar_overview")}</p>
              <div className="my-trips-stat-row">
                <span style={{ fontSize: 13, color: "#5A6A7A" }}>
                  {translate(locale, "my_trips.results_label")}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#0B1E3D", fontVariantNumeric: "tabular-nums" }}>
                  {toArabicDigitsIf(locale, String(total))}
                </span>
              </div>
              <div className="my-trips-stat-row">
                <span style={{ fontSize: 13, color: "#5A6A7A" }}>
                  {translate(locale, "my_trips.status_filter_label")}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0B1E3D" }}>
                  {activeGroupLabel}
                </span>
              </div>
              {(dateFrom || dateTo) && (
                <div className="my-trips-stat-row">
                  <span style={{ fontSize: 13, color: "#5A6A7A" }}>
                    {translate(locale, "my_trips.date_filter_label")}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0B1E3D" }}>
                    {dateFrom && dateTo
                      ? `${prettyDate(locale, dateFrom)} – ${prettyDate(locale, dateTo)}`
                      : dateFrom
                        ? prettyDate(locale, dateFrom)
                        : prettyDate(locale, dateTo!)}
                  </span>
                </div>
              )}
              {!isDriver && pendingPaymentCount > 0 && (
                <div className="my-trips-stat-row">
                  <span style={{ fontSize: 13, color: "#5A6A7A" }}>
                    {translate(locale, "status.pending_payment")}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#E65100" }}>
                    {toArabicDigitsIf(locale, String(pendingPaymentCount))}
                  </span>
                </div>
              )}
              {!isDriver && approvalRequestCount > 0 && (
                <div className="my-trips-stat-row">
                  <span style={{ fontSize: 13, color: "#5A6A7A" }}>
                    {translate(locale, "request_status.waiting_for_approval")}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#16594F" }}>
                    {toArabicDigitsIf(locale, String(approvalRequestCount))}
                  </span>
                </div>
              )}
              {!isDriver && (
                <div className="my-trips-stat-row">
                  <span style={{ fontSize: 13, color: "#5A6A7A" }}>
                    {translate(locale, "wallet.balance_label")}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#00C2A8" }}>
                    {formatEgp(locale, walletBalance)}
                  </span>
                </div>
              )}
            </div>

            {!isDriver && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)", marginTop: "var(--space-16)" }}>
                <Link
                  href="/create"
                  style={{
                    display: "block",
                    padding: "var(--space-12) var(--space-16)",
                    background: "#0B1E3D",
                    color: "#fff",
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 14,
                    textDecoration: "none",
                    textAlign: "center",
                  }}
                >
                  {translate(locale, "my_trips.book_ride")}
                </Link>
                <Link
                  href="/wallet"
                  style={{
                    display: "block",
                    padding: "var(--space-12) var(--space-16)",
                    background: "#fff",
                    color: "#0B1E3D",
                    border: "1px solid #eef0f3",
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 14,
                    textDecoration: "none",
                    textAlign: "center",
                  }}
                >
                  {translate(locale, "nav.wallet")}
                </Link>
              </div>
            )}
            </div>
          </aside>

          <div className="my-trips-content" style={{ minWidth: 0 }}>
            <div className="my-trips-header my-trips-header-desktop">
              <TripsPageHeader locale={locale} summaryText={summaryText} />
            </div>
        {listItems.length === 0 ? (
          <EmptyState
            minHeight="min(40vh, 360px)"
            icon={
              isDriver ? (
                <DriverEmptyIcon
                  className="empty-state-icon"
                  title={translate(locale, "my_trips.empty_assigned")}
                />
              ) : (
                <PassengerEmptyIcon
                  className="empty-state-icon"
                  title={translate(locale, "my_trips.empty")}
                />
              )
            }
            title={
              isPassenger
                ? translate(locale, `my_trips.empty_tab_${activePassengerTab}_title`)
                : hasFilters
                  ? translate(locale, "my_trips.empty_title_filtered")
                  : isDriver
                  ? driverOngoingView
                    ? translate(locale, "my_trips.empty_ongoing")
                    : translate(locale, "my_trips.empty_assigned")
                  : translate(locale, "my_trips.empty")
            }
            description={
              isPassenger
                ? translate(locale, `my_trips.empty_tab_${activePassengerTab}_description`)
                : hasFilters
                  ? translate(locale, "my_trips.empty_description_filtered")
                  : isDriver
                  ? driverOngoingView
                    ? translate(locale, "my_trips.empty_description_ongoing")
                    : translate(locale, "my_trips.empty_description_assigned")
                  : translate(locale, "my_trips.empty_description_book")
            }
            action={
              !isDriver ? (
                <Link
                  href="/create"
                  style={{
                    display: "inline-block",
                    padding: "var(--space-12) var(--space-24)",
                    background: "#0B1E3D",
                    outlineOffset: 3,
                    color: "#fff",
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 14,
                    textDecoration: "none",
                  }}
                  className="my-trips-book-link"
                >
                  {translate(locale, "my_trips.book_ride")}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            {dayGroups.map((group) => (
              <div key={group.date} className="my-trips-day-group" style={{ marginBottom: "var(--space-24)" }}>
                <div
                  className="my-trips-date-heading"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-8)",
                    marginBottom: "var(--space-12)",
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
                    · {group.items.reduce((count, item) => count + (item.kind === "request_group" ? item.data.trips.length : 1), 0)} {group.items.reduce((count, item) => count + (item.kind === "request_group" ? item.data.trips.length : 1), 0) === 1 ? (isDriver ? translate(locale, "my_trips.ride_singular") : translate(locale, "my_trips.trip_singular")) : (isDriver ? translate(locale, "my_trips.ride_plural") : translate(locale, "my_trips.trip_plural"))}
                    {isDriver ? (
                      ` · ${group.items.reduce((sum, item) => item.kind === "ride" ? sum + item.data.passengerCount : sum, 0)} ${translate(locale, "my_trips.passengers")}`
                    ) : ""}
                  </span>
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}
                >
                  {group.items.map((item) => {
                    if (item.kind === "request_group") {
                      return (
                        <RequestTripGroupCard
                          key={item.data.requestId}
                          requestId={item.data.requestId}
                          trips={item.data.trips}
                          walletBalance={walletBalance}
                          locale={locale}
                          allowPay={activePassengerTab === "pending"}
                          sharedTripDetailsById={sharedTripDetailsById}
                        />
                      );
                    }
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
                                            title={
                                              ride.rideType === "shared"
                                                ? (passenger.pickupStation?.name ??
                                                  ride.pickupStation?.name ??
                                                  passenger.pickupAddress)
                                                : passenger.pickupAddress
                                            }
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
                                            title={
                                              ride.rideType === "shared"
                                                ? (passenger.dropoffStation?.name ??
                                                  ride.dropoffStation?.name ??
                                                  passenger.dropoffAddress)
                                                : passenger.dropoffAddress
                                            }
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
                    const displayRequest = {
                      status: trip.parentRequestStatus ?? trip.status,
                      paymentStatus: trip.parentPaymentStatus ?? trip.paymentStatus,
                      hasPastTrip: trip.hasPastTrip,
                      rejectionReason: trip.rejectionReason,
                    };
                    const displayStatus = getDisplayStatus({ request: displayRequest, trip });
                    const rejectionDisplay = getRejectionDisplay({ request: displayRequest, trip });
                    const timedOut = trip.status === "time_out";
                    const hasAssignedDriver = Boolean(trip.assignedDriver);
                    const sharedDetail = !isDriver ? sharedTripDetailsById.get(trip.id) : null;
                    const showSharedSummary =
                      !isDriver &&
                      isSharedVehicle(trip.vehicleType) &&
                      Boolean(sharedDetail?.rideDetails);
                    const pickupName = sharedDetail?.pickupStation?.name ?? trip.pickupAddress;
                    const dropoffName = sharedDetail?.dropoffStation?.name ?? trip.dropoffAddress;
                    const sharedTrip = isSharedVehicle(trip.vehicleType);
                    const needsPayment =
                      !isDriver &&
                      activePassengerTab === "pending" &&
                      displayStatus.canPay;
                    return (
                      <div
                        key={trip.id}
                        className="trip-card"
                        style={{
                          background: "#fff",
                          borderRadius: 8,
                          border: "1px solid #DCE6E4",
                          overflow: "hidden",
                          opacity: timedOut ? 0.7 : 1,
                          boxShadow: "0 3px 12px rgba(11,30,61,0.035)",
                        }}
                      >
                        <Link
                          className="trip-card-link"
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
                              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
                                <Car size={20} color="#00806E" aria-hidden="true" />
                                <span style={{ fontSize: 16, fontWeight: 800, color: "#0B1E3D" }}>
                                  {vLabel}
                                </span>
                                <span className="trip-type-badge">
                                  {translate(locale, sharedTrip ? "ride.shared" : "ride.private")}
                                </span>
                              </div>
                              <span style={{ fontWeight: 800, fontSize: 16, color: "#00C2A8", fontVariantNumeric: "tabular-nums" }}>
                                {formatEgp(locale, trip.priceEgp)}
                              </span>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 8,
                                marginBottom: 12,
                                fontSize: 12,
                                color: "#5A6A7A",
                              }}
                            >
                              <span>{translate(locale, "my_trips.trip_fare")}</span>
                              <span style={{ fontWeight: 700, color: "#0B1E3D", fontVariantNumeric: "tabular-nums" }}>
                                {translate(locale, "my_trips.request_total")}: {formatEgp(locale, trip.bookingAmountEgp)}
                              </span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                              <span className="trip-card-date">
                                {formatDate(locale, trip.date)}
                                <span>{formatTime(locale, trip.pickupTime)}</span>
                              </span>
                              <Pill {...displayPill(locale, displayStatus)} />
                              {trip.status === "matched" && (
                                <MatchedTripCountdown
                                  date={trip.date}
                                  pickupTime={trip.pickupTime}
                                  locale={locale}
                                />
                              )}
                              {displayStatus.showRefundBadge && trip.cancellation && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    padding: "3px 10px",
                                    borderRadius: 20,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background:
                                      trip.cancellation.refundStatus === "approved"
                                        ? "#E8F8F5"
                                        : trip.cancellation.refundStatus === "rejected"
                                          ? "#FDECEA"
                                          : "#FFF3E0",
                                    color:
                                      trip.cancellation.refundStatus === "approved"
                                        ? "#00806E"
                                        : trip.cancellation.refundStatus === "rejected"
                                          ? "#C0392B"
                                          : "#E65100",
                                    border: `1px solid ${
                                      trip.cancellation.refundStatus === "approved"
                                        ? "#CBE9E2"
                                        : trip.cancellation.refundStatus === "rejected"
                                          ? "#FADBD8"
                                          : "#FFE0B2"
                                    }`,
                                  }}
                                >
                                  {trip.cancellation.refundStatus === "approved"
                                    ? `Refund Approved (${trip.cancellation.refundAmount} EGP)`
                                    : trip.cancellation.refundStatus === "rejected"
                                      ? "Refund Rejected"
                                      : `Refund Pending Review (${trip.cancellation.refundAmount} EGP)`}
                                </span>
                              )}
                            </div>
                            {(rejectionDisplay.showReasonCard || displayStatus.secondaryKey || displayStatus.secondaryText) && (
                              <p
                                className={displayStatus.secondaryKey === "status.approved_by_admin" ? "trip-approved-caption" : undefined}
                                title={rejectionDisplay.showReasonCard ? (rejectionDisplay.reason ?? translate(locale, "rejection.no_reason")) : undefined}
                                style={{
                                  margin: displayStatus.secondaryKey === "status.approved_by_admin" ? "-5px 0 10px" : "-4px 0 12px",
                                  marginInlineStart: displayStatus.secondaryKey === "status.approved_by_admin" ? 28 : 0,
                                  fontSize: displayStatus.secondaryKey === "status.approved_by_admin" ? 11 : 13,
                                  lineHeight: displayStatus.secondaryKey === "status.approved_by_admin" ? 1.35 : 1.5,
                                  color: displayStatus.secondaryKey === "status.approved_by_admin" ? "#687978" : "#5A6A7A",
                                  ...(rejectionDisplay.showReasonCard
                                    ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }
                                    : {}),
                                }}
                              >
                                {rejectionDisplay.showReasonCard
                                  ? rejectionDisplay.reason ?? translate(locale, "rejection.no_reason")
                                  : displayStatus.secondaryKey
                                    ? translate(locale, displayStatus.secondaryKey)
                                    : displayStatus.secondaryText}
                              </p>
                            )}

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
                                      {(trip.assignedDriver?.profilePicture ?? trip.assignedDriver?.profilePic) ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={trip.assignedDriver.profilePicture ?? trip.assignedDriver.profilePic ?? ""}
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
                                      <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: "#fff", border: "1px solid #CBE9E2", fontSize: 12, fontWeight: 700, color: "#0B1E3D", whiteSpace: "nowrap" }}>
                                        <span style={{ fontSize: 10, color: "#5A6A7A", textTransform: "uppercase", letterSpacing: "0.04em" }}>Color</span>
                                        <span>{trip.assignedDriver?.vehicleColor ?? trip.assignedDriver?.carColor ?? "—"}</span>
                                      </span>
                                    </div>
                                  </div>
                                )}

                                <div className="trip-card-route">
                                  <div className="trip-card-route-row">
                                    <MapPin size={13} color="#00C2A8" style={{ marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
                                    <span title={pickupName}>{truncate(pickupName)}</span>
                                  </div>
                                  <div className="trip-card-route-row">
                                    <MapPin size={13} color="#E74C3C" style={{ marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
                                    <span title={dropoffName}>{truncate(dropoffName)}</span>
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
                                      {translate(locale, "arrive")} <strong style={{ color: "#0B1E3D" }}>{formatTime(locale, trip.arrivalTime)}</strong>
                                    </span>
                                  </div>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#647575" }}>
                                    <Route size={12} aria-hidden="true" />
                                    {formatDistanceKm(locale, trip.distanceKm ?? 0)} · {formatMinutes(locale, trip.durationMinutes ?? 0)}
                                  </span>
                                  <span className="trip-card-view-action">
                                    {translate(locale, "my_trips.view_trip")}
                                    <ChevronRight size={15} aria-hidden="true" />
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </Link>
                        {!isDriver && displayStatus.canCancel && (
                          <div style={{ padding: "0 18px 16px", display: "flex", justifyContent: "flex-end" }}>
                            <CancelTripModal
                              tripId={trip.id}
                              tripNumber={trip.tripNumber}
                              date={trip.date}
                              priceEgp={trip.priceEgp}
                              status={trip.status}
                            />
                          </div>
                        )}
                        {!isDriver && needsPayment && (
                          <div style={{ padding: "0 18px 16px" }}>
                            <ContinueCheckoutButton bookingId={trip.requestId} amountEgp={trip.bookingAmountEgp} walletBalance={walletBalance} />
                          </div>
                        )}
                        {!isDriver && displayStatus.canRate && (
                          <div style={{ padding: "0 18px 16px" }}>
                            <RateTripModal tripId={trip.id} initialRating={trip.rating ?? null} />
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
          </div>
        </div>
      </main>
    </div>
  );
}
