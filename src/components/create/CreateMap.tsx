"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSON, LayerGroup, Map as LeafletMap } from "leaflet";
import type { TripData } from "./TripCycle";
import { reverseGeocode, formatDisplayName } from "@/lib/nominatim";
import { loadLeaflet, svgDataUrl, MAP_COLORS } from "@/lib/leaflet";
import type { TripPoint } from "@/lib/store/useTripStore";
import { isSharedVehicle } from "@/lib/geo/stations";

const CAIRO: [number, number] = [30.0444, 31.2357];
const ROUTE_COLORS = [MAP_COLORS.route, MAP_COLORS.accent, MAP_COLORS.secondary];

const STATION_ICON = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">
    <circle cx="11" cy="11" r="10" fill="#F5A623" stroke="#0B1E3D" stroke-width="1.5"/>
    <text x="11" y="15" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="#0B1E3D">S</text>
  </svg>`,
);

const DIMMED_STATION_ICON = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" opacity="0.42">
    <circle cx="11" cy="11" r="10" fill="#F5A623" stroke="#0B1E3D" stroke-width="1.5"/>
    <text x="11" y="15" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="#0B1E3D">S</text>
  </svg>`,
);

const ORIGIN_ICON = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
    <circle cx="18" cy="18" r="16" fill="#0B1E3D" stroke="#00C2A8" stroke-width="3"/>
    <circle cx="18" cy="18" r="6" fill="#ffffff"/>
  </svg>`,
);

const DEST_ICON = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.05 18 32.4 18 32.4S36 31.05 36 18C36 8.06 27.94 0 18 0z" fill="#00C2A8"/>
    <circle cx="18" cy="18" r="8" fill="white"/>
    <circle cx="18" cy="18" r="4.5" fill="#0B1E3D"/>
  </svg>`,
);

