"use client";

import { useEffect, useRef } from "react";
import { loadLeaflet, MAP_COLORS } from "@/lib/leaflet";
import type { Map as LeafletMap } from "leaflet";

export type TripMapPoint = {
  lat: number;
  lng: number;
  label: string;
  kind: "pickup" | "dropoff" | "station" | "stop";
  order?: number;
};

type TripMapConnection = {
  from: TripMapPoint;
  to: TripMapPoint;
};

function markerHtml(color: string, ring: string, order?: number) {
  const label = order == null ? "" : String(order);
  return `<span style="display:flex;width:22px;height:22px;border-radius:50%;background:${color};border:3px solid ${ring};box-shadow:0 2px 6px var(--color-shadow-strong);align-items:center;justify-content:center;color:var(--color-on-primary);font:700 10px/1 sans-serif">${label}</span>`;
}

export default function AdminTripMap({
  points,
  routePoints = points,
  routeGeometry,
  walkingConnections = [],
  stationOnly = false,
  focusPoint,
}: {
  points: TripMapPoint[];
  routePoints?: TripMapPoint[];
  routeGeometry?: [number, number][];
  walkingConnections?: TripMapConnection[];
  stationOnly?: boolean;
  focusPoint?: { lat: number; lng: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: stationOnly,
      });
      L.tileLayer(MAP_COLORS.tileUrl, {
        attribution: MAP_COLORS.tileAttribution,
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;

      const latLngs = points.map((p) => L.latLng(p.lat, p.lng));

      points.forEach((point) => {
        const color =
          point.kind === "pickup"
            ? MAP_COLORS.secondary
            : point.kind === "dropoff"
              ? MAP_COLORS.primary
              : MAP_COLORS.accent;
        L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: "",
            html: markerHtml(color, "var(--color-panel)", point.order),
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
        })
          .addTo(map)
          .bindTooltip(point.label, { direction: "top", offset: [0, -10] });
      });

      walkingConnections.forEach(({ from, to }) => {
        L.polyline(
          [
            [from.lat, from.lng],
            [to.lat, to.lng],
          ],
          {
            color: MAP_COLORS.accent,
            weight: 2,
            opacity: 0.8,
            dashArray: "4 6",
          },
        )
          .addTo(map)
          .bindTooltip("Walk to station", { sticky: true });
      });

      if (!stationOnly && routePoints.length > 1) {
        if (routeGeometry && routeGeometry.length > 1) {
          L.polyline(routeGeometry, {
            color: MAP_COLORS.route,
            weight: 4,
            opacity: 0.9,
          }).addTo(map);
          map.fitBounds(L.latLngBounds(routeGeometry), { padding: [32, 32] });
        } else {
          const [origin, ...remainingPoints] = routePoints;
          const destination = remainingPoints.pop();
          if (!origin || !destination) return;
          const fallbackRoute = routePoints.map(
            (point) => [point.lat, point.lng] as [number, number],
          );
          const routeLine = L.polyline(fallbackRoute, {
            color: MAP_COLORS.route,
            weight: 4,
            opacity: 0.78,
            dashArray: "6 8",
          }).addTo(map);

          const params = new URLSearchParams({
            origin: `${origin.lat},${origin.lng}`,
            dest: `${destination.lat},${destination.lng}`,
          });
          if (remainingPoints.length) {
            params.set(
              "waypoints",
              remainingPoints
                .map((point) => `${point.lat},${point.lng}`)
                .join("|"),
            );
          }
          void fetch(`/api/directions?${params.toString()}`)
            .then(async (response) => {
              if (!response.ok) return [];
              return (await response.json()) as Array<{
                coordinates?: [number, number][];
              }>;
            })
            .then((routes) => {
              if (cancelled) return;
              const route = routes[0]?.coordinates;
              if (route && route.length > 1) {
                routeLine.setLatLngs(route);
                routeLine.setStyle({ dashArray: undefined });
                map.fitBounds(L.latLngBounds(route), { padding: [32, 32] });
              }
            })
            .catch(() => undefined);
        }
      }

      if (focusPoint) map.setView([focusPoint.lat, focusPoint.lng], 17);
      else if (latLngs.length === 1) map.setView(latLngs[0], 14);
      else if (latLngs.length > 1)
        map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32] });
      else map.setView([30.0444, 31.2357], 11);

      // container starts hidden inside the drawer animation
      setTimeout(() => map.invalidateSize(), 120);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [
    focusPoint,
    points,
    routeGeometry,
    routePoints,
    stationOnly,
    walkingConnections,
  ]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: 260,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid var(--color-border)",
      }}
    />
  );
}
