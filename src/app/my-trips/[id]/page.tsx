import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  Car,
  MapPin,
  Clock,
  Users,
  Star,
  CreditCard,
  Wallet,
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
import ContinueCheckoutButton from "@/components/shared/ContinueCheckoutButton";
import VehicleSeatMap from "@/components/trips/VehicleSeatMap";
import MatchedTripCountdown from "@/components/trips/MatchedTripCountdown";
import { getOrCreateWallet } from "@/lib/wallet/wallet";
import { getDisplayStatus, getRejectionDisplay } from "@/lib/statusDisplay.ts";
import { getSharedRideStep } from "@/lib/sharedRideStepper.ts";
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

function TripActions({
  trip,
  displayStatus,
  walletBalance,
  isDriver,
}: {
  trip: UserTripDetail;
  displayStatus: ReturnType<typeof getDisplayStatus>;
  walletBalance: number;
  isDriver: boolean;
}) {
  if (isDriver) return null;
  if (displayStatus.canPay) {
    return (
      <ContinueCheckoutButton
        bookingId={trip.requestId}
        amountEgp={trip.requestAmountEgp ?? trip.priceEgp}
        walletBalance={walletBalance}
      />
    );
  }
  if (displayStatus.canCancel) {
    return (
      <CancelTripModal
        tripId={trip.id}
        tripNumber={trip.tripNumber}
        date={trip.date}
        priceEgp={trip.priceEgp}
        status={trip.status}
      />
    );
  }
  if (displayStatus.canRate) {
    return <RateTripModal tripId={trip.id} initialRating={trip.rating ?? null} />;
  }
  return null;
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
    : await getUserTrip(session.userId, id, true);

  if (!trip) notFound();

  const otherTrips = trip.otherTrips ?? [];
  const vLabel = translate(locale, `vehicles.${trip.vehicleType}`);
  const paymentStatus = (trip.paymentStatus as PaymentStatus) ?? "pending";
  const status = (trip.status as TripStatus) ?? "pending_payment";
  const parentPaymentStatus = trip.parentPaymentStatus ?? paymentStatus;
  const displayStatus = getDisplayStatus({
    request: {
      status: trip.parentRequestStatus ?? status,
      paymentStatus: parentPaymentStatus,
      hasPastTrip: trip.hasPastTrip,
      rejectionReason: trip.rejectionReason,
    },
    trip,
  });
  const rejectionDisplay = getRejectionDisplay({
    request: {
      status: trip.parentRequestStatus ?? status,
      rejectionReason: trip.rejectionReason,
    },
    trip,
  });
  const reviewedDate = trip.reviewedAt ? new Date(trip.reviewedAt) : null;
  const reviewedDateLabel =
    reviewedDate && !Number.isNaN(reviewedDate.getTime())
      ? reviewedDate.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-EG", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;
  const checkoutWallet =
    !isDriver && displayStatus.canPay
      ? await getOrCreateWallet(session.userId)
      : null;
  const isOngoing =
    !rejectionDisplay.showReasonCard &&
    (displayStatus.key === "status.in_progress" || displayStatus.key === "status.matched");
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
  const showRefundBadge =
    !rejectionDisplay.showReasonCard &&
    displayStatus.key !== "status.expired" &&
    displayStatus.showRefundBadge;
  const sharedStepper = getSharedRideStep({
    request: {
      status: trip.parentRequestStatus ?? status,
      paymentStatus: parentPaymentStatus,
      rejectionReason: trip.rejectionReason,
      hasPastTrip: trip.hasPastTrip,
    },
    trip,
  });
  const hasPrimaryAction =
    !rejectionDisplay.showReasonCard &&
    (displayStatus.canPay || displayStatus.canCancel || displayStatus.canRate);
  const paymentBreakdown = trip.paymentBreakdown;

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
          max-width: 1200px;
          margin: 0 auto;
          padding: var(--space-24) var(--space-16) calc(96px + env(safe-area-inset-bottom));
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
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
          display: grid;
          grid-template-columns: minmax(0, 1fr);
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
        .trip-summary-card, .trip-route-card, .trip-stepper-card {
          background: #fff;
          border: 1px solid #DCE6E4;
          border-radius: 8px;
          padding: var(--space-16);
        }
        .trip-expandable-details { overflow: hidden; border: 1px solid #DCE6E4; border-radius: 8px; background: #fff; }
        .trip-expandable-details > summary { padding: 13px 16px; color: #006D60; font-size: 13px; font-weight: 800; cursor: pointer; }
        .trip-expandable-details > summary:focus-visible { outline: 3px solid #F5A623; outline-offset: -3px; }
        .trip-expandable-content { padding: 0 12px 12px; }
        .trip-summary-card { display: grid; gap: var(--space-12); }
        .trip-summary-label { margin: 0; color: #526262; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        .trip-summary-price { margin: 0; color: #0B1E3D; font-size: 24px; font-weight: 800; }
        .trip-route-timeline { display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 10px; }
        .trip-route-rail { display: flex; flex-direction: column; align-items: center; padding: 4px 0; }
        .trip-route-point { width: 10px; height: 10px; flex: 0 0 10px; border: 2px solid #007A6A; border-radius: 50%; background: #fff; }
        .trip-route-point.end { border-color: #D46A32; }
        .trip-route-line { width: 2px; min-height: 42px; flex: 1; background: #C9DCD6; }
        .trip-route-stops { display: grid; gap: 12px; }
        .trip-route-stop { display: grid; gap: 4px; min-width: 0; padding: 10px; border-radius: 6px; background: #F7FAF9; }
        .trip-route-stop.boarding { border-inline-start: 3px solid #F5A623; background: #FFFAF0; }
        .trip-route-stop strong { overflow-wrap: anywhere; color: #173337; font-size: 14px; }
        .trip-route-stop span { color: #526262; font-size: 12px; }
        .trip-detail-desktop-actions { display: none; }
        .trip-secondary-details { display: none; }
        .trip-detail-mobile-actions {
          position: fixed;
          inset-inline: 0;
          bottom: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
          border-top: 1px solid #DCE6E4;
          background: rgba(255,255,255,.97);
          box-shadow: 0 -6px 18px rgba(11,30,61,.08);
        }
        .trip-detail-mobile-actions > * { flex: 1; }
        .trip-summary-actions > * { width: 100%; }
        .trip-detail-mobile-actions > * { min-width: 0; }
        .trip-action-wrap :is(button, a) { width: 100%; min-height: 44px; }
        .trip-action-wrap :is(button, a):focus-visible, .trip-sibling-link:focus-visible,
        .trip-rejection-card a:focus-visible, .trip-expandable-details > summary:focus-visible,
        .trip-price-breakdown > summary:focus-visible {
          outline: 3px solid #F5A623;
          outline-offset: 3px;
        }
        .trip-sibling-link { display: block; padding: 8px; border: 1px solid #D7E5E2; border-radius: 5px; color: #0B1E3D; font-size: 12px; text-decoration: none; text-align: center; }
        .trip-price-breakdown { padding-top: 10px; border-top: 1px solid #EEF2F2; }
        .trip-price-breakdown > summary, .trip-expandable-details > summary { cursor: pointer; color: #006D60; font-size: 12px; font-weight: 800; }
        .trip-price-line { display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; color: #526262; font-size: 12px; }
        .trip-rejection-card { margin-bottom: 20px; }
        .trip-shared-stepper { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
        .trip-shared-step { display: grid; align-content: start; gap: 6px; min-width: 0; color: #647575; font-size: 10px; line-height: 1.3; }
        .trip-shared-step-mark { display: grid; place-items: center; width: 24px; height: 24px; border: 1px solid #B9CBC6; border-radius: 50%; color: #526262; font-size: 11px; font-weight: 800; }
        .trip-shared-step.current { color: #006D60; font-weight: 800; }
        .trip-shared-step.current .trip-shared-step-mark { border-color: #007A6A; background: #E8F4F1; color: #006D60; }
        .trip-shared-step.rejected { color: #8F2D28; }
        .trip-shared-step.rejected .trip-shared-step-mark { border-color: #C0392B; background: #FDECEA; color: #8F2D28; }
        @media (max-width: 480px) {
          .trip-detail-heading {
            align-items: flex-start;
          }
        }
        @media (min-width: 900px) {
          .trip-detail-shell {
            padding: 40px var(--space-32) 72px;
          }
          .trip-detail-grid { grid-template-columns: minmax(0, 1fr) 340px; align-items: start; }
          .trip-detail-secondary { position: sticky; top: var(--app-header-offset); }
          .trip-detail-desktop-actions { display: flex; flex-direction: column; gap: 10px; }
          .trip-detail-mobile-actions { display: none; }
        }
      `}</style>

      <main className="trip-detail-shell">
        {rejectionDisplay.showReasonCard && (
          <section
            className="trip-rejection-card"
            aria-labelledby="rejection-title"
            style={{
              marginBottom: 24,
              padding: "18px 20px",
              border: "1px solid #EBC7C4",
              borderInlineStart: "4px solid #C0392B",
              borderRadius: 8,
              background: "#FFF8F7",
            }}
          >
            <h2 id="rejection-title" style={{ margin: "0 0 8px", color: "#8F2D28", fontSize: 18, fontWeight: 800 }}>
              {translate(locale, "rejection.title")}
            </h2>
            <p style={{ margin: 0, color: "#402B2A", fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {rejectionDisplay.reason ?? translate(locale, "rejection.no_reason")}
            </p>
            {reviewedDateLabel && (
              <p style={{ margin: "8px 0 0", color: "#6E5B59", fontSize: 12 }}>
                {translate(locale, "rejection.reviewed_date", { date: reviewedDateLabel })}
              </p>
            )}
            <Link
              href="/create"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 14,
                minHeight: 40,
                padding: "0 16px",
                borderRadius: 6,
                background: "#0B1E3D",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {translate(locale, "rejection.book_again")}
            </Link>
          </section>
        )}

        <div className="trip-detail-heading">
          <div className="trip-detail-heading-icon" aria-hidden="true">
            <Car size={28} />
          </div>
          <div className="trip-detail-heading-copy">
            <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, lineHeight: 1.2, color: "#0B1E3D" }}>
              {vLabel}
            </h1>
            <p style={{ margin: "0 0 9px", fontSize: 13, color: "#5A6A7A" }}>
              {translate(locale, "my_trips.ride_number", { n: trip.tripNumber })} · {formatDate(locale, trip.date)}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Pill label={translate(locale, trip.rideType === "shared" ? "ride.shared" : "ride.private")} bg="#EEF2F2" color="#405555" />
              <Pill
                label={translate(locale, displayStatus.key)}
                bg={{ neutral: "#EEF2F2", warning: "#FFF3E0", success: "#E8F5E9", danger: "#FFEBEE", info: "#E2F8F5" }[displayStatus.tone]}
                color={{ neutral: "#526262", warning: "#E65100", success: "#166B48", danger: "#8F2D28", info: "#006D60" }[displayStatus.tone]}
              />
              <strong style={{ fontSize: 14, color: "#0B1E3D", fontVariantNumeric: "tabular-nums" }}>
                {formatEgp(locale, trip.priceEgp)}
              </strong>
            </div>
            {!rejectionDisplay.showReasonCard &&
              (displayStatus.secondaryKey || displayStatus.secondaryText) && (
                <p style={{ margin: "8px 0 0", color: "#526262", fontSize: 12, lineHeight: 1.5 }}>
                  {displayStatus.secondaryKey
                    ? translate(locale, displayStatus.secondaryKey)
                    : displayStatus.secondaryText}
                </p>
              )}
          </div>
        </div>

        <div className="trip-detail-grid" style={rejectionDisplay.showReasonCard ? { opacity: 0.68 } : undefined}>
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

            <section className="trip-route-card" aria-labelledby="trip-route-title">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <h2 id="trip-route-title" style={{ margin: 0, color: "#173337", fontSize: 16, fontWeight: 800 }}>
                  {translate(locale, trip.rideType === "shared" ? "trip_detail.shared_route" : "trip_detail.route")}
                </h2>
                {displayStatus.key === "status.matched" && (
                  <MatchedTripCountdown date={trip.date} pickupTime={trip.pickupTime} locale={locale} />
                )}
              </div>
              <div className="trip-route-timeline">
                <div className="trip-route-rail" aria-hidden="true">
                  <span className="trip-route-point" />
                  <span className="trip-route-line" />
                  <span className="trip-route-point end" />
                </div>
                <div className="trip-route-stops">
                  <div className={`trip-route-stop${trip.rideType === "shared" ? " boarding" : ""}`}>
                    <span style={{ color: "#526262", fontSize: 11, fontWeight: 700 }}>
                      {translate(locale, trip.rideType === "shared" ? "ride.pickup_station_label" : "ride.pickup")}
                    </span>
                    <strong>{trip.rideType === "shared" ? trip.pickupStation?.name ?? trip.pickup.address : trip.pickup.address}</strong>
                    <span style={trip.rideType === "shared" ? { color: "#7A4A05", fontWeight: 800 } : undefined}>
                      {translate(locale, trip.rideType === "shared" ? "ride.board_by" : "ride.pickup_time")} · {formatTime(locale, trip.pickupTime)}
                    </span>
                  </div>
                  <div className="trip-route-stop">
                    <span style={{ color: "#526262", fontSize: 11, fontWeight: 700 }}>
                      {translate(locale, trip.rideType === "shared" ? "ride.dropoff_station_label" : "ride.destination")}
                    </span>
                    <strong>{trip.rideType === "shared" ? trip.dropoffStation?.name ?? trip.dropoff.address : trip.dropoff.address}</strong>
                    <span>
                      {translate(locale, trip.rideType === "shared" ? "ride.arrive_by" : "ride.dropoff_time")} · {formatTime(locale, trip.arrivalTime)}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {trip.rideType === "private" && (
              <details className="trip-expandable-details">
                <summary>{translate(locale, "trip_detail.private_details")}</summary>
                <div className="trip-expandable-content">
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
                    showDistanceBreakdown={false}
                  />
                </div>
              </details>
            )}
            {trip.rideType === "shared" && (
              <details className="trip-expandable-details">
                <summary>{translate(locale, "trip_detail.shared_details")}</summary>
                <div className="trip-expandable-content">
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
                    showDistanceBreakdown={false}
                  />
                </div>
              </details>
            )}

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

            {!isDriver && trip.rideType === "private" && trip.assignedDriver && (
              <DriverCard
                driver={{ ...trip.assignedDriver, rating: trip.rating }}
                showCall={isOngoing && Boolean(trip.assignedDriver.phone)}
              />
            )}
            {isOngoing && Boolean(trip.assignedDriver || trip.rideId) && (
              <TripChat tripId={id} role={isDriver ? "driver" : "user"} />
            )}
          </div>

          {/* Secondary Column: Breakdown, Passenger stops & timestamp */}
          <div className="trip-detail-secondary">
            <aside className="trip-summary-card" aria-labelledby="trip-summary-title">
              <h2 id="trip-summary-title" style={{ margin: 0, color: "#173337", fontSize: 16, fontWeight: 800 }}>
                {translate(locale, "trip_detail.summary")}
              </h2>
              <div>
                <p className="trip-summary-label">{translate(locale, "trip_detail.status")}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 7 }}>
                  <Pill
                    label={translate(locale, displayStatus.key)}
                    bg={{ neutral: "#EEF2F2", warning: "#FFF3E0", success: "#E8F5E9", danger: "#FFEBEE", info: "#E2F8F5" }[displayStatus.tone]}
                    color={{ neutral: "#526262", warning: "#8B4A08", success: "#166B48", danger: "#8F2D28", info: "#006D60" }[displayStatus.tone]}
                  />
                  {!rejectionDisplay.showReasonCard && trip.parentRequestStatus !== "waiting_list" && (
                    <Pill
                      label={translate(locale, `payments.${parentPaymentStatus}`)}
                      bg={PAY_PILL[parentPaymentStatus]?.bg ?? PAY_PILL.pending.bg}
                      color={PAY_PILL[parentPaymentStatus]?.color ?? PAY_PILL.pending.color}
                    />
                  )}
                </div>
              </div>

              <div>
                <p className="trip-summary-label">{translate(locale, "trip_detail.trip_price")}</p>
                <p className="trip-summary-price">{formatEgp(locale, trip.priceEgp)}</p>
                {trip.requestAmountEgp !== undefined && trip.requestAmountEgp !== trip.priceEgp && (
                  <p style={{ margin: "4px 0 0", color: "#526262", fontSize: 12 }}>
                    {translate(locale, "my_trips.request_total")}: {formatEgp(locale, trip.requestAmountEgp)}
                  </p>
                )}
              </div>

              <details className="trip-price-breakdown">
                <summary>{translate(locale, "trip_detail.price_breakdown")}</summary>
                <div className="trip-price-line">
                  <span>{translate(locale, "my_trips.trip_fare")}</span>
                  <strong>{formatEgp(locale, trip.priceEgp)}</strong>
                </div>
                {trip.requestAmountEgp !== undefined && trip.requestAmountEgp !== trip.priceEgp && (
                  <div className="trip-price-line">
                    <span>{translate(locale, "my_trips.request_total")}</span>
                    <strong>{formatEgp(locale, trip.requestAmountEgp)}</strong>
                  </div>
                )}
              </details>

              {paymentBreakdown && (paymentBreakdown.walletAmountEgp > 0 || paymentBreakdown.gatewayAmountEgp > 0) && (
                <div className="trip-payment-method" aria-label={translate(locale, "trip_detail.payment_method")}>
                  <p className="trip-summary-label">{translate(locale, "trip_detail.payment_method")}</p>
                  <div style={{ display: "grid", gap: 5, marginTop: 6, color: "#405555", fontSize: 12 }}>
                    {paymentBreakdown.walletAmountEgp > 0 && (
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Wallet size={14} aria-hidden="true" /> {translate(locale, "trip_detail.wallet_part")}: {formatEgp(locale, paymentBreakdown.walletAmountEgp)}
                      </span>
                    )}
                    {paymentBreakdown.gatewayAmountEgp > 0 && (
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <CreditCard size={14} aria-hidden="true" /> {translate(locale, "trip_detail.gateway_part")}: {formatEgp(locale, paymentBreakdown.gatewayAmountEgp)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {showRefundBadge && cancellation && (
                <div role="status" style={{ padding: "9px 10px", borderRadius: 6, background: "#FFF8E9", color: "#71470D", fontSize: 12, fontWeight: 700 }}>
                  {cancellation.refundStatus === "approved"
                    ? `${translate(locale, "payments.refunded")} · ${formatEgp(locale, cancellation.refundAmount)}`
                    : cancellation.refundStatus === "rejected"
                      ? translate(locale, "trip_detail.refund_rejected")
                      : translate(locale, "trip_detail.refund_pending")}
                </div>
              )}

              {trip.rideType === "shared" && sharedStepper.step !== null && (
                <div className="trip-stepper-card" style={{ padding: 12 }}>
                  <p className="trip-summary-label" style={{ marginBottom: 10 }}>{translate(locale, "trip_detail.shared_progress")}</p>
                  <ol className="trip-shared-stepper" aria-label={translate(locale, "trip_detail.shared_progress")}>
                    {[
                      "trip_detail.step_request_sent",
                      "trip_detail.step_admin_review",
                      "trip_detail.step_payment",
                      "trip_detail.step_matched",
                    ].map((key, index) => (
                      <li
                        key={key}
                        className={`trip-shared-step${sharedStepper.step === index ? " current" : ""}${sharedStepper.rejected && index === 1 ? " rejected" : ""}`}
                        aria-current={sharedStepper.step === index ? "step" : undefined}
                      >
                        <span className="trip-shared-step-mark" aria-hidden="true">
                          {sharedStepper.rejected && index === 1 ? "×" : index + 1}
                        </span>
                        <span>{translate(locale, key)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {trip.rideType === "shared" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#526262", fontSize: 12 }}>
                  <Users size={15} aria-hidden="true" />
                  <span>{translate(locale, "trip_detail.passengers_count", { count: trip.numberOfPassengers })}</span>
                  {trip.seatNumbers && trip.seatNumbers.length > 0 && (
                    <span>{translate(locale, "trip_detail.seats", { seats: trip.seatNumbers.join(", ") })}</span>
                  )}
                </div>
              )}

              {trip.rideType === "shared" && otherTrips.length > 0 && (
                <div>
                  <p className="trip-summary-label" style={{ marginBottom: 8 }}>{translate(locale, "my_trips.other_dates_in_booking")}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 6 }}>
                    {otherTrips.map((otherTrip) => (
                      <Link key={otherTrip.id} href={`/my-trips/${otherTrip.id}`} className="trip-sibling-link">
                        {formatDate(locale, otherTrip.date)}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="trip-detail-desktop-actions">
                <TripActions trip={trip} displayStatus={displayStatus} walletBalance={checkoutWallet?.balanceEgp ?? 0} isDriver={isDriver} />
              </div>
            </aside>

            {/* Private ride: origin, stops, destination, distance/time breakdown */}
            {trip.rideType === "private" && (
              <div className="trip-secondary-details">
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
                showDistanceBreakdown={!rejectionDisplay.showReasonCard}
              />
              </div>
            )}

            {/* Shared ride: origin/station, destination/station, distance/time breakdown */}
            {trip.rideType === "shared" && (
              <div className="trip-secondary-details">
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
                showDistanceBreakdown={!rejectionDisplay.showReasonCard}
              />
              </div>
            )}

            {/* Distinct passenger points (shared rides only) */}
            {trip.rideType === "shared" && distinctPassengers.length > 0 && (
              <div className="trip-secondary-details"
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

            <p className="trip-secondary-details"
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
        {hasPrimaryAction && !isDriver && (
          <div className="trip-detail-mobile-actions" aria-label={translate(locale, "trip_detail.actions")}>
            <div className="trip-action-wrap">
              <TripActions
                trip={trip}
                displayStatus={displayStatus}
                walletBalance={checkoutWallet?.balanceEgp ?? 0}
                isDriver={isDriver}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
