import { MapPin, Users, Clock, Route as RouteIcon } from "lucide-react";
import { RideDetailRow, TripStatBlock } from "@/components/trips/TripDetailParts";
import type { GeoPoint, StationSelection } from "@/types/geo";
import type { StationOption } from "@/lib/services/trips";

interface Props {
  pickup: GeoPoint;
  dropoff: GeoPoint;
  pickupTime: string;
  arrivalTime: string;
  extraPassengers: number;
  pickupStation?: StationSelection;
  dropoffStation?: StationSelection;
  pickupStationOptions: StationOption[];
  dropoffStationOptions: StationOption[];
  walkingMinToStation?: number;
  walkingMinFromStation?: number;
  distanceKm: number;
  durationMinutes: number;
  to12h: (hhmm: string) => string;
  isDriver?: boolean;
}

export default function SharedRideDetails({
  pickup,
  dropoff,
  pickupTime,
  arrivalTime,
  extraPassengers,
  pickupStation,
  dropoffStation,
  pickupStationOptions,
  dropoffStationOptions,
  walkingMinToStation,
  walkingMinFromStation,
  distanceKm,
  durationMinutes,
  to12h,
  isDriver = false,
}: Props) {
  const pickupOpt = pickupStationOptions.find((o) => o.id === pickupStation?.id);
  const dropoffOpt = dropoffStationOptions.find(
    (o) => o.id === dropoffStation?.id,
  );

  const walkToKm = isDriver ? 0 : (pickupOpt?.distanceKm ?? 0);
  const walkToMin = isDriver ? 0 : (pickupOpt?.walkingMin ?? walkingMinToStation ?? 0);
  const walkFromKm = isDriver ? 0 : (dropoffOpt?.distanceKm ?? 0);
  const walkFromMin = isDriver ? 0 : (dropoffOpt?.walkingMin ?? walkingMinFromStation ?? 0);

  const totalKm = isDriver ? distanceKm : (walkToKm + distanceKm + walkFromKm);
  const totalMin = isDriver ? durationMinutes : (walkToMin + durationMinutes + walkFromMin);

  const segLines = isDriver
    ? [
        {
          label: "Ride (station → station)",
          value: `${distanceKm.toFixed(1)} km · ${durationMinutes} min`,
        },
      ]
    : [
        { label: "Walk to station", value: `${walkToKm.toFixed(2)} km · ${walkToMin} min` },
        {
          label: "Ride (station → station)",
          value: `${distanceKm.toFixed(1)} km · ${durationMinutes} min`,
        },
        {
          label: "Walk to destination",
          value: `${walkFromKm.toFixed(2)} km · ${walkFromMin} min`,
        },
      ];

  return (
    <div
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
        Shared ride
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {!isDriver && (
          <RideDetailRow
            icon={<MapPin size={15} />}
            color="#00C2A8"
            headline="Origin"
            value={pickup.address}
          />
        )}
        <RideDetailRow
          icon={<Clock size={15} />}
          color="#00C2A8"
          headline="Pickup time"
          value={to12h(pickupTime)}
        />

        {(pickupStation || isDriver) && (
          <div
            style={
              !isDriver
                ? {
                    borderLeft: "2px dashed #E2E8F0",
                    marginLeft: 7,
                    paddingLeft: 16,
                  }
                : undefined
            }
          >
            <RideDetailRow
              icon={<MapPin size={15} />}
              color="#00C2A8"
              headline="Pickup station"
              value={
                walkToMin && !isDriver
                  ? `${pickupStation?.name ?? "Pickup station"} · ${walkToMin} min walk`
                  : (pickupStation?.name ?? "Pickup station")
              }
            />
          </div>
        )}

        <RideDetailRow
          icon={<Users size={15} />}
          color="#0B1E3D"
          headline="Extra passengers"
          value={`${extraPassengers} extra passenger${extraPassengers === 1 ? "" : "s"}`}
        />

        {(dropoffStation || isDriver) && (
          <div
            style={
              !isDriver
                ? {
                    borderLeft: "2px dashed #E2E8F0",
                    marginLeft: 7,
                    paddingLeft: 16,
                  }
                : undefined
            }
          >
            <RideDetailRow
              icon={<MapPin size={15} />}
              color="#E74C3C"
              headline="Dropoff station"
              value={
                walkFromMin && !isDriver
                  ? `${dropoffStation?.name ?? "Dropoff station"} · ${walkFromMin} min walk`
                  : (dropoffStation?.name ?? "Dropoff station")
              }
            />
          </div>
        )}

        {!isDriver && (
          <RideDetailRow
            icon={<MapPin size={15} />}
            color="#E74C3C"
            headline="Destination"
            value={dropoff.address}
          />
        )}
        <RideDetailRow
          icon={<Clock size={15} />}
          color="#E74C3C"
          headline="Drop-off time"
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
          headline="Total distance"
          value={`${totalKm.toFixed(1)} km`}
          lines={segLines}
        />
        <TripStatBlock
          icon={<Clock size={15} color="#0B1E3D" aria-hidden="true" />}
          headline="Total duration"
          value={`${totalMin} min`}
          lines={segLines}
          accent="#F5A623"
        />
      </div>
    </div>
  );
}
