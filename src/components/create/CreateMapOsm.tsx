"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

function zoneLabelHtml(name: string, zoom: number) {
  const scale = Math.max(0.8, Math.min(1.4, 0.8 + (zoom - 20) * 0.12));
  const fontSize = Math.round(11 * scale);
  const paddingX = Math.round(8 * scale);
  const paddingY = Math.round(3 * scale);
  return `<div style="background:rgba(255,255,255,0.15);color:#0B1E3D;width:max-content;border:1px solid rgba(11,30,61,0.16);border-radius:999px;padding:${paddingY}px ${paddingX}px;font-size:${fontSize}px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.08)">${name}</div>`;
}

type ZoneFeature = {
  type: "Feature";
  id?: string | number;
  properties?: { NAME?: string };
  geometry?: {
    type: "Polygon" | "MultiPolygon";
    coordinates?:
      | Array<Array<[number, number]>>
      | Array<Array<Array<[number, number]>>>;
  };
};

function pointInRing(point: [number, number], ring: Array<[number, number]>) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[j];
    const intersects =
      y1 > point[1] !== y2 > point[1] &&
      point[0] < ((x2 - x1) * (point[1] - y1)) / (y2 - y1) + x1;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(
  point: [number, number],
  polygon: Array<Array<[number, number]>>,
) {
  if (!polygon.length) return false;
  const outerRing = polygon[0] as Array<[number, number]>;
  const holes = polygon.slice(1) as Array<Array<[number, number]>>;
  if (!outerRing || !outerRing.length) return false;
  const insideOuter = pointInRing(point, outerRing);
  if (!insideOuter) return false;
  return !holes.some((hole) => pointInRing(point, hole));
}

function isPointInZone(point: [number, number], feature?: ZoneFeature) {
  if (!feature?.geometry?.coordinates) return false;
  const geometry = feature.geometry;
  if (geometry.type === "Polygon") {
    return pointInPolygon(
      point,
      geometry.coordinates as Array<Array<[number, number]>>,
    );
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as Array<Array<Array<[number, number]>>>).some(
      (polygon) => pointInPolygon(point, polygon),
    );
  }
  return false;
}

function isPointInAnyZone(point: [number, number], features: ZoneFeature[]) {
  return features.some((feature) => isPointInZone(point, feature));
}

function isLeafletMapReady(map: L.Map | null): map is L.Map {
  if (!map) return false;
  const internalMap = map as L.Map & {
    _loaded?: boolean;
    _mapPane?: HTMLElement;
    _container?: HTMLElement;
  };
  return Boolean(
    internalMap._loaded &&
      internalMap._mapPane &&
      internalMap._container?.isConnected,
  );
}

interface Props {
  trips: TripData[];
  picking?: { tripId: string; field: "pickup" | "dropoff" } | null;
  onMapPick?: (point: TripPoint) => void;
  onStationSelect?: (
    tripId: string,
    field: "pickup" | "dropoff",
    stationId: number,
  ) => void;
  onCancelPick?: () => void;
}

