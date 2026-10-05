import Link from "next/link";
import { ArrowUpRight, CalendarDays, Car, Clock3, Navigation } from "lucide-react";
import { getDisplayStatus } from "@/lib/statusDisplay.ts";
import { getTripTab } from "@/lib/tripTabs.ts";
import { getCairoPickupAt, getCountdown } from "@/lib/countdown";
import { formatTime, toArabicDigits, translate } from "@/lib/i18n";
import { isSharedVehicle } from "@/lib/geo/stations";
import type { TripListRow } from "@/types/booking";
import NextTripCountdown from "./NextTripCountdown";

function statusTone(tone: ReturnType<typeof getDisplayStatus>["tone"]) {
  return {
    neutral: { background: "#EEF2F2", color: "#526262" },
    warning: { background: "#FFF3E0", color: "#8B4A08" },
    success: { background: "#E5F5EE", color: "#166B48" },
    danger: { background: "#FDECEA", color: "#8F2D28" },
    info: { background: "#E2F8F5", color: "#006D60" },
  }[tone];
}

function formatCompactDate(locale: "en" | "ar", date: string) {
  const formatted = new Date(`${date}T12:00:00`).toLocaleDateString(
    locale === "ar" ? "ar-EG" : "en-EG",
    { weekday: "short", month: "short", day: "numeric" },
  );
  return locale === "ar" ? toArabicDigits(formatted) : formatted;
}

export default function NextTripCard({
  trip,
  pickupName,
  dropoffName,
  locale,
  now = new Date(),
}: {
  trip: TripListRow | null;
  pickupName?: string;
  dropoffName?: string;
  locale: "en" | "ar";
  now?: Date;
}) {
  if (!trip) {
    return (
      <section className="next-trip-empty" aria-labelledby="next-trip-empty-title">
        <div>
          <span className="next-trip-empty-mark" aria-hidden="true"><Car size={19} /></span>
          <div>
            <h2 id="next-trip-empty-title">{translate(locale, "my_trips.next_empty_title")}</h2>
            <p>{translate(locale, "my_trips.next_empty_description")}</p>
          </div>
        </div>
        <Link className="next-trip-action" href="/create">
          {translate(locale, "my_trips.book_trip")}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  const request = {
    status: trip.parentRequestStatus ?? trip.status,
    paymentStatus: trip.parentPaymentStatus ?? trip.paymentStatus,
    rejectionReason: trip.rejectionReason,
    hasPastTrip: trip.hasPastTrip,
  };
  const displayStatus = getDisplayStatus({ request, trip, now });
  const ongoing = getTripTab({ request, trip, now }) === "ongoing";
  const colors = statusTone(displayStatus.tone);
  const shared = isSharedVehicle(trip.vehicleType);
  const href = `/my-trips/${trip.id}`;
  const pickupAt = getCairoPickupAt(trip);
  const initialCountdown = pickupAt ? getCountdown({ pickupAt, now }) : null;
  const elapsedMinutes =
    ongoing && initialCountdown?.state === "reached" && pickupAt
      ? Math.floor(Math.max(0, now.getTime() - Date.parse(pickupAt)) / 60_000)
      : null;
  const elapsedLabel =
    elapsedMinutes === null
      ? null
      : translate(
          locale,
          elapsedMinutes >= 60 ? "my_trips.elapsed_hours" : "my_trips.elapsed_minutes",
          elapsedMinutes >= 60
            ? { hours: Math.floor(elapsedMinutes / 60), minutes: elapsedMinutes % 60 }
            : { minutes: elapsedMinutes },
        );

  return (
    <section className="next-trip-card" aria-labelledby="next-trip-title">
      <header className="next-trip-header">
        <div className="next-trip-heading-group">
          <h2 id="next-trip-title" className="next-trip-heading">
            <span className={`next-trip-heading-dot${ongoing ? " is-live" : ""}`} aria-hidden="true" />
            {ongoing ? (
              <NextTripCountdown
                pickupAt={pickupAt ?? ""}
                initialCountdown={initialCountdown}
                locale={locale}
                ongoing
              />
            ) : (
              translate(locale, "my_trips.next_trip")
            )}
          </h2>
          <span className="next-trip-type">
            {translate(locale, shared ? "ride.shared" : "ride.private")}
          </span>
        </div>
        <span className="next-trip-status" style={colors}>
          <span className="next-trip-status-dot" aria-hidden="true" />
          {translate(locale, displayStatus.key)}
        </span>
      </header>

      <div className="next-trip-summary">
        {!ongoing && (
          <div className="next-trip-countdown-area">
            <NextTripCountdown
              pickupAt={pickupAt ?? ""}
              initialCountdown={initialCountdown}
              locale={locale}
              ongoing={false}
            />
          </div>
        )}
        <p className="next-trip-date">
          <CalendarDays size={16} aria-hidden="true" />
          <span>{formatCompactDate(locale, trip.date)}</span>
          <span aria-hidden="true"> · </span>
          <span>{formatTime(locale, trip.pickupTime)}</span>
        </p>
        {elapsedLabel && (
          <p className="next-trip-elapsed">
            <Clock3 size={14} aria-hidden="true" />
            <span>{elapsedLabel}</span>
          </p>
        )}
      </div>

      <div className="next-trip-route-column">
        <div className="next-trip-route">
          <div className="next-trip-route-rail" aria-hidden="true">
            <span className="next-trip-dot pickup" />
            <span className="next-trip-route-line" />
            <span className="next-trip-dot dropoff" />
          </div>
          <div className="next-trip-stations">
            <p>
              <span>{translate(locale, "ride.origin")}</span>
              <strong dir="auto">{pickupName || trip.pickupAddress}</strong>
            </p>
            <p>
              <span>{translate(locale, "ride.destination")}</span>
              <strong dir="auto">{dropoffName || trip.dropoffAddress}</strong>
            </p>
          </div>
        </div>
        {trip.status === "matched" && (
          <div className="next-trip-driver">
            <Car size={15} aria-hidden="true" />
            <span>{trip.assignedDriver?.name || translate(locale, "my_trips.driver_fallback")}</span>
            {(trip.assignedDriver?.carBrand || trip.assignedDriver?.carModel) && (
              <span className="next-trip-vehicle">
                {[trip.assignedDriver?.carBrand, trip.assignedDriver?.carModel].filter(Boolean).join(" ")}
              </span>
            )}
          </div>
        )}
      </div>

      <footer className="next-trip-footer">
        <span className="next-trip-vehicle-name">{translate(locale, `vehicles.${trip.vehicleType}`)}</span>
        <Link className="next-trip-action" href={href} aria-label={`${translate(locale, ongoing ? "my_trips.track_trip" : "my_trips.view_trip")}: ${trip.pickupAddress} to ${trip.dropoffAddress}`}>
          {translate(locale, ongoing ? "my_trips.track_short" : "my_trips.view_trip")}
          {ongoing ? <Navigation size={16} aria-hidden="true" /> : <ArrowUpRight size={16} aria-hidden="true" />}
        </Link>
      </footer>
    </section>
  );
}