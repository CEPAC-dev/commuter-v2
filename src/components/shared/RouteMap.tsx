"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { MapPin } from "lucide-react";
import { loadLeaflet, svgDataUrl, MAP_COLORS } from "@/lib/leaflet";
import { loadRouteCoordinates } from "@/lib/routeMapDirections";

interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  height?: number;
  rounded?: number;
  interactive?: boolean;
  stops?: LatLng[];
  stations?: LatLng[];
  stationIconsOnly?: boolean;
  routeCoordinates?: LatLng[]; // Pre-computed route (skips directions API)
}

const ROUTE_COLOR = MAP_COLORS.route;

const PICKUP_ICON = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
    <circle cx="18" cy="18" r="16" fill="#0B1E3D" stroke="#00C2A8" stroke-width="3"/>
    <circle cx="18" cy="18" r="6" fill="#ffffff"/>
  </svg>`,
);

const DROPOFF_ICON = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.05 18 32.4 18 32.4S36 31.05 36 18C36 8.06 27.94 0 18 0z" fill="#00C2A8"/>
    <circle cx="18" cy="18" r="8" fill="white"/>
    <circle cx="18" cy="18" r="4.5" fill="#0B1E3D"/>
  </svg>`,
);

const STOP_ICON = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <circle cx="12" cy="12" r="10" fill="#F5A623" stroke="#fff" stroke-width="3"/>
  </svg>`,
);

const STATION_ICON = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26">
    <rect x="3" y="3" width="20" height="20" rx="6" fill="#00C2A8" stroke="#fff" stroke-width="3"/>
    <rect x="9" y="9" width="8" height="8" rx="2" fill="#fff"/>
  </svg>`,
);