export default function CreateMapOsm({
  trips,
  picking,
  onMapPick,
  onStationSelect,
  onCancelPick,
}: Props) {
  const [map, setMap] = useState<L.Map | null>(null);
  const zoneFeaturesRef = useRef<ZoneFeature[]>([]);
  const zoneLabelLocationsRef = useRef<
    Array<{ lat: number; lng: number; name: string }>
  >([]);
  const zoneLabelMarkersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!isLeafletMapReady(map)) return;

    const maskLayer = L.layerGroup().addTo(map);
    const zoneLayer = L.layerGroup().addTo(map);
    let cancelled = false;

    const refreshZoneLabels = () => {
      if (cancelled || !isLeafletMapReady(map)) return;
      zoneLabelMarkersRef.current.forEach((marker) => marker.remove());
      zoneLabelMarkersRef.current = [];

      const zoom = map.getZoom();
      const labelData = zoneLabelLocationsRef.current;

      labelData.forEach(({ lat, lng, name }) => {
        const scale = Math.max(0.8, Math.min(1.4, 0.8 + (zoom - 20) * 0.12));
        const iconSize = Math.max(90, Math.round(140 * scale));
        const iconHeight = Math.max(24, Math.round(24 * scale));
        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: "",
            html: zoneLabelHtml(name, zoom),
            iconSize: [iconSize, iconHeight],
            iconAnchor: [iconSize / 2, iconHeight / 2],
          }),
          interactive: false,
        }).addTo(zoneLayer);
        zoneLabelMarkersRef.current.push(marker);
      });
    };

    const refreshMask = () => {
      if (cancelled || !isLeafletMapReady(map)) return;
      maskLayer.clearLayers();

      const bounds = map.getBounds();
      const southWest = bounds.getSouthWest();
      const northEast = bounds.getNorthEast();

      const outZonePolygons = zoneFeaturesRef.current.flatMap((feature) => {
        if (!feature.geometry?.coordinates) return [];
        const geometry = feature.geometry;
        if (geometry.type === "Polygon") {
          return [geometry.coordinates as Array<Array<[number, number]>>];
        }
        if (geometry.type === "MultiPolygon") {
          return geometry.coordinates as Array<Array<Array<[number, number]>>>;
        }
        return [];
      });

      if (!outZonePolygons.length) return;

      const maskPolygons = outZonePolygons.map((polygon) => {
        const ring = polygon[0] ?? [];
        const projected = ring.map(
          ([lng, lat]) => [lat, lng] as [number, number],
        );
        return projected;
      });

      const outerRing = [
        [southWest.lat, southWest.lng],
        [southWest.lat, northEast.lng],
        [northEast.lat, northEast.lng],
        [northEast.lat, southWest.lng],
        [southWest.lat, southWest.lng],
      ] as [number, number][];

      const maskShape = L.polygon(
        [outerRing, ...maskPolygons] as [number, number][][],
        {
          color: "transparent",
          weight: 2,
          fillColor: "#bfc3c8",
          fillOpacity: 0.56,
        },
      ).addTo(maskLayer);

      maskShape.bringToBack();
    };

    refreshMask();
    refreshZoneLabels();
    map.on("move zoom", refreshMask);
    map.on("zoom", refreshZoneLabels);

    fetch("/geo/zone_polygon.geojson")
      .then((response) => response.json())
      .then((geojson: { features?: ZoneFeature[] }) => {
        if (cancelled || !isLeafletMapReady(map)) return;
        const features = (geojson.features ?? []).filter(
          (feature): feature is ZoneFeature =>
            feature.geometry?.type === "Polygon" ||
            feature.geometry?.type === "MultiPolygon",
        );
        zoneFeaturesRef.current = features;
        refreshZoneLabels();
        L.geoJSON(features as unknown as Parameters<typeof L.geoJSON>[0], {
          style: {
            color: "#00C2A8",
            weight: 2,
            fillColor: "transparent",
            fillOpacity: 0,
            // border: "4px solid #00C2A8",
          },
          interactive: false,
        }).addTo(zoneLayer);
      })
      .catch(() => {});

    fetch("/geo/zone_centroid.geojson")
      .then((response) => response.json())
      .then((geojson) => {
        if (cancelled || !isLeafletMapReady(map)) return;
        const features = geojson.features ?? [];
        zoneLabelLocationsRef.current = features
          .map(
            (feature: {
              id?: string;
              properties?: { NAME?: string };
              geometry?: { coordinates?: [number, number] };
            }) => {
              const coords = feature.geometry?.coordinates;
              if (!Array.isArray(coords) || coords.length < 2) return null;
              const [lng, lat] = coords as [number, number];
              const rawName = feature.properties?.NAME || feature.id || "Zone";
              const match = String(feature.id || "").match(/(\d+)/);
              const name = match ? `${match[1]} ${rawName}` : rawName;
              return { lat, lng, name };
            },
          )
          .filter(Boolean) as Array<{ lat: number; lng: number; name: string }>;
        refreshZoneLabels();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      map.off("move zoom", refreshMask);
      map.off("zoom", refreshZoneLabels);
      zoneLabelMarkersRef.current.forEach((marker) => marker.remove());
      zoneLabelMarkersRef.current = [];
      zoneLabelLocationsRef.current = [];
      maskLayer.remove();
      zoneLayer.remove();
      zoneFeaturesRef.current = [];
    };
  }, [map]);

  useEffect(() => {
    if (!isLeafletMapReady(map)) return;
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
          const marker = L.marker([station.lat, station.lng], {
            icon:
              station.id === trip.pickupStation?.id
                ? STATION_ICON
                : DIMMED_STATION_ICON,
            keyboard: true,
            title: `Select ${station.name} as pickup station`,
          })
            .bindTooltip(
              `Pickup station: ${escapeHtml(station.name)}<br><strong>Description:</strong> ${escapeHtml(station.description || "No description available")}`,
            )
            .addTo(layers);
          marker.on("click", () =>
            onStationSelect?.(trip.id, "pickup", station.id),
          );
          allPoints.push(station);
        });
        trip.dropoffStationOptions.forEach((station) => {
          const marker = L.marker([station.lat, station.lng], {
            icon:
              station.id === trip.dropoffStation?.id
                ? STATION_ICON
                : DIMMED_STATION_ICON,
            keyboard: true,
            title: `Select ${station.name} as dropoff station`,
          })
            .bindTooltip(
              `Dropoff station: ${escapeHtml(station.name)}<br><strong>Description:</strong> ${escapeHtml(station.description || "No description available")}`,
            )
            .addTo(layers);
          marker.on("click", () =>
            onStationSelect?.(trip.id, "dropoff", station.id),
          );
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
  }, [map, onStationSelect, trips]);

  const handleClick = useCallback(
    async ({ lat, lng }: OsmPoint) => {
      if (!picking || !onMapPick) return;

      const point: [number, number] = [lng, lat];
      if (!zoneFeaturesRef.current.length) {
        window.alert(
          "The service zones are still loading. Please try again in a moment.",
        );
        return;
      }
      if (!isPointInAnyZone(point, zoneFeaturesRef.current)) {
        window.alert(
          "This location is outside the available service zones. Please choose a point inside one of the highlighted zones.",
        );
        return;
      }

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
