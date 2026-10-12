"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import { useClientLocale } from "@/lib/locale.client";
import { loadLeaflet, MAP_COLORS } from "@/lib/leaflet";
import {
  findZoneAtPoint,
  getZoneName,
  type ZoneFeature,
} from "@/lib/geo/zones";
import type { TripPoint } from "@/lib/store/useTripStore";

export default function StationSuggestionModal({
  locationType,
  targetLocation,
  zones,
  zonesLoading,
  onClose,
  onSubmitted,
}: {
  locationType: "pickup" | "dropoff";
  targetLocation: TripPoint;
  zones: ZoneFeature[];
  zonesLoading: boolean;
  onClose: () => void;
  onSubmitted: (requestNumber: number) => void;
}) {
  const { t, locale } = useClientLocale();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const suggestedPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const [suggestedPoint, setSuggestedPoint] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [selectedZoneName, setSelectedZoneName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    let selectionMarker: import("leaflet").Marker | null = null;
    let invalidateTimer = 0;

    void loadLeaflet()
      .then((L) => {
        if (cancelled || !mapContainerRef.current) return;
        map = L.map(mapContainerRef.current).setView(
          [targetLocation.lat, targetLocation.lng],
          13,
        );
        L.tileLayer(MAP_COLORS.tileUrl, {
          attribution: MAP_COLORS.tileAttribution,
          maxZoom: 19,
        }).addTo(map);
        zones.forEach((feature) => {
          if (!feature.geometry) return;
          const polygons =
            feature.geometry.type === "Polygon"
              ? [feature.geometry.coordinates]
              : feature.geometry.coordinates;
          polygons.forEach((polygon) => {
            L.polygon(
              polygon.map((ring) =>
                ring.map(([lng, lat]) => [lat, lng] as [number, number]),
              ),
              {
                color: MAP_COLORS.secondary,
                weight: 2,
                fillOpacity: 0,
                interactive: false,
              },
            )
              .addTo(map!);
          });
        });
        L.marker([targetLocation.lat, targetLocation.lng], {
          icon: L.divIcon({
            className: "",
            html: `<span style="display:block;width:18px;height:18px;border-radius:50%;background:${MAP_COLORS.primary};border:3px solid white;box-shadow:0 1px 5px #0006"></span>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        })
          .addTo(map)
          .bindTooltip(t("create.station_suggestion_target"), {
            direction: "top",
          });

        const placeSelection = (lat: number, lng: number) => {
          if (!map) return;
          if (!zones.length) {
            setError(
              zonesLoading
                ? t("create.station_suggestion_zones_loading")
                : t("create.station_suggestion_zones_unavailable"),
            );
            return;
          }
          const zone = findZoneAtPoint([lng, lat], zones);
          if (!zone) {
            setError(t("create.station_suggestion_outside_zone"));
            return;
          }
          setError("");
          setSelectedZoneName(getZoneName(zone));
          const point = { lat, lng };
          suggestedPointRef.current = point;
          setSuggestedPoint(point);
          if (selectionMarker) {
            selectionMarker.setLatLng([lat, lng]);
            return;
          }
          selectionMarker = L.marker([lat, lng], { draggable: true })
            .addTo(map)
            .bindTooltip(t("create.station_suggestion_pin"), {
              direction: "top",
            });
          selectionMarker.on("dragend", () => {
            const point = selectionMarker?.getLatLng();
            if (!point) return;
            const zone = findZoneAtPoint([point.lng, point.lat], zones);
            if (!zone) {
              if (suggestedPointRef.current) {
                selectionMarker?.setLatLng([
                  suggestedPointRef.current.lat,
                  suggestedPointRef.current.lng,
                ]);
              }
              setError(t("create.station_suggestion_outside_zone"));
              return;
            }
            setError("");
            setSelectedZoneName(getZoneName(zone));
            const nextPoint = { lat: point.lat, lng: point.lng };
            suggestedPointRef.current = nextPoint;
            setSuggestedPoint(nextPoint);
          });
        };
        map.on("click", (event) =>
          placeSelection(event.latlng.lat, event.latlng.lng),
        );
        invalidateTimer = window.setTimeout(() => map?.invalidateSize(), 100);
      })
      .catch(() => {
        if (!cancelled) setError(t("create.station_suggestion_map_error"));
      });

    return () => {
      cancelled = true;
      window.clearTimeout(invalidateTimer);
      map?.remove();
    };
  }, [targetLocation.lat, targetLocation.lng, t, zones, zonesLoading]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, submitting]);

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!suggestedPoint) {
      setError(t("create.station_suggestion_pick_point_error"));
      return;
    }
    if (!findZoneAtPoint([suggestedPoint.lng, suggestedPoint.lat], zones)) {
      setError(t("create.station_suggestion_outside_zone"));
      return;
    }
    if (description.trim().length < 3) {
      setError(t("create.station_suggestion_description_error"));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/station-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationType,
          targetLocation: {
            address: targetLocation.address,
            lat: targetLocation.lat,
            lng: targetLocation.lng,
          },
          suggestedPoint,
          description: description.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error ?? t("create.station_suggestion_submit_error"),
        );
      }
      onSubmitted(data.requestNumber);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("create.station_suggestion_submit_error"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="station-suggestion-overlay">
      <section
        aria-labelledby="station-suggestion-title"
        aria-modal="true"
        className="station-suggestion-dialog"
        dir={locale === "ar" ? "rtl" : "ltr"}
        role="dialog"
      >
        <header className="station-suggestion-header">
          <div>
            <h2 id="station-suggestion-title">
              {t("create.station_suggestion_title")}
            </h2>
            <p>
              {zonesLoading
                ? t("create.station_suggestion_zones_loading")
                : zones.length
                  ? t("create.station_suggestion_map_prompt")
                  : t("create.station_suggestion_zones_unavailable")}
            </p>
          </div>
          <button
            type="button"
            className="station-suggestion-close"
            aria-label={t("create.close")}
            onClick={onClose}
            disabled={submitting}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="station-suggestion-map-wrap">
          <div
            ref={mapContainerRef}
            className="station-suggestion-map"
            aria-label={t("create.station_suggestion_map_aria")}
          />
          <div className="station-suggestion-map-hint">
            <MapPin size={15} aria-hidden="true" />
            <span>
              {suggestedPoint
                ? t("create.station_suggestion_point_selected")
                : t("create.station_suggestion_map_hint")}
              {selectedZoneName ? (
                <strong>
                  {" "}
                  {t("create.station_suggestion_zone_label")}: {selectedZoneName}
                </strong>
              ) : null}
            </span>
          </div>
        </div>

        <form onSubmit={submitRequest} className="station-suggestion-form">
          <label htmlFor="station-suggestion-description">
            {t("create.station_suggestion_description")} *
          </label>
          <textarea
            id="station-suggestion-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
            rows={3}
            required
            minLength={3}
            autoFocus
          />
          {error && (
            <p role="alert" className="station-suggestion-error">
              {error}
            </p>
          )}
          <div className="station-suggestion-actions">
            <button
              type="button"
              className="station-suggestion-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              {t("create.cancel")}
            </button>
            <button
              type="submit"
              className="station-suggestion-submit"
              disabled={
                submitting ||
                !zones.length ||
                !suggestedPoint ||
                description.trim().length < 3
              }
            >
              {submitting && <Loader2 size={16} className="spin" aria-hidden="true" />}
              {t("create.station_suggestion_submit")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
