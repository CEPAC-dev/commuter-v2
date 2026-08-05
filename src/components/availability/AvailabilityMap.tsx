"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { reverseGeocode, formatDisplayName } from "@/lib/nominatim";
import { loadLeaflet, svgDataUrl, MAP_COLORS } from "@/lib/leaflet";
import type { TripPoint } from "@/lib/store/useTripStore";

const CAIRO = { lat: 30.0444, lng: 31.2357 };

const START_ICON = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
    <circle cx="18" cy="18" r="16" fill="#0B1E3D" stroke="#00C2A8" stroke-width="3"/>
    <circle cx="18" cy="18" r="6" fill="#ffffff"/>
  </svg>`,
);

const END_ICON = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.05 18 32.4 18 32.4S36 31.05 36 18C36 8.06 27.94 0 18 0z" fill="#00C2A8"/>
    <circle cx="18" cy="18" r="8" fill="white"/>
    <circle cx="18" cy="18" r="4.5" fill="#0B1E3D"/>
  </svg>`,
);

interface Props {
  startLocation: TripPoint | null;
  endLocation: TripPoint | null;
  picking: "start" | "end" | null;
  onPick: (field: "start" | "end", point: TripPoint) => void;
  onCancelPick: () => void;
}

export default function AvailabilityMap({
  startLocation,
  endLocation,
  picking,
  onPick,
  onCancelPick,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [leafletReady, setLeafletReady] = useState(false);
  const [resolving, setResolving] = useState(false);

  const onLoad = useCallback(() => {
    setMapReady(true);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;

    loadLeaflet().then((L) => {
      if (disposed || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([CAIRO.lat, CAIRO.lng], 11);

      L.tileLayer(MAP_COLORS.tileUrl, {
        attribution: MAP_COLORS.tileAttribution,
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      layersRef.current = L.layerGroup().addTo(map);
      setLeafletReady(true);
      onLoad();
    });

    return () => {
      disposed = true;
      layersRef.current?.clearLayers();
      layersRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setLeafletReady(false);
      setMapReady(false);
    };
  }, [onLoad]);

  // Fit bounds when locations change
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const pts = [startLocation, endLocation].filter(Boolean) as TripPoint[];
    if (!pts.length) return;
    if (pts.length === 1) {
      mapRef.current.panTo({ lat: pts[0].lat, lng: pts[0].lng });
      mapRef.current.setZoom(14);
      return;
    }
    loadLeaflet().then((L) => {
      if (!mapRef.current) return;
      const bounds = L.latLngBounds(
        pts.map((point) => [point.lat, point.lng] as [number, number]),
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 40] });
    });
  }, [startLocation, endLocation, mapReady]);

  useEffect(() => {
    if (!mapRef.current) return;
    let active = true;

    const handleMapClick = async (e: { latlng: { lat: number; lng: number } }) => {
      if (!picking || !active) return;
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      setResolving(true);
      let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        const addr = await reverseGeocode(lat, lng);
        const f = formatDisplayName(addr);
        if (f) address = f;
      } catch {
        // fall back to coordinates
      }
      if (!active) return;
      setResolving(false);
      onPick(picking, { address, lat, lng });
    };

    const map = mapRef.current;
    map.on("click", handleMapClick);
    return () => {
      active = false;
      map.off("click", handleMapClick);
    };
  }, [onPick, picking]);

  useEffect(() => {
    if (!layersRef.current) return;
    let disposed = false;

    loadLeaflet().then((L) => {
      if (disposed || !layersRef.current) return;
      const layers = layersRef.current;
      layers.clearLayers();

      const startIcon = L.icon({
        iconUrl: START_ICON,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      const endIcon = L.icon({
        iconUrl: END_ICON,
        iconSize: [36, 48],
        iconAnchor: [18, 48],
      });

      if (startLocation) {
        L.marker([startLocation.lat, startLocation.lng], {
          icon: startIcon,
          title: "Start location",
        }).addTo(layers);
      }

      if (endLocation) {
        L.marker([endLocation.lat, endLocation.lng], {
          icon: endIcon,
          title: "End location",
        }).addTo(layers);
      }
    });

    return () => {
      disposed = true;
    };
  }, [endLocation, startLocation]);

  if (!leafletReady) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#e8f0f7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#5A6A7A",
          fontSize: 14,
          fontFamily: "inherit",
          borderRadius: 12,
        }}
      >
        Loading map...
      </div>
    );
  }

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
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

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
        >
          Loading map...
        </div>
      )}

      {/* Picking overlay banner */}
      {picking && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              background: "#0B1E3D",
              color: "#ffffff",
              fontSize: 12,
              fontWeight: 700,
              padding: "5px 14px",
              borderRadius: 20,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            {resolving
              ? "Resolving address…"
              : `Tap map to pin ${picking === "start" ? "start" : "end"} location`}
          </span>
        </div>
      )}

      {/* Cancel picking */}
      {picking && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCancelPick();
          }}
          style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            background: "#ffffff",
            border: "1px solid #eef0f3",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 700,
            color: "#e74c3c",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
      )}

      {/* Legend */}
      {!picking && (startLocation || endLocation) && (
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            background: "rgba(255,255,255,0.92)",
            borderRadius: 8,
            padding: "5px 10px",
            fontSize: 11,
            display: "flex",
            flexDirection: "column",
            gap: 3,
            boxShadow: "0 1px 6px rgba(0,0,0,0.1)",
          }}
        >
          {startLocation && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: "#0B1E3D",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#0B1E3D",
                  border: "2px solid #00C2A8",
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
              Start
            </span>
          )}
          {endLocation && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: "#0B1E3D",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#00C2A8",
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
              End
            </span>
          )}
        </div>
      )}
    </div>
  );
}
