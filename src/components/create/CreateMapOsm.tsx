"use client";

import { useCallback, useEffect, useState } from "react";
import L from "leaflet";
import type { TripData } from "./TripCycle";
import type { TripPoint } from "@/lib/store/useTripStore";
import { isSharedVehicle } from "@/lib/geo/stations";
import { formatDisplayName, reverseGeocode } from "@/lib/nominatim";
import OsmMapCanvas, { type OsmPoint } from "@/components/map/OsmMapCanvas";
import { fitPoints, svgIcon } from "@/components/map/leafletLayers";

const CAIRO = { lat: 30.0444, lng: 31.2357 };
const ROUTE_COLORS = ["#4361EE", "#F5A623", "#00C2A8"];
const ORIGIN_ICON = svgIcon(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="16" fill="#0B1E3D" stroke="#00C2A8" stroke-width="3"/><circle cx="18" cy="18" r="6" fill="#fff"/></svg>`,
  36,
  36,
  [18, 18],
);
const DEST_ICON = svgIcon(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48"><path d="M18 0C8.06 0 0 8.06 0 18c0 13.05 18 32.4 18 32.4S36 31.05 36 18C36 8.06 27.94 0 18 0z" fill="#00C2A8"/><circle cx="18" cy="18" r="8" fill="#fff"/><circle cx="18" cy="18" r="4.5" fill="#0B1E3D"/></svg>`,
  36,
  48,
);
const STATION_ICON = svgIcon(
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="10" fill="#F5A623" stroke="#0B1E3D" stroke-width="1.5"/><text x="11" y="15" text-anchor="middle" font-family="Arial" font-size="9" font-weight="700" fill="#0B1E3D">S</text></svg>`,
  22,
  22,
  [11, 11],
);
const DIMMED_STATION_ICON = svgIcon(
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" opacity=".42"><circle cx="11" cy="11" r="10" fill="#F5A623" stroke="#0B1E3D" stroke-width="1.5"/><text x="11" y="15" text-anchor="middle" font-family="Arial" font-size="9" font-weight="700" fill="#0B1E3D">S</text></svg>`,
  22,
  22,
  [11, 11],
);

