import { redirect, notFound } from "next/navigation";
import {
  Car,
  MapPin,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getDriverRide } from "@/lib/services/rideService";
import { getUserTrip, getDriverTrip, type UserTripDetail } from "@/lib/services/trips";
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
  TripStatus,
} from "@/types/booking";
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
  const cancellation = (
    trip as UserTripDetail & {
      cancellation?: {
        refundStatus?: "approved" | "rejected" | "pending";
        refundAmount: number;
      };
    }
  ).cancellation;
  const canCancel =
    !isDriver &&
    ["submitted", "matched", "confirmed", "active"].includes(status);
  const canRate = !isDriver && status === "completed";
  const showActionCard =
    (status === "cancelled" && Boolean(cancellation)) || canCancel || canRate;

  return (
    <div dir={localeDirection(locale)} style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader
        authed
        email={session.email}
        role={isDriver ? "driver" : "passenger"}
        variant="app"
        backHref="/my-trips"
      />

      <style>{`
        .trip-detail-shell {
          width: 100%;
          max-width: 720px;
          margin: 0 auto;
          padding: var(--space-32) var(--space-20) var(--space-48);
          box-sizing: border-box;
        }
        .trip-detail-heading {
          display: flex;
          align-items: center;
          gap: var(--space-16);
          margin-bottom: 28px;
        }
        .trip-detail-heading-icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #fff;
          background: #00C2A8;
          border: 3px solid #fff;
          box-shadow: 0 0 0 1px #e8edf0, 0 8px 20px rgba(11,30,61,0.08);
        }
        .trip-detail-heading-copy {
          min-width: 0;
          flex: 1;
        }
        .trip-detail-grid {
          display: flex;
          flex-direction: column;
          gap: var(--space-20);
        }
        .trip-detail-primary,
        .trip-detail-secondary {
          display: flex;
          flex-direction: column;
          gap: var(--space-20);
          min-width: 0;
        }
        .trip-detail-map-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #eef0f3;
          overflow: hidden;
        }
        @media (max-width: 480px) {
          .trip-detail-heading {
            align-items: flex-start;
          }
        }
        @media (min-width: 900px) {
          .trip-detail-shell {
            padding: 44px var(--space-32) 72px;
          }
        }
      `}</style>

      <main className="trip-detail-shell">
        <div className="trip-detail-heading">
          <div className="trip-detail-heading-icon" aria-hidden="true">
            <Car size={28} />
          </div>
          <div className="trip-detail-heading-copy">
            <h1
              style={{
                margin: "0 0 4px",
                fontSize: 22,
                fontWeight: 800,
                lineHeight: 1.2,
                color: "#0B1E3D",
                letterSpacing: "-0.02em",
              }}
            >
              {vLabel}
            </h1>
            <p style={{ margin: "0 0 9px", fontSize: 13, color: "#5A6A7A" }}>
              {translate(locale, "my_trips.ride_number", { rideNumber: trip.tripNumber })} · {formatDate(locale, trip.date)}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
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
              <span aria-hidden="true" style={{ color: "#d0d8e0" }}>·</span>
              <strong style={{ fontSize: 14, color: "#0B1E3D", fontVariantNumeric: "tabular-nums" }}>
                {formatEgp(locale, trip.priceEgp)}
              </strong>
            </div>
            {showActionCard && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {status === "cancelled" && cancellation && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      background:
                        cancellation.refundStatus === "approved"
                          ? "#E8F8F5"
                          : cancellation.refundStatus === "rejected"
                            ? "#FDECEA"
                            : "#FFF3E0",
                      color:
                        cancellation.refundStatus === "approved"
                          ? "#00806E"
                          : cancellation.refundStatus === "rejected"
                            ? "#C0392B"
                            : "#E65100",
                    }}
                  >
                    {cancellation.refundStatus === "approved"
                      ? `Refund Approved (${cancellation.refundAmount} EGP)`
                      : cancellation.refundStatus === "rejected"
                        ? "Refund Rejected"
                        : `Refund Pending Review (${cancellation.refundAmount} EGP)`}
                  </span>
                )}
                {canCancel && (
                  <CancelTripModal
                    tripId={trip.id}
                    tripNumber={trip.tripNumber}
                    date={trip.date}
                    priceEgp={trip.priceEgp}
                    status={trip.status}
                  />
                )}
                {canRate && (
                  <RateTripModal tripId={id} initialRating={trip.rating ?? null} />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="trip-detail-grid">
          {/* Primary Column: Hero, Route Map, Seating, Driver info & Chat */}
          <div className="trip-detail-primary">
            {/* Route map */}
            <div className="trip-detail-map-card">
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
                height={280}
                interactive
              />
            </div>

            {/* Visual 2D Seating Map for Passenger */}
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

            {/* Ongoing trip: driver card + chat */}
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
                  <div>
                    <TripChat tripId={id} role={isDriver ? "driver" : "user"} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Secondary Column: Breakdown, Passenger stops & timestamp */}
          <div className="trip-detail-secondary">
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

            {/* Distinct passenger points (shared rides only) */}
            {trip.rideType === "shared" && distinctPassengers.length > 0 && (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid #eef0f3",
                  padding: "16px 18px",
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
                margin: "12px 0 0",
              }}
            >
              {translate(locale, "my_trips.requested_at").replace(
                "{datetime}",
                new Date(trip.createdAt).toLocaleString("en-EG"),
              )}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
