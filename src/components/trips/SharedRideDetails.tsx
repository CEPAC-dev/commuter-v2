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

      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            display: "grid",
            gap: 14,
            padding: "16px",
            borderRadius: 20,
            background: "#fff",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
            border: "1px solid #eef0f3",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "#5A6A7A",
                  letterSpacing: "0.14em",
                }}
              >
                Pickup
              </p>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#0B1E3D",
                }}
              >
                {pickupStation ? pickupStation.name : pickup.address}
              </p>
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#007A5F",
                background: "rgba(0,194,168,0.12)",
                borderRadius: 9999,
                padding: "6px 12px",
              }}
            >
              +{extraPassengers} passenger{extraPassengers === 1 ? "" : "s"}
            </span>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {!isDriver && pickup.address && (
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
              headline="Board by"
              value={to12h(pickupTime)}
            />
            {(pickupStation || isDriver) && !pickupStation?.name && (
              <RideDetailRow
                icon={<MapPin size={15} />}
                color="#00C2A8"
                headline="Station"
                value={pickupStation?.name ?? "Pickup station"}
              />
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            padding: "16px",
            borderRadius: 20,
            background: "#fff",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
            border: "1px solid #eef0f3",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              color: "#5A6A7A",
              letterSpacing: "0.14em",
            }}
          >
            Dropoff
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {(dropoffStation || isDriver) && (
              <RideDetailRow
                icon={<MapPin size={15} />}
                color="#E74C3C"
                headline="Station"
                value={dropoffStation?.name ?? "Dropoff station"}
              />
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
              headline="Arrive by"
              value={to12h(arrivalTime)}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          paddingTop: 18,
          borderTop: "1px solid #eef0f3",
        }}
      >
        <TripStatBlock
          icon={<RouteIcon size={15} color="#0B1E3D" aria-hidden="true" />}
          headline="Distance & duration"
          value={`${totalKm.toFixed(1)} km · ${totalMin} min`}
          lines={[
            { label: "Distance", value: `${totalKm.toFixed(1)} km` },
            { label: "Duration", value: `${totalMin} min` },
            ...segLines,
          ]}
          accent="#F5A623"
        />
      </div>
    </div>
  );
}