function stopIcon(index: number): string {
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="36">
      <path d="M15 1C7.27 1 1 7.27 1 15c0 10.25 14 20 14 20s14-9.75 14-20C29 7.27 22.73 1 15 1z" fill="#F5A623" stroke="#0B1E3D" stroke-width="1.5"/>
      <text x="15" y="19" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#0B1E3D">${index + 1}</text>
    </svg>`,
  );
}

function routeLabelHtml(text: string, color: string): string {
  return `<div style="background:${color};color:#fff;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.12)">${text}</div>`;
}

interface Props {
  trips: TripData[];
  picking?: { tripId: string; field: "pickup" | "dropoff" } | null;
  onMapPick?: (point: TripPoint) => void;
  onCancelPick?: () => void;
}

interface ZoneLabel {
  id: string;
  no: number;
  name: string;
  lat: number;
  lng: number;
}

export default function CreateMap({
  trips,
  picking,
  onMapPick,
  onCancelPick,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<LayerGroup | null>(null);
  const zoneLayerRef = useRef<GeoJSON | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [zoom, setZoom] = useState(11);
  const [zoneLabels, setZoneLabels] = useState<ZoneLabel[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/geo/zone_centroid.geojson")
      .then((r) => r.json())
      .then((fc) => {
        if (cancelled) return;
        const labels: ZoneLabel[] = fc.features.map((feature: { id: unknown; properties?: { NO?: number; NAME?: string }; geometry: { coordinates: [number, number] } }) => {
          const idStr = String(feature.id);
          const noMatch = idStr.match(/\d+/);
          return {
            id: String(feature.id),
            no: feature.properties?.NO ?? (noMatch ? parseInt(noMatch[0], 10) : 0),
            name: feature.properties?.NAME ?? "",
            lat: feature.geometry.coordinates[1],
            lng: feature.geometry.coordinates[0],
          };
        });
        setZoneLabels(labels);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const allPoints = useMemo(() => {
    const points: Array<{ lat: number; lng: number }> = [];
    for (const trip of trips) {
      trip.stops.forEach((stop) => {
        if (stop.point) points.push({ lat: stop.point.lat, lng: stop.point.lng });
      });
      trip.routeCoordinates?.forEach(([lat, lng]) => points.push({ lat, lng }));
      if (trip.pickup) points.push({ lat: trip.pickup.lat, lng: trip.pickup.lng });
      if (trip.dropoff) points.push({ lat: trip.dropoff.lat, lng: trip.dropoff.lng });
      if (isSharedVehicle(trip.vehicleType)) {
        trip.pickupStationOptions.forEach((station) => points.push({ lat: station.lat, lng: station.lng }));
        trip.dropoffStationOptions.forEach((station) => points.push({ lat: station.lat, lng: station.lng }));
      }
    }
    return points;
  }, [trips]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let disposed = false;

    loadLeaflet().then((L) => {
      if (disposed || !mapContainerRef.current) return;
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView(CAIRO, 11);

      L.tileLayer(MAP_COLORS.tileUrl, {
        attribution: MAP_COLORS.tileAttribution,
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      layersRef.current = L.layerGroup().addTo(map);
      setLeafletReady(true);
      map.on("zoomend", () => setZoom(map.getZoom()));

      fetch("/geo/zone_polygon.geojson")
        .then((response) => response.json())
        .then((geojson) => {
          if (!mapRef.current) return;
          zoneLayerRef.current = L.geoJSON(geojson, {
            style: {
              fillColor: "rgb(10, 0, 168)",
              fillOpacity: 0.08,
              color: "rgba(255, 0, 168, 1)",
              weight: 1.2,
              opacity: 0.6,
            },
            interactive: false,
          }).addTo(mapRef.current);
        })
        .catch(() => {});
    });

    return () => {
      disposed = true;
      zoneLayerRef.current?.remove();
      zoneLayerRef.current = null;
      layersRef.current?.clearLayers();
      layersRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setLeafletReady(false);
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !allPoints.length) return;
    loadLeaflet().then((L) => {
      if (!mapRef.current || !allPoints.length) return;
      const bounds = L.latLngBounds(
        allPoints.map((point) => [point.lat, point.lng] as [number, number]),
      );
      mapRef.current.fitBounds(bounds, { padding: [60, 40] });
    });
  }, [allPoints]);

  useEffect(() => {
    if (!layersRef.current) return;
    let disposed = false;

    loadLeaflet().then((L) => {
      if (disposed || !layersRef.current) return;
      const layers = layersRef.current;
      layers.clearLayers();

      zoneLabels.forEach((label) => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="font-size:11px;font-weight:600;color:#0B1E3D;white-space:nowrap;text-shadow:0 1px 2px rgba(255,255,255,0.8)">${label.name ? `${label.no} ${label.name}` : `Zone ${label.no}`}</div>`,
          iconSize: [72, 16],
          iconAnchor: [36, 8],
        });
        L.marker([label.lat, label.lng], { icon, interactive: false }).addTo(layers);
      });

      trips.forEach((trip, index) => {
        const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
        const routePath = trip.routeCoordinates?.map(([lat, lng]) => [lat, lng] as [number, number]) ?? [];

        if (routePath.length >= 2) {
          L.polyline(routePath, { color, opacity: 0.15, weight: 14 }).addTo(layers);
          L.polyline(routePath, { color, opacity: 0.9, weight: 5 }).addTo(layers);

          const midpoint = routePath[Math.floor(routePath.length / 2)];
          const labelIcon = L.divIcon({
            className: "",
            html: routeLabelHtml(`Trip ${index + 1}`, color),
            iconSize: [58, 22],
            iconAnchor: [29, 11],
          });
          L.marker(midpoint, { icon: labelIcon, interactive: false }).addTo(layers);
        }

        if (isSharedVehicle(trip.vehicleType) && trip.pickup && trip.pickupStation) {
          L.polyline(
            [
              [trip.pickup.lat, trip.pickup.lng],
              [trip.pickupStation.lat, trip.pickupStation.lng],
            ],
            { color: "#F5A623", opacity: 0.9, weight: 3, dashArray: "8 8" },
          ).addTo(layers);
        }

        if (isSharedVehicle(trip.vehicleType) && trip.dropoff && trip.dropoffStation) {
          L.polyline(
            [
              [trip.dropoffStation.lat, trip.dropoffStation.lng],
              [trip.dropoff.lat, trip.dropoff.lng],
            ],
            { color: "#F5A623", opacity: 0.9, weight: 3, dashArray: "8 8" },
          ).addTo(layers);
        }

        if (isSharedVehicle(trip.vehicleType)) {
          trip.pickupStationOptions.forEach((station) => {
            const selected = station.id === trip.pickupStation?.id;
            L.marker([station.lat, station.lng], {
              icon: L.icon({
                iconUrl: selected ? STATION_ICON : DIMMED_STATION_ICON,
                iconSize: [22, 22],
                iconAnchor: [11, 11],
              }),
              interactive: false,
              zIndexOffset: selected ? 900 + index : 600 + index,
            }).addTo(layers);
          });

          trip.dropoffStationOptions.forEach((station) => {
            const selected = station.id === trip.dropoffStation?.id;
            L.marker([station.lat, station.lng], {
              icon: L.icon({
                iconUrl: selected ? STATION_ICON : DIMMED_STATION_ICON,
                iconSize: [22, 22],
                iconAnchor: [11, 11],
              }),
              interactive: false,
              zIndexOffset: selected ? 900 + index : 600 + index,
            }).addTo(layers);
          });
        }

        if (!isSharedVehicle(trip.vehicleType)) {
          trip.stops.forEach((stop, stopIndex) => {
            if (!stop.point) return;
            L.marker([stop.point.lat, stop.point.lng], {
              icon: L.icon({
                iconUrl: stopIcon(stopIndex),
                iconSize: [30, 36],
                iconAnchor: [15, 36],
              }),
              title: `Trip ${index + 1}, stop ${stopIndex + 1}: ${stop.point.address}`,
              zIndexOffset: 1100 + index + stopIndex,
            }).addTo(layers);
          });
        }

        if (trip.pickup) {
          L.marker([trip.pickup.lat, trip.pickup.lng], {
            icon: L.icon({ iconUrl: ORIGIN_ICON, iconSize: [36, 36], iconAnchor: [18, 18] }),
            title: `Trip ${index + 1} pickup`,
            zIndexOffset: 1000 + index,
          }).addTo(layers);
        }

        if (trip.dropoff) {
          L.marker([trip.dropoff.lat, trip.dropoff.lng], {
            icon: L.icon({ iconUrl: DEST_ICON, iconSize: [36, 48], iconAnchor: [18, 48] }),
            title: `Trip ${index + 1} dropoff`,
            zIndexOffset: 1000 + index,
          }).addTo(layers);
        }
      });
    });

    return () => {
      disposed = true;
    };
  }, [trips, zoneLabels]);

  useEffect(() => {
    if (!mapRef.current) return;
    let active = true;

    const handleMapClick = async (event: { latlng: { lat: number; lng: number } }) => {
      if (!picking || !onMapPick || !active) return;
      const lat = event.latlng.lat;
      const lng = event.latlng.lng;
      let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        const addr = await reverseGeocode(lat, lng);
        const formatted = formatDisplayName(addr);
        if (formatted) address = formatted;
      } catch {
        // fall back to coordinates
      }
      if (!active) return;
      onMapPick({ address, lat, lng });
    };

    const map = mapRef.current;
    map.on("click", handleMapClick);
    map.getContainer().style.cursor = picking ? "crosshair" : "grab";

    return () => {
      active = false;
      map.off("click", handleMapClick);
      map.getContainer().style.cursor = "";
    };
  }, [onMapPick, picking]);

  function handleZoom(delta: number) {
    if (!mapRef.current) return;
    mapRef.current.setZoom((mapRef.current.getZoom() ?? zoom) + delta);
  }

  function handleLocate() {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      mapRef.current?.panTo([coords.latitude, coords.longitude]);
      mapRef.current?.setZoom(15);
    });
  }

  const activeTrip = trips.find((trip) => trip.distanceKm && trip.durationMinutes);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {!leafletReady && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#e8f0f7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#5A6A7A",
            fontSize: 14,
            fontFamily: "inherit",
          }}
          aria-label="Map loading"
        >
          Loading map...
        </div>
      )}

      {picking && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(11,30,61,0.9)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            padding: "8px 16px",
            borderRadius: 20,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ pointerEvents: "none" }}>
            Click the map to set {picking.field}
          </span>
          <button
            type="button"
            onClick={onCancelPick}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              borderRadius: 12,
              color: "#fff",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              padding: "2px 8px",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {activeTrip && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <div className="route-badge">
            <span className="route-badge-km">{activeTrip.distanceKm} km</span>
            <span className="route-badge-sep">·</span>
            <span>{activeTrip.durationMinutes} min</span>
          </div>
        </div>
      )}

      <div className="map-zoom-controls" aria-label="Map zoom controls">
        <button
          className="map-zoom-btn"
          onClick={() => handleZoom(1)}
          aria-label="Zoom in"
          type="button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <div className="map-zoom-divider" />
        <button
          className="map-zoom-btn"
          onClick={() => handleZoom(-1)}
          aria-label="Zoom out"
          type="button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <button
        className="map-locate-btn"
        onClick={handleLocate}
        aria-label="Center map on my location"
        type="button"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
          <circle cx="12" cy="12" r="8" strokeDasharray="2 2" />
        </svg>
      </button>
    </div>
  );
}
