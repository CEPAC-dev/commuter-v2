"use client";

import { useEffect, useRef } from "react";
import { loadLeaflet, MAP_COLORS } from "@/lib/leaflet";
import type { Map as LeafletMap } from "leaflet";

export type TripMapPoint = {
  lat: number;
  lng: number;
  label: string;
  kind: "pickup" | "dropoff" | "station";
};

function markerHtml(color: string, ring: string) {
  return `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${color};border:3px solid ${ring};box-shadow:0 2px 6px rgba(11,30,61,0.35)"></span>`;
}

export default function AdminTripMap({ points }: { points: TripMapPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
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
            html: markerHtml(color, "#ffffff"),
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        })
          .addTo(map)
          .bindTooltip(point.label, { direction: "top", offset: [0, -10] });
      });

      const pickup = points.find((p) => p.kind === "pickup");
      const dropoff = points.find((p) => p.kind === "dropoff");
      if (pickup && dropoff) {
        const fallbackRoute: [number, number][] = [
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng],
        ];
        const routeLine = L.polyline(fallbackRoute, {
          color: MAP_COLORS.route,
          weight: 4,
          opacity: 0.78,
          dashArray: "6 8",
        }).addTo(map);

        const params = new URLSearchParams({
          origin: `${pickup.lat},${pickup.lng}`,
          dest: `${dropoff.lat},${dropoff.lng}`,
        });
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

      if (latLngs.length === 1) map.setView(latLngs[0], 14);
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
  }, [points]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: 260,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #E6EAEC",
      }}
    />
  );
}
