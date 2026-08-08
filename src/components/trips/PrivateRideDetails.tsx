import { MapPin, Users, Clock, Route as RouteIcon, LogIn, LogOut } from "lucide-react";
import { RideDetailRow, TripStatBlock } from "@/components/trips/TripDetailParts";
import type { GeoPoint } from "@/types/geo";
import { translate, localeDirection, type Locale } from "@/lib/i18n";

interface Stop {
  point: GeoPoint;
  alighting: number;
  boarding: number;
  waitingMinutes: number;
}

interface Props {
  pickup: GeoPoint;
  dropoff: GeoPoint;
  pickupTime: string;
  arrivalTime: string;
  numberOfPassengers: number;
  stops: Stop[];
  distanceKm: number;
  durationMinutes: number;
  to12h: (hhmm: string) => string;
}

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function PrivateRideDetails({
  pickup,
  dropoff,
  pickupTime,
  arrivalTime,
  numberOfPassengers,
  stops,
  distanceKm,
  durationMinutes,
  to12h,
  locale,
}: Props & { locale: Locale }) {
  const chain: GeoPoint[] = [pickup, ...stops.map((s) => s.point), dropoff];
  const segKm = chain.slice(1).map((pt, i) => haversineKm(chain[i], pt));
  const segTotal = segKm.reduce((a, b) => a + b, 0) || 1;
  const pickupLabel = translate(locale, "ride.pickup");
  const dropoffLabel = translate(locale, "ride.dropoff");
  const stopLabel = translate(locale, "ride.station");
  const segLines = segKm.map((km, i) => {
    const from = i === 0 ? pickupLabel : `${stopLabel} ${i}`;
    const to = i === segKm.length - 1 ? dropoffLabel : `${stopLabel} ${i + 1}`;
    const shareKm = (km / segTotal) * distanceKm;
    const shareMin = (km / segTotal) * durationMinutes;
    return {
      label: `${from} → ${to} ${translate(locale, "ride.estimated")}`,
      value: `${shareKm.toFixed(1)} km · ${Math.round(shareMin)} min`,
    };
  });

  return (
    <div
      dir={localeDirection(locale)}
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #eef0f3",
        padding: "16px 18px",
        marginBottom: 16,
      }}
    >
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          fontWeight: 700,
          color: "#0B1E3D",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {translate(locale, "ride.private")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <RideDetailRow
          icon={<MapPin size={15} />}
          color="#00C2A8"
          headline={translate(locale, "ride.origin")}
          value={pickup.address}
        />
        <RideDetailRow
          icon={<Clock size={15} />}
          color="#00C2A8"
          headline={translate(locale, "ride.pickup_time")}
          value={to12h(pickupTime)}
        />

        <RideDetailRow
          icon={<Users size={15} />}
          color="#0B1E3D"
          headline={translate(locale, "ride.total_passengers")}
          value={`${numberOfPassengers} ${translate(locale, numberOfPassengers === 1 ? "my_trips.passenger_singular" : "my_trips.passenger_plural")}`}
        />

        {stops.map((s, i) => (
          <div
            key={i}
            style={{
              borderInlineStart: "2px dashed #E2E8F0",
              marginInlineStart: 7,
              paddingInlineStart: 16,
            }}
          >
            <RideDetailRow
              icon={<MapPin size={15} />}
              color="#F5A623"
              headline={translate(locale, "ride.station")}
              value={s.point.address}
            />
            <div
              style={{
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
                marginTop: 8,
                marginLeft: 25,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  color: "#5A6A7A",
                }}
              >
                <LogOut size={12} aria-hidden="true" />
                {translate(locale, "ride.alighting")}: <strong style={{ color: "#0B1E3D" }}>{s.alighting}</strong>
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  color: "#5A6A7A",
                }}
              >
                <LogIn size={12} aria-hidden="true" />
                {translate(locale, "ride.boarding")}: <strong style={{ color: "#0B1E3D" }}>{s.boarding}</strong>
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  color: "#5A6A7A",
                }}
              >
                <Clock size={12} aria-hidden="true" />
                {translate(locale, "ride.wait")}: <strong style={{ color: "#0B1E3D" }}>{s.waitingMinutes} {translate(locale, "ride.minutes_short")}</strong>
              </span>
            </div>
          </div>
        ))}

        <RideDetailRow
          icon={<MapPin size={15} />}
          color="#E74C3C"
          headline={translate(locale, "ride.destination")}
          value={dropoff.address}
        />
        <RideDetailRow
          icon={<Clock size={15} />}
          color="#E74C3C"
          headline={translate(locale, "ride.dropoff_time")}
          value={to12h(arrivalTime)}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px solid #f4f6f8",
          flexWrap: "wrap",
        }}
      >
        <TripStatBlock
          icon={<RouteIcon size={15} color="#0B1E3D" aria-hidden="true" />}
          headline={translate(locale, "ride.distance_duration")}
          value={`${distanceKm.toFixed(1)} km · ${durationMinutes} ${translate(locale, "ride.minutes_short")}`}
          lines={[
            { label: translate(locale, "ride.distance"), value: `${distanceKm.toFixed(1)} km` },
            { label: translate(locale, "ride.duration"), value: `${durationMinutes} ${translate(locale, "ride.minutes_short")}` },
            ...segLines,
          ]}
          accent="#F5A623"
        />
      </div>
    </div>
  );
}
