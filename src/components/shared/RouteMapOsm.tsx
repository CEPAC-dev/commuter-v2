"use client";

import { useEffect, useState } from "react";
import L from "leaflet";
import { MapPin } from "lucide-react";
import OsmMapCanvas from "@/components/map/OsmMapCanvas";
import { useClientLocale } from "@/lib/i18n/client";
import {
  fitPoints,
  svgIcon,
  type LatLng,
} from "@/components/map/leafletLayers";

interface Props {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  height?: number;
  rounded?: number;
  interactive?: boolean;
  stops?: LatLng[];
  stations?: LatLng[];
}

const PICKUP_ICON = svgIcon(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle cx="18" cy="18" r="16" fill="#0B1E3D" stroke="#00C2A8" stroke-width="3"/><circle cx="18" cy="18" r="6" fill="#fff"/></svg>`,
  36,
  36,
  [18, 18],
);
const DROPOFF_ICON = svgIcon(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48"><path d="M18 0C8.06 0 0 8.06 0 18c0 13.05 18 32.4 18 32.4S36 31.05 36 18C36 8.06 27.94 0 18 0z" fill="#00C2A8"/><circle cx="18" cy="18" r="8" fill="#fff"/><circle cx="18" cy="18" r="4.5" fill="#0B1E3D"/></svg>`,
  36,
  48,
);
const STOP_ICON = svgIcon(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#F5A623" stroke="#fff" stroke-width="3"/></svg>`,
  24,
  24,
  [12, 12],
);
const STATION_ICON = svgIcon(
  `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><rect x="3" y="3" width="20" height="20" rx="6" fill="#00C2A8" stroke="#fff" stroke-width="3"/><rect x="9" y="9" width="8" height="8" rx="2" fill="#fff"/></svg>`,
  26,
  26,
  [13, 13],
);

function valid(point?: LatLng | null): point is LatLng {
  return !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng);
}

function Placeholder({ height, rounded }: { height: number; rounded: number }) {
  const { t } = useClientLocale();
  return (
    <div
      style={{
        height,
        borderRadius: rounded,
        background: "#eef2f6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: "#9aa7b4",
      }}
    >
      <MapPin size={18} />
      <span style={{ fontSize: 12, fontWeight: 600 }}>{t("map.route_preview")}</span>
    </div>
  );
}

export default function RouteMapOsm({
  pickup,
  dropoff,
  height = 150,
  rounded = 0,
  interactive = false,
  stops,
  stations,
}: Props) {
  const [map, setMap] = useState<L.Map | null>(null);
  const [path, setPath] = useState<LatLng[] | null>(null);
  const ok = valid(pickup) && valid(dropoff);

  useEffect(() => {
    if (!ok) return;
    let cancelled = false;
    const points = [...(stops ?? []), ...(stations ?? [])].filter(valid);
    const url = new URL("/api/directions", window.location.origin);
    url.searchParams.set("origin", `${pickup.lat},${pickup.lng}`);
    url.searchParams.set("dest", `${dropoff.lat},${dropoff.lng}`);
    if (points.length)
      url.searchParams.set(
        "waypoints",
        points.map((point) => `${point.lat},${point.lng}`).join("|"),
      );
    fetch(url)
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (!cancelled)
          setPath(
            data?.[0]?.coordinates?.map(([lat, lng]: [number, number]) => ({
              lat,
              lng,
            })) ?? null,
          );
      })
      .catch(() => !cancelled && setPath(null));
    return () => {
      cancelled = true;
    };
  }, [
    ok,
    pickup?.lat,
    pickup?.lng,
    dropoff?.lat,
    dropoff?.lng,
    JSON.stringify(stops ?? []),
    JSON.stringify(stations ?? []),
  ]);

  useEffect(() => {
    if (!map || !ok) return;
    const layers = L.layerGroup();
    const route = path?.length ? path : [pickup, dropoff];
    L.polyline(
      route.map((point) => [point.lat, point.lng]),
      { color: "#4361EE", weight: 12, opacity: 0.15 },
    ).addTo(layers);
    L.polyline(
      route.map((point) => [point.lat, point.lng]),
      { color: "#4361EE", weight: 5, opacity: 0.9 },
    ).addTo(layers);
    L.marker([pickup.lat, pickup.lng], { icon: PICKUP_ICON }).addTo(layers);
    L.marker([dropoff.lat, dropoff.lng], { icon: DROPOFF_ICON }).addTo(layers);
    stops
      ?.filter(valid)
      .forEach((point) =>
        L.marker([point.lat, point.lng], { icon: STOP_ICON }).addTo(layers),
      );
    stations
      ?.filter(valid)
      .forEach((point) =>
        L.marker([point.lat, point.lng], { icon: STATION_ICON }).addTo(layers),
      );
    layers.addTo(map);
    fitPoints(map, [
      ...route,
      ...(stops ?? []).filter(valid),
      ...(stations ?? []).filter(valid),
    ]);
    return () => {
      layers.remove();
    };
  }, [map, ok, pickup, dropoff, path, stops, stations]);

  if (!ok) return <Placeholder height={height} rounded={rounded} />;
  return (
    <div
      style={{
        height,
        borderRadius: rounded,
        overflow: "hidden",
        pointerEvents: interactive ? "auto" : "none",
      }}
    >
      <OsmMapCanvas center={pickup} zoom={13} onReady={setMap} />
    </div>
  );
}
