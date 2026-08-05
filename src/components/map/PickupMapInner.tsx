"use client";

import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { useRouteOSRM } from "./useRouteOSRM";
import { loadLeaflet, svgDataUrl, MAP_COLORS } from "@/lib/leaflet";
import type { PickupPoint } from "@/types/driver";

function pickupMarkerUrl(index: number) {
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">` +
      `<circle cx="16" cy="16" r="15" fill="#0B1E3D" stroke="#00C2A8" stroke-width="2.5"/>` +
      `<text x="16" y="21" text-anchor="middle" fill="white" font-size="12" font-weight="700" font-family="Inter,sans-serif">${index + 1}</text>` +
      `</svg>`,
  );
}

const DEST_URL = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="50">` +
    `<path d="M19 0C8.5 0 0 8.5 0 19c0 13.7 19 34 19 34S38 32.7 38 19C38 8.5 29.5 0 19 0z" fill="#F5A623"/>` +
    `<circle cx="19" cy="19" r="8" fill="white"/>` +
    `<circle cx="19" cy="19" r="4.5" fill="#0B1E3D"/>` +
    `</svg>`,
);

interface PickupMapInnerProps {
  pickupPoints: PickupPoint[];
  destination: { lat: number; lng: number; label: string };
  height?: number;
}

export default function PickupMapInner({
  pickupPoints,
  destination,
  height = 320,
}: PickupMapInnerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<LayerGroup | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);

  const waypoints = [
    ...pickupPoints.map((p) => ({ lat: p.lat, lng: p.lng })),
    { lat: destination.lat, lng: destination.lng },
  ];

  const { route, loading, error } = useRouteOSRM(waypoints);

  const centerLat = waypoints.reduce((s, w) => s + w.lat, 0) / waypoints.length;
  const centerLng = waypoints.reduce((s, w) => s + w.lng, 0) / waypoints.length;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;

    loadLeaflet().then((L) => {
      if (disposed || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([centerLat, centerLng], 13);

      L.tileLayer(MAP_COLORS.tileUrl, {
        attribution: MAP_COLORS.tileAttribution,
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      layersRef.current = L.layerGroup().addTo(map);
      setLeafletReady(true);
    });

    return () => {
      disposed = true;
      layersRef.current?.clearLayers();
      layersRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setLeafletReady(false);
    };
  }, [centerLat, centerLng]);

  useEffect(() => {
    if (!mapRef.current || !route) return;
    loadLeaflet().then((L) => {
      if (!mapRef.current) return;
      const bounds = L.latLngBounds(
        route.coordinates.map(([lat, lng]) => [lat, lng] as [number, number]),
      );
      mapRef.current.fitBounds(bounds, { padding: [40, 40] });
    });
  }, [route]);

  const routePath = route?.coordinates.map(([lat, lng]) => [lat, lng] as [number, number]);
  const fallbackPath = error
    ? waypoints.map(({ lat, lng }) => [lat, lng] as [number, number])
    : null;

  useEffect(() => {
    if (!layersRef.current) return;
    let disposed = false;

    loadLeaflet().then((L) => {
      if (disposed || !layersRef.current) return;
      const layers = layersRef.current;
      layers.clearLayers();

      if (routePath && !error) {
        L.polyline(routePath, {
          color: MAP_COLORS.route,
          weight: 14,
          opacity: 0.12,
        }).addTo(layers);
        L.polyline(routePath, {
          color: MAP_COLORS.route,
          weight: 8,
          opacity: 0.2,
        }).addTo(layers);
        L.polyline(routePath, {
          color: MAP_COLORS.route,
          weight: 5,
          opacity: 0.92,
        }).addTo(layers);
      }

      if (fallbackPath) {
        L.polyline(fallbackPath, {
          color: MAP_COLORS.route,
          weight: 3,
          opacity: 0.6,
          dashArray: "8 10",
        }).addTo(layers);
      }

      pickupPoints.forEach((point, index) => {
        const marker = L.marker([point.lat, point.lng], {
          icon: L.icon({
            iconUrl: pickupMarkerUrl(index),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        }).addTo(layers);

        marker.bindPopup(
          `<div style="font-size:13px"><strong>${point.passenger_name}</strong><br/>${point.address}<br/><span style="color:#5A6A7A;font-size:12px">Pickup: +${point.pickup_time_offset} min from start</span></div>`,
        );
      });

      const destinationMarker = L.marker([destination.lat, destination.lng], {
        icon: L.icon({
          iconUrl: DEST_URL,
          iconSize: [32, 40],
          iconAnchor: [16, 40],
        }),
      }).addTo(layers);

      destinationMarker.bindPopup(
        `<div style="font-size:13px"><strong>Destination</strong><br/>${destination.label}</div>`,
      );
    });

    return () => {
      disposed = true;
    };
  }, [destination.label, destination.lat, destination.lng, error, fallbackPath, pickupPoints, routePath]);

  return (
    <div style={{ height, position: "relative" }}>
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1000,
            background:
              "linear-gradient(90deg, #EFF7F6 25%, #d8f0ed 50%, #EFF7F6 75%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ color: "#5A6A7A", fontSize: 14 }}>Loading route…</span>
        </div>
      )}

      {error && !loading && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "#FFF3E0",
            border: "1px solid #F39C12",
            borderRadius: 6,
            padding: "4px 12px",
            fontSize: 12,
            color: "#7a4d00",
            whiteSpace: "nowrap",
          }}
        >
          ⚠️ Road route unavailable — showing straight-line path
        </div>
      )}

      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />

      {!leafletReady && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#EFF7F6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#5A6A7A",
            fontSize: 14,
          }}
        >
          Loading map...
        </div>
      )}
    </div>
  );
}
