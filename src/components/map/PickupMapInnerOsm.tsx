"use client";

import { useEffect, useState } from "react";
import L from "leaflet";
import OsmMapCanvas from "./OsmMapCanvas";
import { fitPoints, svgIcon } from "./leafletLayers";
import { useRouteOSRM } from "./useRouteOSRM";
import type { PickupPoint } from "@/types/driver";

interface Props {
  pickupPoints: PickupPoint[];
  destination: { lat: number; lng: number; label: string };
  height?: number;
}

const DEST_ICON = svgIcon(
  `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="50"><path d="M19 0C8.5 0 0 8.5 0 19c0 13.7 19 34 19 34S38 32.7 38 19C38 8.5 29.5 0 19 0z" fill="#F5A623"/><circle cx="19" cy="19" r="8" fill="white"/><circle cx="19" cy="19" r="4.5" fill="#0B1E3D"/></svg>`,
  38,
  50,
);
function pickupIcon(index: number) {
  return svgIcon(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="15" fill="#0B1E3D" stroke="#00C2A8" stroke-width="2.5"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="12" font-weight="700" font-family="Arial">${index + 1}</text></svg>`,
    32,
    32,
    [16, 16],
  );
}

export default function PickupMapInnerOsm({
  pickupPoints,
  destination,
  height = 320,
}: Props) {
  const [map, setMap] = useState<L.Map | null>(null);
  const waypoints = [
    ...pickupPoints.map((point) => ({ lat: point.lat, lng: point.lng })),
    { lat: destination.lat, lng: destination.lng },
  ];
  const { route, loading, error } = useRouteOSRM(waypoints);
  const center = waypoints[0] ?? destination;

  useEffect(() => {
    if (!map) return;
    const layers = L.layerGroup().addTo(map);
    const path =
      route?.coordinates.map(([lat, lng]) => ({ lat, lng })) ?? waypoints;
    if (path.length > 1) {
      L.polyline(
        path.map((point) => [point.lat, point.lng]),
        { color: "#4361EE", weight: 14, opacity: 0.12 },
      ).addTo(layers);
      L.polyline(
        path.map((point) => [point.lat, point.lng]),
        {
          color: "#4361EE",
          weight: 5,
          opacity: 0.92,
          dashArray: error ? "8 8" : undefined,
        },
      ).addTo(layers);
    }
    pickupPoints.forEach((point, index) =>
      L.marker([point.lat, point.lng], { icon: pickupIcon(index) })
        .bindPopup(
          `<strong>${point.passenger_name}</strong><br/>${point.address}<br/>Pickup: +${point.pickup_time_offset} min from start`,
        )
        .addTo(layers),
    );
    L.marker([destination.lat, destination.lng], { icon: DEST_ICON })
      .bindPopup(destination.label)
      .addTo(layers);
    fitPoints(map, path, 40);
    return () => {
      layers.remove();
    };
  }, [map, route, error, pickupPoints, destination, waypoints]);

  return (
    <div style={{ height, position: "relative" }}>
      <OsmMapCanvas center={center} zoom={13} onReady={setMap} />
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            display: "grid",
            placeItems: "center",
            background: "rgba(239,247,246,.75)",
            color: "#5A6A7A",
            fontSize: 14,
          }}
        >
          Loading route...
        </div>
      )}
      {error && !loading && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            background: "#FFF3E0",
            border: "1px solid #F39C12",
            borderRadius: 6,
            padding: "4px 12px",
            fontSize: 12,
            color: "#7a4d00",
          }}
        >
          Road route unavailable. Showing straight line.
        </div>
      )}
    </div>
  );
}
