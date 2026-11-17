"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, LocateFixed, Maximize2 } from "lucide-react";
import type { Map as LeafletMap } from "leaflet";
import { loadLeaflet, MAP_COLORS } from "@/lib/leaflet";
import { parseDriverLocationUpdate } from "@/lib/liveLocation/types";
import type { DriverLocationUpdate } from "@/lib/liveLocation/types";

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

const LOCATION_POLL_INTERVAL_MS = 5_000;
const LOCATION_STALE_AFTER_MS = 45_000;

function markerHtml(color: string, ring: string, order?: number) {
  const label = order == null ? "" : String(order);
  return `<span style="display:flex;width:22px;height:22px;border-radius:50%;background:${color};border:3px solid ${ring};box-shadow:0 2px 6px rgba(11,30,61,.25);align-items:center;justify-content:center;color:#fff;font:700 10px/1 sans-serif">${label}</span>`;
}

export default function AdminTripMap({
  points,
  routePoints = points,
  routeGeometry,
  walkingConnections = [],
  stationOnly = false,
  focusPoint,
  liveLocationUrl,
}: {
  points: TripMapPoint[];
  routePoints?: TripMapPoint[];
  routeGeometry?: [number, number][];
  walkingConnections?: TripMapConnection[];
  stationOnly?: boolean;
  focusPoint?: { lat: number; lng: number } | null;
  liveLocationUrl?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const routeLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const driverLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const routeBoundsRef = useRef<import("leaflet").LatLngBounds | null>(null);
  const driverPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [directionsError, setDirectionsError] = useState(false);
  const [location, setLocation] = useState<DriverLocationUpdate | null>(null);
  const [locationState, setLocationState] = useState<
    "waiting" | "live" | "stale" | "error" | "inactive"
  >(liveLocationUrl ? "waiting" : "inactive");
  const [now, setNow] = useState(0);

  const googleMapsUrl = useMemo(() => {
    if (stationOnly || routePoints.length < 2) return null;
    const [origin, ...remaining] = routePoints;
    const destination = remaining.pop();
    if (!origin || !destination) return null;
    const params = new URLSearchParams({
      api: "1",
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      travelmode: "driving",
    });
    if (remaining.length) {
      params.set(
        "waypoints",
        remaining
          .slice(0, 20)
          .map((point) => `${point.lat},${point.lng}`)
          .join("|"),
      );
    }
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [routePoints, stationOnly]);

  const isStale =
    liveLocationUrl !== undefined &&
    location !== null &&
    (location.stale === true ||
      (now > 0 &&
        now - Date.parse(location.receivedAt) >= LOCATION_STALE_AFTER_MS));
  const displayedLocation =
    liveLocationUrl === undefined ? null : location;

  const fitRoute = useCallback(() => {
    const map = mapRef.current;
    const bounds = routeBoundsRef.current;
    if (map && bounds?.isValid()) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
    }
  }, []);

  const centerDriver = useCallback(() => {
    const map = mapRef.current;
    const point = driverPointRef.current;
    if (map && point) {
      map.setView([point.lat, point.lng], Math.max(map.getZoom(), 15));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let invalidateTimer: number | null = null;

    void loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current) return;
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
        routeLayerRef.current = L.layerGroup().addTo(map);
        driverLayerRef.current = L.layerGroup().addTo(map);
        setMapReady(true);
        invalidateTimer = window.setTimeout(() => map.invalidateSize(), 150);
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });

    return () => {
      cancelled = true;
      if (invalidateTimer !== null) window.clearTimeout(invalidateTimer);
      routeLayerRef.current?.clearLayers();
      driverLayerRef.current?.clearLayers();
      routeLayerRef.current = null;
      driverLayerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      routeBoundsRef.current = null;
      driverPointRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (stationOnly) map.scrollWheelZoom.enable();
    else map.scrollWheelZoom.disable();
  }, [mapReady, stationOnly]);

  useEffect(() => {
    const endpoint = liveLocationUrl;
    if (!endpoint) return;

    let disposed = false;
    let inFlight = false;
    let interval: number | null = null;
    let controller: AbortController | null = null;
    const refresh = async () => {
      if (
        disposed ||
        inFlight ||
        document.visibilityState !== "visible"
      ) {
        return;
      }
      inFlight = true;
      controller = new AbortController();
      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error("Unable to load driver location");
        const result =
          payload && typeof payload === "object"
            ? (payload as { active?: unknown; location?: unknown })
            : null;
        if (disposed) return;
        if (result?.active === false) {
          setLocation(null);
          setLocationState("inactive");
          if (interval !== null) window.clearInterval(interval);
          return;
        }
        if (result?.active !== true) {
          throw new Error("Unexpected driver location response");
        }
        const next =
          result?.location == null
            ? null
            : parseDriverLocationUpdate(result.location);
        if (result.location != null && !next) {
          throw new Error("Invalid driver location response");
        }
        setLocation(next);
        setLocationState(next ? (next.stale ? "stale" : "live") : "waiting");
      } catch {
        if (!disposed && !controller?.signal.aborted) {
          setLocationState("error");
        }
      } finally {
        inFlight = false;
        controller = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    interval = window.setInterval(() => void refresh(), LOCATION_POLL_INTERVAL_MS);
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      controller?.abort();
      if (interval !== null) window.clearInterval(interval);
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [liveLocationUrl]);

  useEffect(() => {
    if (!mapReady) return;
    let cancelled = false;
    void loadLeaflet().then((L) => {
      const map = mapRef.current;
      const layer = routeLayerRef.current;
      if (cancelled || !map || !layer) return;
      layer.clearLayers();
      const bounds = L.latLngBounds([]);
      const fitPoints = new Map<string, { lat: number; lng: number }>();
      for (const point of [...points, ...routePoints]) {
        if (
          Number.isFinite(point.lat) &&
          Number.isFinite(point.lng)
        ) {
          fitPoints.set(`${point.lat},${point.lng}`, point);
        }
      }
      for (const point of fitPoints.values()) bounds.extend([point.lat, point.lng]);

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
            html: markerHtml(color, "#fff", point.order),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        })
          .addTo(layer)
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
            weight: 3,
            opacity: 0.9,
            dashArray: "5 7",
          },
        )
          .addTo(layer)
          .bindTooltip("Walk to station", { sticky: true });
      });

      const hasGeometry = Boolean(routeGeometry && routeGeometry.length > 1);
      if (!stationOnly && hasGeometry) {
        L.polyline(routeGeometry!, {
          color: MAP_COLORS.route,
          weight: 5,
          opacity: 0.9,
        }).addTo(layer);
        routeGeometry!.forEach(([lat, lng]) => bounds.extend([lat, lng]));
      } else if (!stationOnly && routePoints.length > 1) {
        const [origin, ...remainingPoints] = routePoints;
        const destination = remainingPoints.pop();
        if (origin && destination) {
          const routeLine = L.polyline(
            routePoints.map((point) => [point.lat, point.lng]),
            {
              color: MAP_COLORS.route,
              weight: 5,
              opacity: 0.8,
              dashArray: "7 8",
            },
          ).addTo(layer);
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
              if (!response.ok) {
                throw new Error("Unable to load road route");
              }
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
              } else {
                setDirectionsError(true);
              }
            })
            .catch(() => {
              if (!cancelled) setDirectionsError(true);
            });
        }
      }

      routeBoundsRef.current = bounds;
      if (focusPoint) map.setView([focusPoint.lat, focusPoint.lng], 17);
      else if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
      else map.setView([30.0444, 31.2357], 11);
    });
    return () => {
      cancelled = true;
    };
  }, [
    focusPoint,
    mapReady,
    points,
    routeGeometry,
    routePoints,
    stationOnly,
    walkingConnections,
  ]);

  useEffect(() => {
    const layer = driverLayerRef.current;
    if (!mapReady || !layer) return;
    let cancelled = false;
    void loadLeaflet().then((L) => {
      if (cancelled || !driverLayerRef.current) return;
      const activeLayer = driverLayerRef.current;
      activeLayer.clearLayers();
      if (!displayedLocation) {
        driverPointRef.current = null;
        return;
      }
      const point = { lat: displayedLocation.lat, lng: displayedLocation.lng };
      driverPointRef.current = point;
      const stale = displayedLocation.stale === true;
      const marker = L.divIcon({
        className: "",
        html: `<span style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border:3px solid #fff;border-radius:50%;background:${stale ? MAP_COLORS.muted : MAP_COLORS.accent};color:${MAP_COLORS.primary};font:900 16px/1 sans-serif;box-shadow:0 2px 8px rgba(11,30,61,.4);transform:rotate(${displayedLocation.heading ?? 0}deg)">▲</span>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      if (
        displayedLocation.accuracy !== null &&
        displayedLocation.accuracy > 0 &&
        displayedLocation.accuracy <= 1_000
      ) {
        L.circle([point.lat, point.lng], {
          radius: displayedLocation.accuracy,
          color: stale ? MAP_COLORS.muted : MAP_COLORS.accent,
          weight: 1,
          fillOpacity: 0.08,
        }).addTo(activeLayer);
      }
      L.marker([point.lat, point.lng], {
        icon: marker,
        keyboard: false,
        zIndexOffset: 1_000,
        title: "Driver location",
      }).addTo(activeLayer);
    });
    return () => {
      cancelled = true;
    };
  }, [displayedLocation, mapReady]);

  const displayedLocationState =
    liveLocationUrl === undefined
      ? "inactive"
      : locationState === "error"
        ? "error"
        : locationState === "inactive"
          ? "inactive"
          : displayedLocation && isStale
            ? "stale"
            : displayedLocation
              ? "live"
              : locationState;
  const locationStatusLabel =
    displayedLocationState === "live"
      ? `Driver live · updated ${Math.max(0, Math.floor((now - Date.parse(displayedLocation?.receivedAt ?? "")) / 1_000))}s ago`
      : displayedLocationState === "stale"
        ? "Driver location is stale"
        : displayedLocationState === "waiting"
          ? "Waiting for driver location"
          : displayedLocationState === "error"
            ? "Could not refresh driver location"
            : displayedLocationState === "inactive" && liveLocationUrl
                    ? "Live tracking is no longer active"
              : "Route overview";
  const legendItems: { label: string; color: string; driver?: boolean }[] =
    stationOnly
            ? [{ label: "Station", color: MAP_COLORS.accent }]
            : [
                { label: "Origin", color: MAP_COLORS.secondary },
                { label: "Destination", color: MAP_COLORS.primary },
                { label: "Stop / station", color: MAP_COLORS.accent },
                ...(displayedLocation
                  ? [{ label: "Driver", color: MAP_COLORS.accent, driver: true }]
                  : []),
              ];
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <strong
          style={{
            color: "var(--color-primary)",
            fontSize: 13,
            fontWeight: 700,
          }}
          aria-live="polite"
        >
          {locationStatusLabel}
        </strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" onClick={fitRoute} style={controlStyle}>
            <Maximize2 size={15} aria-hidden="true" />
            Fit route
          </button>
          {liveLocationUrl && displayedLocation && (
            <button type="button" onClick={centerDriver} style={controlStyle}>
              <LocateFixed size={15} aria-hidden="true" />
              Center driver
            </button>
          )}
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...controlStyle, textDecoration: "none" }}
            >
              <ExternalLink size={15} aria-hidden="true" />
              View in Google Maps
            </a>
          )}
        </div>
      </div>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "clamp(260px, 38vh, 380px)",
          minHeight: 260,
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid var(--color-border)",
          background: "var(--color-primary-tint)",
        }}
      >
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        {mapError && (
          <p
            role="alert"
            style={{
              position: "absolute",
              inset: 12,
              display: "grid",
              placeItems: "center",
              margin: 0,
              padding: 16,
              borderRadius: 10,
              background: "var(--color-panel)",
              color: "var(--color-danger)",
              textAlign: "center",
            }}
          >
            Map failed to load. Route details remain available below.
          </p>
        )}
      </div>
      <div
        aria-label="Map legend"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 16px",
          color: "var(--color-muted)",
          fontSize: 12,
        }}
      >
        {legendItems.map(({ label, color, driver }) => (
          <span key={label} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            {driver ? (
              <i
                aria-hidden="true"
                style={{
                  color: MAP_COLORS.primary,
                  fontSize: 12,
                  fontStyle: "normal",
                  lineHeight: 1,
                }}
              >
                ▲
              </i>
            ) : (
              <i
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: color,
                  display: "inline-block",
                }}
              />
            )}
            {label}
          </span>
        ))}
        {displayedLocation?.accuracy != null && (
          <span>GPS accuracy ±{Math.round(displayedLocation.accuracy)} m</span>
        )}
        {isStale && <span>Driver position may be outdated</span>}
      </div>
      {directionsError && (
        <p
          role="status"
          style={{
            margin: 0,
            color: "var(--color-muted)",
            fontSize: 12,
          }}
        >
          Driving route unavailable; showing ordered stop connections.
        </p>
      )}
    </div>
  );
}

const controlStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 44,
  padding: "8px 11px",
  border: "1px solid var(--color-border)",
  borderRadius: 9,
  background: "var(--color-panel)",
  color: "var(--color-primary)",
  font: "inherit",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
