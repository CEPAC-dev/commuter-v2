import { redirect, notFound } from "next/navigation";
import {
  Car,
  MapPin,
  Route,
  CalendarDays,
  Clock,
  Users,
  LogIn,
  LogOut,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getDriverRide } from "@/lib/services/rideService";
import { getUserTrip, getDriverTrip } from "@/lib/services/trips";
import AppHeader from "@/components/layout/AppHeader";
import RouteMap from "@/components/shared/RouteMapOsmLoader";
import DriverCard from "@/components/trips/DriverCard";
import TripChat from "@/components/shared/TripChat";
import PrivateRideDetails from "@/components/trips/PrivateRideDetails";
import SharedRideDetails from "@/components/trips/SharedRideDetails";
import RateTripModal from "@/components/trips/RateTripModal";
import CancelTripModal from "@/components/trips/CancelTripModal";
import VehicleSeatMap from "@/components/trips/VehicleSeatMap";
import type {
  PaymentStatus,
  RideDetailView,
  RideStatus,
  TripStatus,
} from "@/types/booking";
import type { GeoPoint, StationSelection } from "@/types/geo";
import { translate, formatDate, formatTime, formatEgp, localeDirection } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n/server";
export const metadata = { title: "Trip detail — Commuter" };
export const dynamic = "force-dynamic";

// ── helpers ──────────────────────────────────────────────────────────────────

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

const RIDE_STATUS_PILL: Record<
  RideStatus,
  { label: string; bg: string; color: string }
> = {
  matched: { label: "Ongoing", bg: "#00C2A8", color: "#fff" },
  confirmed: { label: "Upcoming", bg: "#E2E8F0", color: "#5A6A7A" },
  active: { label: "Ongoing", bg: "#00C2A8", color: "#fff" },
  completed: { label: "Previous", bg: "#0B1E3D", color: "#fff" },
  cancelled: { label: "Previous", bg: "#0B1E3D", color: "#fff" },
};

function rideMapPoints(ride: RideDetailView, isDriver: boolean) {
  if (ride.rideType === "shared") {
    const stationByKey = new Map<string, StationSelection>();
    const firstPassenger = ride.passengers[0];
    const lastPassenger =
      ride.passengers[ride.passengers.length - 1] ?? firstPassenger;

    for (const passenger of ride.passengers) {
      const status = String(passenger.status ?? "").toLowerCase();
      // No-show/cancelled passengers must not keep their station on the route.
      if (isDriver && ["no_show", "cancelled"].includes(status)) continue;
      if (passenger.pickupStation) {
        stationByKey.set(
          `${passenger.pickupStation.id}:${passenger.pickupStation.lat}:${passenger.pickupStation.lng}`,
          passenger.pickupStation,
        );
      }
      if (passenger.dropoffStation) {
        stationByKey.set(
          `${passenger.dropoffStation.id}:${passenger.dropoffStation.lat}:${passenger.dropoffStation.lng}`,
          passenger.dropoffStation,
        );
      }
    }
    if (ride.pickupStation) {
      stationByKey.set(
        `${ride.pickupStation.id}:${ride.pickupStation.lat}:${ride.pickupStation.lng}`,
        ride.pickupStation,
      );
    }
    if (ride.dropoffStation) {
      stationByKey.set(
        `${ride.dropoffStation.id}:${ride.dropoffStation.lat}:${ride.dropoffStation.lng}`,
        ride.dropoffStation,
      );
    }

    if (isDriver) {
      const allStations = Array.from(stationByKey.values());
      const routePickup =
        ride.pickupStation ??
        firstPassenger?.pickupStation ??
        allStations[0] ??
        null;
      const routeDropoff =
        ride.dropoffStation ??
        lastPassenger?.dropoffStation ??
        allStations[allStations.length - 1] ??
        null;

      const intermediateStations = allStations.filter(
        (s) =>
          `${s.lat},${s.lng}` !== `${routePickup?.lat},${routePickup?.lng}` &&
          `${s.lat},${s.lng}` !== `${routeDropoff?.lat},${routeDropoff?.lng}`,
      );

      return {
        pickup: routePickup,
        dropoff: routeDropoff,
        stops: undefined,
        stations:
          intermediateStations.length > 0 ? intermediateStations : undefined,
      };
    }

    const stations = Array.from(stationByKey.values());

    return {
      pickup: firstPassenger?.pickup ?? null,
      dropoff: lastPassenger?.dropoff ?? null,
      stops: undefined,
      stations,
    };
  }

  const routePoints = ride.route
    .map((stop) => stop.point)
    .filter((point): point is GeoPoint => Boolean(point));

  if (routePoints.length >= 2) {
    return {
      pickup: routePoints[0],
      dropoff: routePoints[routePoints.length - 1],
      stops: routePoints.slice(1, -1).map(({ lat, lng }) => ({ lat, lng })),
      stations: undefined,
    };
  }

  const firstPassenger = ride.passengers[0];
  return {
    pickup: firstPassenger?.pickup ?? null,
    dropoff: firstPassenger?.dropoff ?? null,
    stops: undefined,
    stations: undefined,
  };
}

