import { redirect, notFound } from "next/navigation";
import { Car, MapPin, Route, CalendarDays, Clock, Users } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getDriverRide } from "@/lib/services/rideService";
import { getUserTrip, getDriverTrip } from "@/lib/services/trips";
import { VEHICLES } from "@/lib/config/vehicles";
import type { VehicleKey } from "@/lib/config/vehicles";
import AppHeader from "@/components/layout/AppHeader";
import RouteMap from "@/components/shared/RouteMapOsmLoader";
import DriverCard from "@/components/trips/DriverCard";
import TripChat from "@/components/shared/TripChat";
import PrivateRideDetails from "@/components/trips/PrivateRideDetails";
import SharedRideDetails from "@/components/trips/SharedRideDetails";
import RateTripModal from "@/components/trips/RateTripModal";
import VehicleSeatMap from "@/components/trips/VehicleSeatMap";
import type {
  PaymentStatus,
  RideDetailView,
  RideStatus,
  TripStatus,
} from "@/types/booking";
import type { GeoPoint, StationSelection } from "@/types/geo";
export const metadata = { title: "Trip detail — Commuter" };
export const dynamic = "force-dynamic";

// ── helpers ──────────────────────────────────────────────────────────────────

function to12h(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function prettyDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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

function DriverRideDetailView({
  ride,
  email,
}: {
  ride: RideDetailView;
  email: string;
}) {
  const vLabel =
    VEHICLES[ride.vehicleType as VehicleKey]?.label ?? ride.vehicleType;
  const status = ride.status;
  const isOngoing =
    status === "active" || status === "matched" || status === "confirmed";
  const mapPoints = rideMapPoints(ride, true);

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader
        authed
        email={email}
        role="driver"
        variant="app"
        backHref="/my-trips?group=ongoing"
      />

      <main
        style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px 56px" }}
      >
        <div style={{ marginBottom: 20 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              color: "#5A6A7A",
              marginBottom: 8,
            }}
          >
            <CalendarDays size={14} aria-hidden="true" />
            Ride #{ride.rideNumber} · {prettyDate(ride.date)}
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill
                {...(RIDE_STATUS_PILL[status] ?? RIDE_STATUS_PILL.matched)}
              />
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
            <span
              style={{
                fontWeight: 900,
                fontSize: 22,
                color: "#0B1E3D",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {ride.totalCost} EGP
            </span>
          </div>
        </div>

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
            pickup={mapPoints.pickup}
            dropoff={mapPoints.dropoff}
            stops={mapPoints.stops}
            stations={mapPoints.stations}
            height={220}
            interactive
          />

          <div style={{ padding: "16px 18px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <Detail
                icon={<Route size={15} color="#0B1E3D" />}
                label="Ride type"
                value={ride.rideType === "shared" ? "Shared" : "Private"}
              />
              <Detail
                icon={<Car size={15} color="#0B1E3D" />}
                label="Vehicle"
                value={vLabel}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 12,
              }}
            >
              <Clock size={14} color="#5A6A7A" aria-hidden="true" />
              <span style={{ fontSize: 13, color: "#5A6A7A", fontWeight: 500 }}>
                Window{" "}
                <strong style={{ color: "#0B1E3D" }}>
                  {to12h(ride.startTime)} – {to12h(ride.endTime)}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Visual 2D Seating Map */}
        <VehicleSeatMap ride={ride} isDriver />

        {/* Stations Overview (Shared Rides) */}
        {(ride.rideType === "shared" ||
          ride.pickupStation ||
          ride.dropoffStation) && (
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
              Stations Overview
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#E8F8F5",
                  border: "1px solid #C3F0E8",
                }}
              >
                <MapPin
                  size={16}
                  color="#00C2A8"
                  style={{ marginTop: 2, flexShrink: 0 }}
                  aria-hidden="true"
                />
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#00806E",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      display: "block",
                    }}
                  >
                    Pickup Station
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0B1E3D",
                    }}
                  >
                    {ride.pickupStation?.name ??
                      ride.passengers[0]?.pickupStation?.name ??
                      "Pickup station"}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#FFEBEE",
                  border: "1px solid #FFCDD2",
                }}
              >
                <MapPin
                  size={16}
                  color="#E74C3C"
                  style={{ marginTop: 2, flexShrink: 0 }}
                  aria-hidden="true"
                />
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#C0392B",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      display: "block",
                    }}
                  >
                    Dropoff Station
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0B1E3D",
                    }}
                  >
                    {ride.dropoffStation?.name ??
                      ride.passengers[ride.passengers.length - 1]
                        ?.dropoffStation?.name ??
                      "Dropoff station"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Route Details Section (First Station -> Final Station) */}
        {(() => {
          let routeStops = ride.route ?? [];
          if (routeStops.length === 0 && ride.passengers.length > 0) {
            routeStops = ride.passengers.flatMap((p) => [
              {
                address:
                  p.pickupStation?.name ?? p.pickupAddress ?? "Pickup station",
                boarding: p.numberOfPassengers || 1,
                alighting: 0,
                waitingMinutes: 0,
                point: null,
              },
              {
                address:
                  p.dropoffStation?.name ??
                  p.dropoffAddress ??
                  "Dropoff station",
                boarding: 0,
                alighting: p.numberOfPassengers || 1,
                waitingMinutes: 0,
                point: null,
              },
            ]);
          }

          return (
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #eef0f3",
                padding: "20px 20px",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#0B1E3D",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Route Details
                  </p>
                  <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                    First station to final destination
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#00806E",
                    background: "#E8F8F5",
                    padding: "4px 10px",
                    borderRadius: 999,
                  }}
                >
                  {routeStops.length} Stations/Stops
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {routeStops.map((stop, index) => {
                  const isFirst = index === 0;
                  const isLast = index === routeStops.length - 1;
                  const badgeBg = isFirst
                    ? "#00C2A8"
                    : isLast
                      ? "#0B1E3D"
                      : "#5A6A7A";
                  const stationTitle = isFirst
                    ? "First Station (Start Point)"
                    : isLast
                      ? "Final Station (Destination)"
                      : `Station / Stop ${index + 1}`;

                  return (
                    <div
                      key={`route-step-${index}`}
                      style={{
                        display: "flex",
                        gap: 14,
                        position: "relative",
                        paddingBottom: isLast ? 0 : 20,
                      }}
                    >
                      {!isLast && (
                        <div
                          style={{
                            position: "absolute",
                            left: 13,
                            top: 26,
                            bottom: 0,
                            width: 2,
                            background:
                              "linear-gradient(to bottom, #00C2A8, #E6EAEC)",
                          }}
                        />
                      )}

                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: badgeBg,
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          zIndex: 1,
                        }}
                      >
                        {index + 1}
                      </span>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: isFirst
                              ? "#00806E"
                              : isLast
                                ? "#0B1E3D"
                                : "#5A6A7A",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            display: "block",
                          }}
                        >
                          {stationTitle}
                        </span>
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#0B1E3D",
                            lineHeight: 1.3,
                          }}
                        >
                          {stop.address}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            marginTop: 4,
                            flexWrap: "wrap",
                          }}
                        >
                          {stop.boarding > 0 && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#00806E",
                                background: "#E8F8F5",
                                padding: "2px 6px",
                                borderRadius: 4,
                              }}
                            >
                              +{stop.boarding} pickup
                            </span>
                          )}
                          {stop.alighting > 0 && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#C0392B",
                                background: "#FFEBEE",
                                padding: "2px 6px",
                                borderRadius: 4,
                              }}
                            >
                              -{stop.alighting} dropoff
                            </span>
                          )}
                          {stop.waitingMinutes > 0 && (
                            <span style={{ fontSize: 11, color: "#5A6A7A" }}>
                              ⏱ {stop.waitingMinutes} min wait
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {isOngoing && ride.chatTripId && (
          <div style={{ marginBottom: 16 }}>
            <TripChat tripId={ride.chatTripId} role="driver" />
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
          Matched {new Date(ride.createdAt).toLocaleString("en-EG")}
        </p>
      </main>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const vLabel =
    VEHICLES[trip.vehicleType as VehicleKey]?.label ?? trip.vehicleType;
  const paymentStatus = (trip.paymentStatus as PaymentStatus) ?? "pending";
  const status = (trip.status as TripStatus) ?? "pending_payment";
  const isOngoing = status === "active" || status === "matched";
  const distinctPassengers = (trip.passengers ?? []).filter(
    (p) => !p.sameAsMain && p.pickup && p.dropoff,
  );

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
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
        {/* Summary header */}
        <div style={{ marginBottom: 20 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              color: "#5A6A7A",
              marginBottom: 8,
            }}
          >
            <CalendarDays size={14} aria-hidden="true" />
            Trip #{trip.tripNumber} · {prettyDate(trip.date)}
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill {...(PAY_PILL[paymentStatus] ?? PAY_PILL.pending)} />
              <Pill {...(STATUS_PILL[status] ?? STATUS_PILL.pending_payment)} />
            </div>
            <span
              style={{
                fontWeight: 900,
                fontSize: 22,
                color: "#0B1E3D",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {trip.priceEgp} EGP
            </span>
          </div>
          {status === "completed" && !isDriver && (
            <div style={{ marginTop: 12 }}>
              <RateTripModal tripId={id} />
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
                label="Ride type"
                value={trip.rideType === "shared" ? "Shared" : "Private"}
              />
              <Detail
                icon={<Car size={15} color="#0B1E3D" />}
                label="Vehicle"
                value={vLabel}
              />
            </div>
          </div>
        </div>

        {/* Private ride: origin, stops, destination, distance/time breakdown */}
        {trip.rideType === "private" && (
          <PrivateRideDetails
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
                    plate: "",
                  }
                }
              />
            )}
            <div style={{ marginBottom: 16 }}>
              <TripChat tripId={id} role={isDriver ? "driver" : "user"} />
            </div>
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
              Passenger stops
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
                  Passenger {i + 1}
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
          Requested {new Date(trip.createdAt).toLocaleString("en-EG")}
        </p>
      </main>
    </div>
  );
}
