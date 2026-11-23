"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DivIcon as LeafletDivIcon,
  Map as LeafletMap,
  Marker as LeafletMarker,
} from "leaflet";
import { LoaderCircle, MapPin } from "lucide-react";
import { loadLeaflet, MAP_COLORS } from "@/lib/leaflet";

type Coordinates = { lat: number; lng: number };

export default function RegionCityCenterMap({
  center,
  zoom,
  point,
  onPointChange,
}: {
  center: Coordinates;
  zoom: number;
  point: Coordinates | null;
  onPointChange: (point: Coordinates) => void;
}) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const iconRef = useRef<LeafletDivIcon | null>(null);
  const pointRef = useRef(point);
  const onPointChangeRef = useRef(onPointChange);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    pointRef.current = point;
  }, [point]);

  useEffect(() => {
    onPointChangeRef.current = onPointChange;
  }, [onPointChange]);

  const syncMarker = useCallback((nextPoint: Coordinates | null) => {
    const map = mapRef.current;
    if (!map) return;

    if (!nextPoint) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    let marker = markerRef.current;
    if (!marker) {
      const L = leafletRef.current;
      const icon = iconRef.current;
      if (!L || !icon) return;
      marker = L.marker([nextPoint.lat, nextPoint.lng], {
        icon,
        draggable: true,
        title: "City center",
        alt: "Selected city center",
      }).addTo(map);
      marker.on("dragend", () => {
        const position = marker?.getLatLng();
        if (!position) return;
        onPointChangeRef.current({
          lat: Number(position.lat.toFixed(6)),
          lng: Number(position.lng.toFixed(6)),
        });
      });
      markerRef.current = marker;
    } else {
      marker.setLatLng([nextPoint.lat, nextPoint.lng]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    let invalidateTimer = 0;

    async function initializeMap() {
      try {
        const L = await loadLeaflet();
        if (cancelled || !elementRef.current) return;
        leafletRef.current = L;

        map = L.map(elementRef.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView([center.lat, center.lng], zoom);
        L.tileLayer(MAP_COLORS.tileUrl, {
          attribution: MAP_COLORS.tileAttribution,
          maxZoom: 19,
        }).addTo(map);

        const icon = L.divIcon({
          className: "",
          html: `<span style="display:block;width:24px;height:24px;border-radius:50% 50% 50% 0;background:${MAP_COLORS.secondary};border:3px solid white;box-shadow:0 2px 8px #0005;transform:rotate(-45deg)"></span>`,
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        });
        iconRef.current = icon;

        mapRef.current = map;
        syncMarker(pointRef.current);
        map.on("click", (event) => {
          onPointChangeRef.current({
            lat: Number(event.latlng.lat.toFixed(6)),
            lng: Number(event.latlng.lng.toFixed(6)),
          });
        });
        invalidateTimer = window.setTimeout(() => map?.invalidateSize(), 100);
        setLoading(false);
      } catch (mapError) {
        if (!cancelled) {
          setError(
            mapError instanceof Error ? mapError.message : "Could not load the map.",
          );
          setLoading(false);
        }
      }
    }

    void initializeMap();
    return () => {
      cancelled = true;
      window.clearTimeout(invalidateTimer);
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
      leafletRef.current = null;
      iconRef.current = null;
    };
  }, [center.lat, center.lng, syncMarker, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextPoint =
      point?.lat !== undefined && point.lng !== undefined
        ? { lat: point.lat, lng: point.lng }
        : null;
    syncMarker(nextPoint);
    if (nextPoint) {
      map.setView(nextPoint, Math.max(map.getZoom(), 12), { animate: true });
    }
  }, [point?.lat, point?.lng, syncMarker]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]">
      <div className="flex items-start gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-secondary-tint)] text-[var(--color-primary)]">
          <MapPin size={18} aria-hidden="true" />
        </span>
        <div>
          <h3 className="m-0 text-sm font-bold text-[var(--color-primary)]">
            Choose the city center
          </h3>
          <p className="mb-0 mt-1 text-xs leading-5 text-[var(--color-muted)]">
            Click the map or drag the pin. You can also enter coordinates below.
          </p>
        </div>
      </div>
      <div className="relative h-[300px] sm:h-[360px]">
        <div
          ref={elementRef}
          aria-label="Map for selecting the City/State center"
          className="h-full w-full"
        />
        {loading && (
          <div
            className="absolute inset-0 z-[500] flex items-center justify-center gap-2 bg-white/90 text-sm font-medium text-[var(--color-primary)]"
            role="status"
          >
            <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
            Loading map…
          </div>
        )}
      </div>
      <div className="min-h-12 border-t border-[var(--color-border)] px-4 py-3">
        {error ? (
          <p className="m-0 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : point ? (
          <p className="m-0 font-mono text-xs tabular-nums text-[var(--color-muted)]" aria-live="polite">
            {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
          </p>
        ) : (
          <p className="m-0 text-xs text-[var(--color-muted)]">
            No center selected yet.
          </p>
        )}
      </div>
    </div>
  );
}
