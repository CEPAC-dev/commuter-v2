"use client";

import { useCallback, useEffect, useState } from "react";
import L from "leaflet";
import OsmMapCanvas, { type OsmPoint } from "@/components/map/OsmMapCanvas";
import { fitPoints, svgIcon } from "@/components/map/leafletLayers";
import { reverseGeocode, formatDisplayName } from "@/lib/nominatim";
import type { TripPoint } from "@/lib/store/useTripStore";

interface Props {
  startLocation: TripPoint | null;
  endLocation: TripPoint | null;
  picking: "start" | "end" | null;
  onPick: (field: "start" | "end", point: TripPoint) => void;
  onCancelPick: () => void;
}

const START_ICON = svgIcon(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="16" fill="#0B1E3D" stroke="#00C2A8" stroke-width="3"/><circle cx="18" cy="18" r="6" fill="#fff"/></svg>`,
  36,
  36,
  [18, 18],
);
const END_ICON = svgIcon(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48"><path d="M18 0C8.06 0 0 8.06 0 18c0 13.05 18 32.4 18 32.4S36 31.05 36 18C36 8.06 27.94 0 18 0z" fill="#00C2A8"/><circle cx="18" cy="18" r="8" fill="#fff"/><circle cx="18" cy="18" r="4.5" fill="#0B1E3D"/></svg>`,
  36,
  48,
);

export default function AvailabilityMapOsm({
  startLocation,
  endLocation,
  picking,
  onPick,
  onCancelPick,
}: Props) {
  const [map, setMap] = useState<L.Map | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!map) return;
    const points = [startLocation, endLocation].filter(Boolean) as TripPoint[];
    const layers = L.layerGroup();
    if (startLocation) {
      L.marker([startLocation.lat, startLocation.lng], { icon: START_ICON })
        .bindTooltip("Start location")
        .addTo(layers);
    }
    if (endLocation) {
      L.marker([endLocation.lat, endLocation.lng], { icon: END_ICON })
        .bindTooltip("End location")
        .addTo(layers);
    }
    layers.addTo(map);
    fitPoints(map, points, 40);
    return () => {
      layers.remove();
    };
  }, [map, startLocation, endLocation]);

  const handleClick = useCallback(
    async ({ lat, lng }: OsmPoint) => {
      if (!picking) return;
      setResolving(true);
      let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        const result = formatDisplayName(await reverseGeocode(lat, lng));
        if (result) address = result;
      } finally {
        setResolving(false);
      }
      onPick(picking, { address, lat, lng });
    },
    [picking, onPick],
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <OsmMapCanvas
        cursor={picking ? "crosshair" : undefined}
        onReady={setMap}
        onClick={handleClick}
      />
      {picking && (
        <>
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            <span
              style={{
                background: "#0B1E3D",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                padding: "5px 14px",
                borderRadius: 20,
              }}
            >
              {resolving
                ? "Resolving address..."
                : `Tap map to pin ${picking === "start" ? "start" : "end"} location`}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelPick}
            style={{
              position: "absolute",
              bottom: 10,
              right: 10,
              zIndex: 10,
              background: "#fff",
              border: "1px solid #eef0f3",
              borderRadius: 6,
              padding: "7px 10px",
              color: "#0B1E3D",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