function truncateAddress(value: string, max = 46): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

const STATUS_PILL: Record<
  TripStatus,
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

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "#f8f9fa",
        border: "1px solid #eef0f3",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ marginTop: 2, flexShrink: 0 }}>{icon}</span>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 800,
              color: "#0B1E3D",
              lineHeight: 1.25,
            }}
          >
            {label}
          </p>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              fontWeight: 500,
              color: "#5A6A7A",
            }}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}



import DriverRideInteractiveClient from "@/components/trips/DriverRideInteractiveClient";

function DriverRideDetailView({
  ride,
  email,
}: {
  ride: RideDetailView;
  email: string;
}) {
  return <DriverRideInteractiveClient ride={ride} email={email} />;
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getServerLocale();
  const to12h = (hhmm: string) => formatTime(locale, hhmm);

  const session = await getSession();
  const { id } = await params;
  if (!session) redirect(`/login?redirect=/my-trips/${id}`);
  if (session.role === "admin") redirect("/admin/dashboard");

  const isDriver = session.role === "driver";

  if (isDriver) {
    const ride = await getDriverRide(session.userId, id);
    if (ride) {
      return <DriverRideDetailView ride={ride} email={session.email} />;
    }
  }

  const trip = isDriver
    ? await getDriverTrip(session.userId, id)
    : await getUserTrip(session.userId, id);

  if (!trip) notFound();

  const vLabel = translate(locale, `vehicles.${trip.vehicleType}`);
  const paymentStatus = (trip.paymentStatus as PaymentStatus) ?? "pending";
  const status = (trip.status as TripStatus) ?? "pending_payment";
  const isOngoing = status === "active" || status === "matched";
  const distinctPassengers = (trip.passengers ?? []).filter(
    (p) => !p.sameAsMain && p.pickup && p.dropoff,
  );

  return (
    <div dir={localeDirection(locale)} style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader
        authed
        email={session.email}
        role={isDriver ? "driver" : "passenger"}
        variant="app"
        backHref="/my-trips"
      />

      <main
        style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px 56px" }}
      >
        {/* Hero summary card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 18,
            border: "1px solid #eef0f3",
            boxShadow: "0 1px 3px rgba(11,30,61,0.06)",
            padding: "18px 20px",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 700,
                color: "#5A6A7A",
              }}
            >
              <CalendarDays size={14} aria-hidden="true" />
              {translate(locale, "my_trips.ride_number", { rideNumber: trip.tripNumber })} · {formatDate(locale, trip.date)}
            </span>
            <span
              style={{
                fontWeight: 900,
                fontSize: 24,
                color: "#0B1E3D",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
              }}
            >
              {formatEgp(locale, trip.priceEgp)}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill {...({ ...(PAY_PILL[paymentStatus] ?? PAY_PILL.pending), label: translate(locale, `payments.${paymentStatus}`) })} />
            <Pill {...({ ...(STATUS_PILL[status] ?? STATUS_PILL.pending_payment), label: translate(locale, ((): string => {
              const map: Record<string, string> = {
                pending_payment: "pending_payment",
                submitted: "upcoming",
                matched: "ongoing",
                confirmed: "upcoming",
                active: "ongoing",
                completed: "previous",
                cancelled: "previous",
                time_out: "previous",
              };
              return `status.${map[status] ?? "previous"}`;
            })()) })} />
            {status === "cancelled" && (trip as any).cancellation && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background:
                    (trip as any).cancellation.refundStatus === "approved"
                      ? "#E8F8F5"
                      : (trip as any).cancellation.refundStatus === "rejected"
                        ? "#FDECEA"
                        : "#FFF3E0",
                  color:
                    (trip as any).cancellation.refundStatus === "approved"
                      ? "#00806E"
                      : (trip as any).cancellation.refundStatus === "rejected"
                        ? "#C0392B"
                        : "#E65100",
                }}
              >
                {(trip as any).cancellation.refundStatus === "approved"
                  ? `Refund Approved (${(trip as any).cancellation.refundAmount} EGP)`
                  : (trip as any).cancellation.refundStatus === "rejected"
                    ? "Refund Rejected"
                    : `Refund Pending Review (${(trip as any).cancellation.refundAmount} EGP)`}
              </span>
            )}
          </div>
          {!isDriver && (status === "submitted" || status === "matched" || status === "confirmed" || status === "active") && (
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
              <CancelTripModal
                tripId={trip.id}
                tripNumber={trip.tripNumber}
                date={trip.date}
                priceEgp={trip.priceEgp}
                status={trip.status}
              />
            </div>
          )}
          {status === "completed" && !isDriver && (
            <div style={{ marginTop: 14 }}>
              <RateTripModal tripId={id} initialRating={trip.rating ?? null} />
            </div>
          )}
        </div>

        {/* Route map */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #eef0f3",
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <RouteMap
            pickup={
              isDriver && trip.rideType === "shared"
                ? (trip.pickupStation ?? trip.pickup)
                : trip.pickup
            }
            dropoff={
              isDriver && trip.rideType === "shared"
                ? (trip.dropoffStation ?? trip.dropoff)
                : trip.dropoff
            }
            stops={trip.stops?.map((s) => s.point)}
            stations={
              trip.rideType === "shared" && !isDriver
                ? [trip.pickupStation, trip.dropoffStation].filter(
                    (s): s is NonNullable<typeof s> => Boolean(s),
                  )
                : undefined
            }
            height={220}
            interactive
          />

          <div style={{ padding: "16px 18px" }}>
            {/* Quick summary chips */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <Detail
                icon={<Route size={15} color="#0B1E3D" />}
                label={translate(locale, "ride_type.label")}
                value={translate(locale, `ride_type.${trip.rideType}`)}
              />
              <Detail
                icon={<Car size={15} color="#0B1E3D" />}
                label={translate(locale, "my_requests.vehicle")}
                value={vLabel}
              />
            </div>
          </div>
        </div>

        {/* Private ride: origin, stops, destination, distance/time breakdown */}
        {trip.rideType === "private" && (
          <PrivateRideDetails
            locale={locale}
            pickup={trip.pickup}
            dropoff={trip.dropoff}
            pickupTime={trip.pickupTime}
            arrivalTime={trip.arrivalTime}
            numberOfPassengers={trip.numberOfPassengers}
            stops={trip.stops ?? []}
            distanceKm={trip.distanceKm}
            durationMinutes={trip.durationMinutes}
            to12h={to12h}
          />
        )}

        {/* Shared ride: origin/station, destination/station, distance/time breakdown */}
        {trip.rideType === "shared" && (
          <SharedRideDetails
            locale={locale}
            pickup={trip.pickup}
            dropoff={trip.dropoff}
            pickupTime={trip.pickupTime}
            arrivalTime={trip.arrivalTime}
            extraPassengers={trip.extraPassengers}
            pickupStation={trip.pickupStation}
            dropoffStation={trip.dropoffStation}
            pickupStationOptions={trip.pickupStationOptions}
            dropoffStationOptions={trip.dropoffStationOptions}
            walkingMinToStation={trip.walkingMinToStation}
            walkingMinFromStation={trip.walkingMinFromStation}
            distanceKm={trip.distanceKm}
            durationMinutes={trip.durationMinutes}
            to12h={to12h}
            isDriver={isDriver}
          />
        )}

        {/* Visual 2D Seating Map for Passenger / Driver */}
        {isOngoing &&
          (() => {
            const passengerInRide = trip.rideDetails?.passengers?.find(
              (p) => String(p.tripId) === String(trip.id),
            );
            const mySeats =
              passengerInRide?.seatNumbers &&
              passengerInRide.seatNumbers.length > 0
                ? passengerInRide.seatNumbers
                : trip.seatNumbers && trip.seatNumbers.length > 0
                  ? trip.seatNumbers
                  : [1];

              return (
              <VehicleSeatMap
                ride={trip.rideDetails}
                vehicleType={trip.vehicleType}
                assignedSeatNumbers={mySeats}
                isDriver={isDriver}
              />
            );
          })()}

        {/* Ongoing trip: driver card + chat (passenger) / chat only (driver) */}
        {isOngoing && (
          <>
            {!isDriver && (
              <DriverCard
                driver={
                  trip.assignedDriver ?? {
                    name: "",
                    phone: "",
                    profilePic: null,
                    carBrand: "",
                    carModel: "",
                    modelYear: "",
                    vehicleColor: "",
                    carColor: "",
                    plate: "",
                  }
                }
              />
            )}
            {trip.rideType !== "shared" && (
              <div style={{ marginBottom: 16 }}>
                <TripChat tripId={id} role={isDriver ? "driver" : "user"} />
              </div>
            )}
          </>
        )}

        {/* Distinct passenger points (shared rides only — private covered above) */}
        {trip.rideType === "shared" && distinctPassengers.length > 0 && (
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #eef0f3",
              padding: "16px 18px",
              marginBottom: 16,
            }}
          >
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 13,
                fontWeight: 700,
                color: "#0B1E3D",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
                {translate(locale, "my_trips.passenger_stops")}
            </p>
            {distinctPassengers.map((p, i) => (
              <div
                key={i}
                style={{
                  borderTop: i > 0 ? "1px solid #f4f6f8" : undefined,
                  paddingTop: i > 0 ? 12 : 0,
                  marginTop: i > 0 ? 12 : 0,
                }}
              >
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#5A6A7A",
                  }}
                >
                  {translate(locale, "my_trips.passenger_singular")} {i + 1}
                </p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    <MapPin
                      size={12}
                      color="#00C2A8"
                      style={{ marginTop: 2, flexShrink: 0 }}
                      aria-hidden="true"
                    />
                    <span style={{ fontSize: 13, color: "#0B1E3D" }}>
                      {p.pickup?.address ?? "—"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    <MapPin
                      size={12}
                      color="#E74C3C"
                      style={{ marginTop: 2, flexShrink: 0 }}
                      aria-hidden="true"
                    />
                    <span style={{ fontSize: 13, color: "#0B1E3D" }}>
                      {p.dropoff?.address ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p
          style={{
            fontSize: 12,
            color: "#9aa7b4",
            textAlign: "center",
            marginTop: 20,
          }}
        >
          {translate(locale, "my_trips.requested_at").replace(
            "{datetime}",
            new Date(trip.createdAt).toLocaleString("en-EG"),
          )}
        </p>
      </main>
    </div>
  );
}
