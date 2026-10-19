"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { loadLeaflet, MAP_COLORS } from "@/lib/leaflet";
import { findZoneAtPoint, getZoneName, type ZoneFeature } from "@/lib/geo/zones";
import { useClientLocale } from "@/lib/locale.client";

type Coordinates = { lat: number; lng: number };
type ZoneCollection = { features?: ZoneFeature[] };

export default function StationLocationPicker({
  initialPoint,
  onSelect,
}: {
  initialPoint: Coordinates;
  onSelect: (point: Coordinates, zoneName: string) => void;
}) {
  const { t } = useClientLocale();
  const mapElement = useRef<HTMLDivElement | null>(null);
  const initialPointRef = useRef(initialPoint);
  const selectionEnabledRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const [zones, setZones] = useState<ZoneFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectionEnabled, setSelectionEnabled] = useState(false);
  const zoneName = useMemo(
    () =>
      getZoneName(
        findZoneAtPoint([initialPoint.lng, initialPoint.lat], zones),
      ),
    [initialPoint.lat, initialPoint.lng, zones],
  );

  useEffect(() => {
    initialPointRef.current = initialPoint;
  }, [initialPoint]);

  useEffect(() => {
    selectionEnabledRef.current = selectionEnabled;
  }, [selectionEnabled]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    let marker: import("leaflet").Marker | null = null;
    let zoneFeatures: ZoneFeature[] = [];
    let invalidateTimer = 0;

    async function initializeMap() {
      try {
        const [L, response] = await Promise.all([
          loadLeaflet(),
          fetch("/geo/zone_polygon.geojson"),
        ]);
        if (!response.ok) throw new Error(t("admin.station_suggestions.location_map_error"));
        const collection = (await response.json()) as ZoneCollection;
        zoneFeatures = (collection.features ?? []).filter(
          (feature) =>
            feature.geometry?.type === "Polygon" ||
            feature.geometry?.type === "MultiPolygon",
        );
        if (!zoneFeatures.length) {
          throw new Error(t("admin.station_suggestions.location_zones_unavailable"));
        }
        if (cancelled || !mapElement.current) return;
        setZones(zoneFeatures);
        const initial = initialPointRef.current;
        map = L.map(mapElement.current).setView([initial.lat, initial.lng], 12);
        L.tileLayer(MAP_COLORS.tileUrl, {
          attribution: MAP_COLORS.tileAttribution,
          maxZoom: 19,
        }).addTo(map);

        const zonesLayer = L.featureGroup();
        const containingZoneLayer = L.featureGroup();
        zoneFeatures.forEach((feature) => {
          if (!feature.geometry) return;
          const containsInitialPoint = Boolean(
            findZoneAtPoint([initial.lng, initial.lat], [feature]),
          );
          const polygons =
            feature.geometry.type === "Polygon"
              ? [feature.geometry.coordinates]
              : feature.geometry.coordinates;
          polygons.forEach((polygon) => {
            const layer = L.polygon(
              polygon.map((ring) =>
                ring.map(([lng, lat]) => [lat, lng] as [number, number]),
              ),
              {
                color: MAP_COLORS.secondary,
                weight: 3,
                opacity: 0.95,
                fillColor: MAP_COLORS.secondary,
                fillOpacity: 0.12,
                interactive: false,
              },
            ).addTo(zonesLayer);
            if (containsInitialPoint) layer.addTo(containingZoneLayer);
          });
        });
        zonesLayer.addTo(map);

        const stationIcon = L.divIcon({
          className: "",
          html: `<span style="display:block;width:22px;height:22px;border-radius:50%;background:${MAP_COLORS.primary};border:3px solid white;box-shadow:0 1px 5px #0006"></span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        marker = L.marker([initial.lat, initial.lng], {
          icon: stationIcon,
        }).addTo(map);
        markerRef.current = marker;
        if (containingZoneLayer.getLayers().length) {
          map.fitBounds(containingZoneLayer.getBounds(), {
            padding: [32, 32],
            maxZoom: 13,
          });
        } else if (zonesLayer.getLayers().length) {
          map.fitBounds(zonesLayer.getBounds(), {
            padding: [32, 32],
            maxZoom: 12,
          });
        }
        map.on("click", (event) => {
          if (!selectionEnabledRef.current) return;
          const nextPoint = { lat: event.latlng.lat, lng: event.latlng.lng };
          const nextZone = findZoneAtPoint(
            [nextPoint.lng, nextPoint.lat],
            zoneFeatures,
          );
          if (!nextZone) {
            setError(t("admin.station_suggestions.location_outside_zones"));
            return;
          }
          setError("");
          marker?.setLatLng([nextPoint.lat, nextPoint.lng]);
          onSelectRef.current(nextPoint, getZoneName(nextZone));
        });
        invalidateTimer = window.setTimeout(() => map?.invalidateSize(), 100);
        setLoading(false);
      } catch (mapError) {
        if (!cancelled) {
          setError(
            mapError instanceof Error
              ? mapError.message
              : t("admin.station_suggestions.location_map_error"),
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
    };
  }, [t]);

  useEffect(() => {
    markerRef.current?.setLatLng([initialPoint.lat, initialPoint.lng]);
  }, [initialPoint.lat, initialPoint.lng]);

  return (
    <div className="station-location-picker">
      <div className="station-location-picker-heading">
        <strong>{t("admin.station_suggestions.station_location_title")}</strong>
        <p>{t("admin.station_suggestions.location_map_prompt")}</p>
      </div>
      <div className="station-location-picker-map">
        <div ref={mapElement} aria-label={t("admin.station_suggestions.location_map_aria")} />
        <div className="station-location-picker-legend" aria-hidden="true">
          <span>
            <i className="station-location-picker-zone-swatch" />
            {t("admin.station_suggestions.zone_map_legend")}
          </span>
          <span>
            <i className="station-location-picker-station-swatch" />
            {t("admin.station_suggestions.station_map_legend")}
          </span>
        </div>
        {loading && (
          <div className="station-location-picker-loading">
            <Loader2 size={18} className="spin" aria-hidden="true" />
            {t("admin.station_suggestions.location_map_loading")}
          </div>
        )}
      </div>
      <div className="station-location-picker-summary" aria-live="polite">
        <span className="station-location-picker-zone">
          <strong>{t("admin.station_suggestions.station_zones")}</strong>
          <span>{zoneName || "—"}</span>
        </span>
        <span className="station-location-picker-coordinates">
          {initialPoint.lat.toFixed(6)}, {initialPoint.lng.toFixed(6)}
        </span>
      </div>
      {error && (
        <p role="alert" className="station-suggestion-error">
          {error}
        </p>
      )}
      <div className="station-location-picker-actions">
        <button
          type="button"
          className="station-suggestion-adjust-location"
          disabled={loading || !zones.length}
          aria-pressed={selectionEnabled}
          onClick={() => {
            setError("");
            setSelectionEnabled((enabled) => !enabled);
          }}
        >
          {selectionEnabled
            ? t("admin.station_suggestions.finish_adjusting")
            : t("admin.station_suggestions.adjust_location")}
        </button>
        <span>
          {selectionEnabled
            ? t("admin.station_suggestions.location_adjustment_active")
            : t("admin.station_suggestions.location_adjustment_inactive")}
        </span>
      </div>
    </div>
  );
}