function stopIcon(index: number) {
  return svgIcon(
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="36"><path d="M15 1C7.27 1 1 7.27 1 15c0 10.25 14 20 14 20s14-9.75 14-20C29 7.27 22.73 1 15 1z" fill="#F5A623" stroke="#0B1E3D" stroke-width="1.5"/><text x="15" y="19" text-anchor="middle" font-family="Arial" font-size="12" font-weight="700" fill="#0B1E3D">${index + 1}</text></svg>`,
    30,
    36,
  );
}

interface Props {
  trips: TripData[];
  picking?: { tripId: string; field: "pickup" | "dropoff" } | null;
  onMapPick?: (point: TripPoint) => void;
  onCancelPick?: () => void;
}

export default function CreateMapOsm({
  trips,
  picking,
  onMapPick,
  onCancelPick,
}: Props) {
  const [map, setMap] = useState<L.Map | null>(null);

  useEffect(() => {
    if (!map) return;
    const layers = L.layerGroup().addTo(map);
    const allPoints: OsmPoint[] = [];
    trips.forEach((trip, index) => {
      const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
      const shared = isSharedVehicle(trip.vehicleType);
      if (trip.routeCoordinates?.length) {
        const route = trip.routeCoordinates.map(
          ([lat, lng]) => [lat, lng] as L.LatLngTuple,
        );
        L.polyline(route, { color, weight: 14, opacity: 0.15 }).addTo(layers);
        L.polyline(route, { color, weight: 5, opacity: 0.9 }).addTo(layers);
        allPoints.push(
          ...trip.routeCoordinates.map(([lat, lng]) => ({ lat, lng })),
        );
      }
      if (trip.pickup) {
        L.marker([trip.pickup.lat, trip.pickup.lng], { icon: ORIGIN_ICON })
          .bindTooltip(`Trip ${index + 1} pickup`)
          .addTo(layers);
        allPoints.push(trip.pickup);
      }
      if (trip.dropoff) {
        L.marker([trip.dropoff.lat, trip.dropoff.lng], { icon: DEST_ICON })
          .bindTooltip(`Trip ${index + 1} dropoff`)
          .addTo(layers);
        allPoints.push(trip.dropoff);
      }
      if (!shared)
        trip.stops.forEach((stop, stopIndex) => {
          if (stop.point) {
            L.marker([stop.point.lat, stop.point.lng], {
              icon: stopIcon(stopIndex),
            })
              .bindTooltip(`Trip ${index + 1}, stop ${stopIndex + 1}`)
              .addTo(layers);
            allPoints.push(stop.point);
          }
        });
      if (shared) {
        trip.pickupStationOptions.forEach((station) => {
          L.marker([station.lat, station.lng], {
            icon:
              station.id === trip.pickupStation?.id
                ? STATION_ICON
                : DIMMED_STATION_ICON,
          })
            .bindTooltip(`Pickup station: ${station.name}`)
            .addTo(layers);
          allPoints.push(station);
        });
        trip.dropoffStationOptions.forEach((station) => {
          L.marker([station.lat, station.lng], {
            icon:
              station.id === trip.dropoffStation?.id
                ? STATION_ICON
                : DIMMED_STATION_ICON,
          })
            .bindTooltip(`Dropoff station: ${station.name}`)
            .addTo(layers);
          allPoints.push(station);
        });
        if (trip.pickup && trip.pickupStation)
          L.polyline(
            [
              [trip.pickup.lat, trip.pickup.lng],
              [trip.pickupStation.lat, trip.pickupStation.lng],
            ],
            { color: "#F5A623", weight: 3, dashArray: "8 8" },
          ).addTo(layers);
        if (trip.dropoff && trip.dropoffStation)
          L.polyline(
            [
              [trip.dropoffStation.lat, trip.dropoffStation.lng],
              [trip.dropoff.lat, trip.dropoff.lng],
            ],
            { color: "#F5A623", weight: 3, dashArray: "8 8" },
          ).addTo(layers);
      }
    });
    fitPoints(map, allPoints, 40);
    return () => {
      layers.remove();
    };
  }, [map, trips]);

  const handleClick = useCallback(
    async ({ lat, lng }: OsmPoint) => {
      if (!picking || !onMapPick) return;
      let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        const resolved = formatDisplayName(await reverseGeocode(lat, lng));
        if (resolved) address = resolved;
      } catch {}
      onMapPick({ address, lat, lng });
    },
    [picking, onMapPick],
  );

  const active = trips.find((trip) => trip.distanceKm && trip.durationMinutes);
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <OsmMapCanvas
        center={CAIRO}
        zoom={11}
        cursor={picking ? "crosshair" : undefined}
        onReady={setMap}
        onClick={handleClick}
      />
      {picking && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(11,30,61,.9)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            padding: "8px 16px",
            borderRadius: 20,
            whiteSpace: "nowrap",
          }}
        >
          <span>Click map to set {picking.field}</span>
          <button
            type="button"
            onClick={onCancelPick}
            style={{
              background: "rgba(255,255,255,.2)",
              border: 0,
              borderRadius: 12,
              color: "#fff",
              cursor: "pointer",
              padding: "2px 8px",
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {active && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 10,
            background: "#fff",
            color: "#0B1E3D",
            boxShadow: "0 2px 8px rgba(0,0,0,.12)",
            borderRadius: 8,
            padding: "7px 10px",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {active.distanceKm} km · {active.durationMinutes} min
        </div>
      )}
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 28,
          zIndex: 10,
          display: "grid",
          background: "#fff",
          border: "1px solid #dfe5ec",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => map?.zoomIn()}
          style={{
            width: 34,
            height: 34,
            border: 0,
            background: "#fff",
            fontSize: 20,
          }}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => map?.zoomOut()}
          style={{
            width: 34,
            height: 34,
            border: 0,
            borderTop: "1px solid #dfe5ec",
            background: "#fff",
            fontSize: 20,
          }}
        >
          -
        </button>
      </div>
      <button
        type="button"
        aria-label="Use my location"
        onClick={() =>
          navigator.geolocation?.getCurrentPosition(({ coords }) =>
            map?.setView([coords.latitude, coords.longitude], 15),
          )
        }
        style={{
          position: "absolute",
          left: 12,
          bottom: 28,
          zIndex: 10,
          width: 36,
          height: 36,
          borderRadius: 6,
          border: "1px solid #dfe5ec",
          background: "#fff",
          color: "#0B1E3D",
        }}
      >
        ◎
      </button>
    </div>
  );
}