function createNumberedStationIcon(number: number) {
  const fontSize = number > 9 ? 10 : 14;
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26">
      <circle cx="13" cy="13" r="11" fill="#00C2A8" stroke="#ffffff" stroke-width="2"/>
      <text x="13" y="18" font-size="${fontSize}" font-weight="700" fill="#ffffff" text-anchor="middle">${number}</text>
    </svg>`,
  );
}

function valid(point?: LatLng | null): point is LatLng {
  return (
    !!point &&
    typeof point.lat === "number" &&
    typeof point.lng === "number" &&
    !Number.isNaN(point.lat) &&
    !Number.isNaN(point.lng)
  );
}

function Placeholder({ height, rounded }: { height: number; rounded: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: rounded,
        background:
          "linear-gradient(135deg, #eef2f6 0%, #dfe7ee 50%, #eef2f6 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: "#9aa7b4",
      }}
    >
      <MapPin size={18} aria-hidden="true" />
      <span style={{ fontSize: 12, fontWeight: 600 }}>Route preview</span>
    </div>
  );
}

export default function RouteMap({
  pickup,
  dropoff,
  height = 150,
  rounded = 0,
  interactive = false,
  stops,
  stations,
  stationIconsOnly = false,
  routeCoordinates,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<LayerGroup | null>(null);
  const leafletModuleRef = useRef<typeof import("leaflet") | null>(null);
  const boundsRef = useRef<import("leaflet").LatLngBounds | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [pathCoords, setPathCoords] = useState<LatLng[] | null>(null);
  const ok = valid(pickup) && valid(dropoff);

  const normalizedStops = useMemo(() => (stops ?? []).filter(valid), [stops]);
  const normalizedStations = useMemo(() => (stations ?? []).filter(valid), [stations]);

  useEffect(() => {
    if (!ok) {
      // Clear path when inputs invalid
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPathCoords(null);
      return;
    }
    let cancelled = false;
    const start = pickup as LatLng;
    const end = dropoff as LatLng;
    loadRouteCoordinates({
      pickup: start,
      dropoff: end,
      stops: normalizedStops,
      stations: normalizedStations,
      routeCoordinates,
    })
      .then((coordinates) => {
        if (!cancelled) setPathCoords(coordinates);
      })
      .catch(() => {
        if (!cancelled) setPathCoords(null);
      });
    return () => {
      cancelled = true;
    };
  }, [dropoff, normalizedStations, normalizedStops, ok, pickup, routeCoordinates]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !ok) return;
    let disposed = false;

    loadLeaflet().then((L) => {
      if (disposed || !mapContainerRef.current) return;
      const map = L.map(mapContainerRef.current, {
        zoomControl: interactive,
        attributionControl: interactive,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
        touchZoom: interactive,
      });

      L.tileLayer(MAP_COLORS.tileUrl, {
        attribution: MAP_COLORS.tileAttribution,
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      layersRef.current = L.layerGroup().addTo(map);
      leafletModuleRef.current = L;
      setLeafletReady(true);
    });

    return () => {
      disposed = true;
      layersRef.current?.clearLayers();
      layersRef.current = null;
      boundsRef.current = null;
      leafletModuleRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setLeafletReady(false);
    };
  }, [interactive, ok]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletModuleRef.current;
    if (!leafletReady || !map || !L) return;

    const recenter = () => {
      const bounds = boundsRef.current;
      if (bounds?.isValid()) {
        map.fitBounds(bounds, { padding: [36, 36] });
      } else {
        map.fitWorld({ padding: [36, 36] });
      }
    };
    const RecenterControl = L.Control.extend({
      onAdd() {
        const container = L.DomUtil.create("div");
        const button = L.DomUtil.create(
          "button",
          "leaflet-control-recenter",
          container,
        ) as HTMLButtonElement;
        button.type = "button";
        button.setAttribute("aria-label", "Recenter map");
        button.title = "Recenter map";
        button.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>';
        Object.assign(button.style, {
          background: "#fff",
          border: "2px solid rgba(0,0,0,0.1)",
          borderRadius: "8px",
          width: "36px",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          color: "#0B1E3D",
          padding: "0",
        });
        L.DomEvent.disableClickPropagation(button);
        L.DomEvent.disableScrollPropagation(button);
        return container;
      },
    });
    const control = new RecenterControl({ position: "topright" });
    control.addTo(map);
    const button =
      control.getContainer()?.querySelector<HTMLButtonElement>("button") ?? null;
    button?.addEventListener("click", recenter);

    return () => {
      button?.removeEventListener("click", recenter);
      control.remove();
    };
  }, [leafletReady]);

  useEffect(() => {
    if (!ok || !mapRef.current || !layersRef.current) return;
    let disposed = false;

    loadLeaflet().then((L) => {
      if (disposed || !mapRef.current || !layersRef.current) return;
      const map = mapRef.current;
      const layers = layersRef.current;
      layers.clearLayers();

      const routePoints = pathCoords?.length
        ? pathCoords.map((point) => [point.lat, point.lng] as [number, number])
        : [
            [pickup!.lat, pickup!.lng] as [number, number],
            ...normalizedStops.map((point) => [point.lat, point.lng] as [number, number]),
            ...normalizedStations.map((point) => [point.lat, point.lng] as [number, number]),
            [dropoff!.lat, dropoff!.lng] as [number, number],
          ];

      if (routePoints.length > 1) {
        L.polyline(routePoints, {
          color: ROUTE_COLOR,
          opacity: 0.15,
          weight: 14,
        }).addTo(layers);
        L.polyline(routePoints, {
          color: ROUTE_COLOR,
          opacity: 0.9,
          weight: 5,
        }).addTo(layers);
      }

      const stationMode = stationIconsOnly || normalizedStations.length > 0;
      const pickupIcon = L.icon({
        iconUrl: stationMode ? STATION_ICON : PICKUP_ICON,
        iconSize: stationMode ? [28, 28] : [36, 36],
        iconAnchor: stationMode ? [14, 14] : [18, 18],
      });
      const dropoffIcon = L.icon({
        iconUrl: stationMode ? STATION_ICON : DROPOFF_ICON,
        iconSize: stationMode ? [28, 28] : [36, 48],
        iconAnchor: stationMode ? [14, 14] : [18, 48],
      });
      const stopIcon = L.icon({
        iconUrl: STOP_ICON,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const stationIcon = L.icon({
        iconUrl: STATION_ICON,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      L.marker([pickup!.lat, pickup!.lng], { icon: pickupIcon }).addTo(layers);
      L.marker([dropoff!.lat, dropoff!.lng], { icon: dropoffIcon }).addTo(layers);
      normalizedStops.forEach((point) => {
        L.marker([point.lat, point.lng], { icon: stopIcon }).addTo(layers);
      });
      normalizedStations.forEach((point, index) => {
        const icon = stationIconsOnly
          ? L.icon({
              iconUrl: createNumberedStationIcon(index + 1),
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            })
          : stationIcon;
        L.marker([point.lat, point.lng], { icon }).addTo(layers);
      });

      const bounds = L.latLngBounds([
        [pickup!.lat, pickup!.lng],
        [dropoff!.lat, dropoff!.lng],
      ]);
      normalizedStops.forEach((point) => bounds.extend([point.lat, point.lng]));
      normalizedStations.forEach((point) => bounds.extend([point.lat, point.lng]));
      routePoints.forEach((point) => bounds.extend(point));
      boundsRef.current = bounds;
      map.fitBounds(bounds, { padding: [36, 36] });
    });

    return () => {
      disposed = true;
    };
  }, [dropoff, normalizedStations, normalizedStops, ok, pathCoords, pickup, stationIconsOnly]);

  if (!ok) {
    return <Placeholder height={height} rounded={rounded} />;
  }

  return (
    <div
      style={{
        height,
        borderRadius: rounded,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
      {!leafletReady && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, #eef2f6 0%, #dfe7ee 50%, #eef2f6 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#5A6A7A",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Loading map...
        </div>
      )}
    </div>
  );
}
