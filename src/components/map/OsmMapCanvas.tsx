"use client";

import { useEffect, useRef } from "react";
import { OSM_THEMES, type OsmMapThemeName } from "@/lib/config/mapSettings";

type LeafletModule = typeof import("leaflet");

export interface OsmPoint {
  lat: number;
  lng: number;
}

interface ZonePreviewSettings {
  showZones: boolean;
  showZoneLabels: boolean;
  maskOutsideZones: boolean;
  regionCode: "EG-CAIRO" | "SA" | "AE-ABU-DHABI";
}

interface OsmMapCanvasProps {
  center?: OsmPoint;
  zoom?: number;
  className?: string;
  style?: React.CSSProperties;
  cursor?: string;
  theme?: OsmMapThemeName;
  zoneSettings?: ZonePreviewSettings;
  onReady?: (map: L.Map | null) => void;
  onClick?: (point: OsmPoint) => void;
}

const CAIRO = { lat: 30.0444, lng: 31.2357 };

async function loadZoneData() {
  const response = await fetch("/geo/zone_polygon.geojson");
  if (!response.ok)
    return [] as Array<{ geometry?: { type?: string; coordinates?: unknown } }>;
  const geojson = await response.json();
  return geojson.features ?? [];
}

export default function OsmMapCanvas({
  center = CAIRO,
  zoom = 11,
  className,
  style,
  cursor,
  theme = "app",
  zoneSettings,
  onReady,
  onClick,
}: OsmMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const mapRef = useRef<any>(null);
  const overlayRef = useRef<any>(null);
  const zoneLayerRef = useRef<any>(null);
  const readyRef = useRef(onReady);
  const clickRef = useRef(onClick);
  const viewRef = useRef({ center, zoom });

  useEffect(() => {
    readyRef.current = onReady;
    clickRef.current = onClick;
    viewRef.current = { center, zoom };
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    void import("leaflet").then((leafletModule) => {
      if (cancelled || !containerRef.current) return;
      const L = leafletModule.default ?? leafletModule;
      leafletRef.current = L;

      const { center: initialCenter, zoom: initialZoom } = viewRef.current;
      const map = L.map(containerRef.current, {
        center: [initialCenter.lat, initialCenter.lng],
        zoom: initialZoom,
        zoomControl: false,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      map.on("click", (event: any) => {
        clickRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
      });
      overlayRef.current = L.layerGroup().addTo(map);
      zoneLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      readyRef.current?.(map);
    });

    return () => {
      cancelled = true;
      const map = mapRef.current;
      if (map) {
        readyRef.current?.(null);
        overlayRef.current?.clearLayers();
        zoneLayerRef.current?.clearLayers();
        overlayRef.current?.remove();
        zoneLayerRef.current?.remove();
        map.remove();
      }
      mapRef.current = null;
      overlayRef.current = null;
      zoneLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mapRef.current) mapRef.current.setView([center.lat, center.lng], zoom);
  }, [center.lat, center.lng, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    const themeColors = OSM_THEMES[theme];
    const overlay = overlayRef.current;
    const zoneLayer = zoneLayerRef.current;
    if (!overlay || !zoneLayer) return;

    let cancelled = false;

    const renderPreview = async () => {
      overlay.clearLayers();
      zoneLayer.clearLayers();

      if (
        !zoneSettings ||
        !zoneSettings.showZones ||
        zoneSettings.regionCode !== "EG-CAIRO"
      ) {
        return;
      }

      const features = await loadZoneData();
      if (
        cancelled ||
        !mapRef.current ||
        !overlayRef.current ||
        !zoneLayerRef.current
      )
        return;

      const primary = themeColors.primary;
      const secondary = themeColors.secondary;
      const accent = themeColors.accent;

      if (zoneSettings.maskOutsideZones) {
        const bounds = map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        L.polygon(
          [
            [sw.lat, sw.lng],
            [sw.lat, ne.lng],
            [ne.lat, ne.lng],
            [ne.lat, sw.lng],
            [sw.lat, sw.lng],
          ],
          {
            color: "transparent",
            fillColor: themeColors.surface,
            fillOpacity: 0.75,
            weight: 0,
          },
        ).addTo(overlayRef.current);
      }

      const activeZoneLayer = zoneLayerRef.current;
      features.forEach((feature: any) => {
        const geometry = feature?.geometry;
        if (!geometry || geometry.type !== "Polygon") return;
        const polygon = L.polygon(
          geometry.coordinates[0].map(([lng, lat]: [number, number]) => [
            lat,
            lng,
          ]),
          {
            color: primary,
            weight: 2,
            opacity: zoneSettings.showZones ? 1 : 0,
            fillColor: "transparent",
            fillOpacity: 0,
            dashArray: zoneSettings.showZoneLabels ? undefined : "6 6",
          },
        );
        polygon.addTo(activeZoneLayer);

        if (zoneSettings.showZoneLabels) {
          const center = polygon.getCenter();
          L.marker([center.lat, center.lng], {
            icon: L.divIcon({
              className: "",
              html: `<div style="background:${themeColors.surface};color:${secondary};border:1px solid ${primary};padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.08)">Zone</div>`,
              iconSize: [70, 24],
              iconAnchor: [35, 12],
            }),
            interactive: false,
          }).addTo(activeZoneLayer);
        }
      });

      if (zoneSettings.maskOutsideZones) {
        const bounds = map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        L.rectangle(
          [
            [sw.lat + 0.06, sw.lng + 0.06],
            [ne.lat - 0.06, ne.lng - 0.06],
          ],
          {
            color: accent,
            weight: 1,
            opacity: 0.45,
            fill: false,
          },
        ).addTo(activeZoneLayer);
      }
    };

    void renderPreview();

    return () => {
      cancelled = true;
      overlay.clearLayers();
      zoneLayer.clearLayers();
    };
  }, [theme, zoneSettings]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", cursor, ...style }}
    />
  );
}
