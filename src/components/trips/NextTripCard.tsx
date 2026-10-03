import Link from "next/link";
import { ArrowUpRight, Car, Navigation } from "lucide-react";
import { getDisplayStatus } from "@/lib/statusDisplay.ts";
import { getTripTab } from "@/lib/tripTabs.ts";
import { getCairoNowParts, getMinutesUntilPickup } from "@/lib/time/cairoTime.ts";
import { formatDate, formatTime, translate } from "@/lib/i18n";
import { isSharedVehicle } from "@/lib/geo/stations";
import type { TripListRow } from "@/types/booking";

function statusTone(tone: ReturnType<typeof getDisplayStatus>["tone"]) {
  return {
    neutral: { background: "#EEF2F2", color: "#526262" },
    warning: { background: "#FFF3E0", color: "#8B4A08" },
    success: { background: "#E5F5EE", color: "#166B48" },
    danger: { background: "#FDECEA", color: "#8F2D28" },
    info: { background: "#E2F8F5", color: "#006D60" },
  }[tone];
}

function pickupRelativeLabel(
  trip: TripListRow,
  locale: "en" | "ar",
  now: Date,
) {
  const minutes = getMinutesUntilPickup(trip, now);
  const localToday = getCairoNowParts(now).dateStr;
  const tomorrowDate = new Date(`${localToday}T00:00:00Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  const time = formatTime(locale, trip.pickupTime);

  if (trip.date === tomorrow) {
    return translate(locale, "my_trips.tomorrow_at", { time });
  }
  if (minutes >= 1440) {
    return translate(locale, "my_trips.in_days_at", {
      days: Math.floor(minutes / 1440),
      time,
    });
  }
  if (minutes < 60) {
    return translate(locale, "my_trips.in_minutes", { minutes });
  }
  return translate(locale, "my_trips.in_hours", {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60,
  });
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

  return (
    <section className="next-trip-card" aria-labelledby="next-trip-title">
      <div className="next-trip-main">
        <div className="next-trip-meta">
          <p className="next-trip-eyebrow">
            {translate(locale, ongoing ? "my_trips.live_now" : "my_trips.next_trip")}
          </p>
          <span className="next-trip-type">
            {translate(locale, shared ? "ride.shared" : "ride.private")}
          </span>
        </div>

        <h2 id="next-trip-title" className="next-trip-relative-time">
          {ongoing ? formatTime(locale, trip.pickupTime) : pickupRelativeLabel(trip, locale, now)}
        </h2>
        <p className="next-trip-date">{formatDate(locale, trip.date)}</p>

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

      <aside className="next-trip-aside">
        <span className="next-trip-status" style={colors}>
          <span className="next-trip-status-dot" aria-hidden="true" />
          {translate(locale, displayStatus.key)}
        </span>
        <span className="next-trip-vehicle-name">{translate(locale, `vehicles.${trip.vehicleType}`)}</span>
        <Link className="next-trip-action" href={href} aria-label={`${translate(locale, ongoing ? "my_trips.track_trip" : "my_trips.view_trip")}: ${trip.pickupAddress} to ${trip.dropoffAddress}`}>
          {translate(locale, ongoing ? "my_trips.track_trip" : "my_trips.view_trip")}
          {ongoing ? <Navigation size={16} aria-hidden="true" /> : <ArrowUpRight size={16} aria-hidden="true" />}
        </Link>
      </aside>
    </section>
  );
}