"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { setLocaleCookie, useClientLocale } from "@/lib/locale.client";
import type { Locale } from "@/lib/i18n/config";
import { loadLeaflet, MAP_COLORS } from "@/lib/leaflet";
import {
  deriveLiveViewerState,
  getLiveViewerPollDelayMs,
  isUnavailableLiveViewerStatus,
  parsePublicLiveShare,
  retryAfterHeaderMs,
  type LiveViewerState,
  type PublicLiveShare,
} from "@/lib/liveShare/viewer";
import { resolveLiveTileUrl } from "@/lib/liveShare/tileUrl";

interface LiveLocationViewerProps {
  token: string;
  initialLocale: Locale;
}

const LIVE_TILE_URL = resolveLiveTileUrl(
  process.env.NEXT_PUBLIC_LIVE_TILE_URL,
  MAP_COLORS.tileUrl,
);

function readRouteCoordinates(value: unknown): [number, number][] | null {
  if (!Array.isArray(value) || !value[0] || typeof value[0] !== "object") {
    return null;
  }
  const coordinates = (value[0] as { coordinates?: unknown }).coordinates;
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    !coordinates.every(
      (point) =>
        Array.isArray(point) &&
        point.length >= 2 &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1]),
    )
  ) {
    return null;
  }
  return coordinates.map(
    (point) => [point[0], point[1]] as [number, number],
  );
}

export default function LiveLocationViewer({
  token,
  initialLocale,
}: LiveLocationViewerProps) {
  const { locale, dir, t } = useClientLocale(initialLocale);
  const [data, setData] = useState<PublicLiveShare | null>(null);
  const [state, setState] = useState<LiveViewerState>("loading");
  const [serverElapsedMs, setServerElapsedMs] = useState(0);
  const [connectionProblem, setConnectionProblem] = useState(false);
  const [routePath, setRoutePath] = useState<[number, number][] | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [followAvailable, setFollowAvailable] = useState(false);

  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const baseLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const locationLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const fitDoneRef = useRef(false);
  const userPannedRef = useRef(false);
  const routeRequestedRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const failureCountRef = useRef(0);
  const responsePerfRef = useRef<number | null>(null);
  const latestDataRef = useRef<PublicLiveShare | null>(null);
  const terminalRef = useRef(false);
  const generationRef = useRef(0);
  const tokenPath = `/api/live/${encodeURIComponent(token)}`;
  const pickupLat = data?.pickup?.lat;
  const pickupLng = data?.pickup?.lng;
  const dropoffLat = data?.dropoff?.lat;
  const dropoffLng = data?.dropoff?.lng;
  const locationLat = data?.location?.lat;
  const locationLng = data?.location?.lng;
  const locationAccuracy = data?.location?.accuracy;

  const applyPayload = useCallback((next: PublicLiveShare) => {
    const perfNow = performance.now();
    responsePerfRef.current = perfNow;
    latestDataRef.current = next;
    setData(next);
    setServerElapsedMs(0);
    setConnectionProblem(false);
    failureCountRef.current = 0;
    if (next.state === "ended") {
      terminalRef.current = true;
      baseLayerRef.current?.clearLayers();
      locationLayerRef.current?.clearLayers();
      setRoutePath(null);
      setFollowAvailable(false);
      setState("ended");
      return true;
    }
    setState(deriveLiveViewerState(next, 0));
    return false;
  }, []);

  const pollRef = useRef<() => Promise<void>>(async () => undefined);
  const schedulePoll = useCallback(
    (delayMs: number | null) => {
      if (delayMs === null || terminalRef.current) return;
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current);
      }
      pollTimerRef.current = window.setTimeout(() => {
        pollTimerRef.current = null;
        void pollRef.current();
      }, delayMs);
    },
    [],
  );

  const poll = useCallback(async () => {
    if (
      terminalRef.current ||
      document.visibilityState !== "visible" ||
      inFlightRef.current
    ) {
      return;
    }
    inFlightRef.current = true;
    const controller = new AbortController();
    requestRef.current = controller;
    const requestGeneration = generationRef.current;
    let retryAfterMs: number | null = null;
    let timedOut = false;
    const requestTimeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15_000);
    try {
      const response = await fetch(tokenPath, {
        cache: "no-store",
        signal: controller.signal,
      });
      retryAfterMs = retryAfterHeaderMs(response.headers.get("Retry-After"));
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (
        controller.signal.aborted ||
        generationRef.current !== requestGeneration
      ) {
        return;
      }
      if (isUnavailableLiveViewerStatus(response.status)) {
        terminalRef.current = true;
        setState("unavailable");
        setConnectionProblem(false);
        setData(null);
        setRoutePath(null);
        baseLayerRef.current?.clearLayers();
        locationLayerRef.current?.clearLayers();
        setFollowAvailable(false);
        return;
      }
      const publicData = parsePublicLiveShare(payload);
      if (!response.ok || !publicData) {
        throw new Error("Live location response unavailable");
      }
      const ended = applyPayload(publicData);
      if (ended) return;
      schedulePoll(
        getLiveViewerPollDelayMs({
          failureCount: 0,
          nextAfterMs: null,
          retryAfterMs,
        }),
      );
    } catch {
      if (
        (controller.signal.aborted && !timedOut) ||
        generationRef.current !== requestGeneration
      ) {
        return;
      }
      failureCountRef.current += 1;
      setConnectionProblem(true);
      setState("connection");
      schedulePoll(
        getLiveViewerPollDelayMs({
          failureCount: failureCountRef.current,
          retryAfterMs,
        }),
      );
    } finally {
      window.clearTimeout(requestTimeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        inFlightRef.current = false;
      }
    }
  }, [applyPayload, schedulePoll, tokenPath]);

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  useEffect(() => {
    terminalRef.current = false;
    void pollRef.current();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        generationRef.current += 1;
        if (pollTimerRef.current !== null) {
          window.clearTimeout(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        requestRef.current?.abort();
        requestRef.current = null;
        inFlightRef.current = false;
        return;
      }
      if (!terminalRef.current) {
        generationRef.current += 1;
        requestRef.current?.abort();
        requestRef.current = null;
        inFlightRef.current = false;
        void pollRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      generationRef.current += 1;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      requestRef.current?.abort();
      requestRef.current = null;
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [token]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !responsePerfRef.current) {
        return;
      }
      const elapsed = Math.max(0, performance.now() - responsePerfRef.current);
      setServerElapsedMs(elapsed);
      const latest = latestDataRef.current;
      if (latest && !connectionProblem) {
        setState(deriveLiveViewerState(latest, elapsed));
      }
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [connectionProblem]);

  useEffect(() => {
    if (
      !data ||
      data.state === "ended" ||
      pickupLat === undefined ||
      pickupLng === undefined ||
      dropoffLat === undefined ||
      dropoffLng === undefined ||
      routeRequestedRef.current
    ) {
      return;
    }
    routeRequestedRef.current = true;
    const query = new URLSearchParams({
      origin: `${pickupLat},${pickupLng}`,
      dest: `${dropoffLat},${dropoffLng}`,
    });
    void fetch(`/api/directions?${query.toString()}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((result: unknown) => {
        const coordinates = readRouteCoordinates(result);
        if (coordinates) setRoutePath(coordinates);
      })
      .catch(() => {
        setRoutePath(null);
      });
  }, [data, pickupLat, pickupLng, dropoffLat, dropoffLng]);

  useEffect(() => {
    let disposed = false;
    if (!mapElementRef.current || mapRef.current) return;
    void loadLeaflet()
      .then((L) => {
        if (disposed || !mapElementRef.current) return;
        const map = L.map(mapElementRef.current, {
          center: [30.0444, 31.2357],
          zoom: 12,
          zoomControl: true,
          attributionControl: true,
        });
        L.tileLayer(LIVE_TILE_URL, {
          attribution: MAP_COLORS.tileAttribution,
          maxZoom: 19,
          referrerPolicy: "origin",
        }).addTo(map);
        map.on("dragstart", () => {
          userPannedRef.current = true;
        });
        mapRef.current = map;
        baseLayerRef.current = L.layerGroup().addTo(map);
        locationLayerRef.current = L.layerGroup().addTo(map);
        setMapReady(true);
      })
      .catch(() => {
        if (!disposed) setMapFailed(true);
      });
    return () => {
      disposed = true;
      baseLayerRef.current?.clearLayers();
      locationLayerRef.current?.clearLayers();
      mapRef.current?.remove();
      baseLayerRef.current = null;
      locationLayerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const baseLayer = baseLayerRef.current;
    if (
      !map ||
      !baseLayer ||
      !mapReady ||
      pickupLat === undefined ||
      pickupLng === undefined ||
      dropoffLat === undefined ||
      dropoffLng === undefined
    ) {
      return;
    }
    let cancelled = false;
    void loadLeaflet().then((L) => {
      if (cancelled || !mapRef.current || !baseLayerRef.current) return;
      const activeMap = mapRef.current;
      const layers = baseLayerRef.current;
      layers.clearLayers();
      const fallback = [
        [pickupLat, pickupLng] as [number, number],
        [dropoffLat, dropoffLng] as [number, number],
      ];
      const routePoints = routePath ?? fallback;
      L.polyline(routePoints, {
        color: MAP_COLORS.route,
        weight: routePath ? 5 : 3,
        opacity: 0.9,
        dashArray: routePath ? undefined : "8 8",
      }).addTo(layers);
      const pickupIcon = L.divIcon({
        className: "",
        html: '<span class="live-viewer-pin pickup"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const dropoffIcon = L.divIcon({
        className: "",
        html: '<span class="live-viewer-pin dropoff"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      L.marker([pickupLat, pickupLng], {
        icon: pickupIcon,
        keyboard: false,
      }).addTo(layers);
      L.marker([dropoffLat, dropoffLng], {
        icon: dropoffIcon,
        keyboard: false,
      }).addTo(layers);
      if (!fitDoneRef.current) {
        const bounds = L.latLngBounds(routePoints);
        if (locationLat !== undefined && locationLng !== undefined) {
          bounds.extend([locationLat, locationLng]);
        }
        activeMap.fitBounds(bounds, { padding: [42, 42], maxZoom: 15 });
        fitDoneRef.current = true;
      }
      setFollowAvailable(true);
    });
    return () => {
      cancelled = true;
    };
  }, [
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    locationLat,
    locationLng,
    mapReady,
    routePath,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const layers = locationLayerRef.current;
    if (!map || !layers || !mapReady) return;
    let cancelled = false;
    void loadLeaflet().then((L) => {
      if (cancelled || !locationLayerRef.current || !mapRef.current) return;
      const activeLayers = locationLayerRef.current;
      const activeMap = mapRef.current;
      activeLayers.clearLayers();
      if (locationLat !== undefined && locationLng !== undefined) {
        const point: [number, number] = [locationLat, locationLng];
        const stale = state === "stale";
        if (locationAccuracy !== null && locationAccuracy !== undefined) {
          L.circle(point, {
            radius: Math.min(locationAccuracy, 1_000),
            color: MAP_COLORS.secondary,
            weight: 1,
            opacity: stale ? 0.35 : 0.65,
            fillColor: MAP_COLORS.secondary,
            fillOpacity: stale ? 0.06 : 0.14,
          }).addTo(activeLayers);
        }
        L.circleMarker(point, {
          radius: 10,
          color: "#fff",
          weight: 3,
          fillColor: stale ? "#647575" : MAP_COLORS.primary,
          fillOpacity: stale ? 0.55 : 1,
        }).addTo(activeLayers);
        if (!userPannedRef.current && state !== "waiting") {
          activeMap.panTo(point, { animate: false });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [locationLat, locationLng, locationAccuracy, mapReady, state]);

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    userPannedRef.current = false;
    const location = data?.location;
    if (location) {
      map.panTo([location.lat, location.lng]);
      return;
    }
    if (data?.pickup && data.dropoff) {
      map.fitBounds(
        [
          [data.pickup.lat, data.pickup.lng],
          [data.dropoff.lat, data.dropoff.lng],
        ],
        { padding: [42, 42], maxZoom: 15 },
      );
    }
  };

  const changeLocale = (nextLocale: Locale) => {
    setLocaleCookie(nextLocale);
  };

  const elapsedSeconds =
    data?.location && state !== "loading"
      ? Math.max(
          0,
          Math.floor(data.location.ageSeconds + serverElapsedMs / 1_000),
        )
      : null;
  const elapsedLabel =
    elapsedSeconds === null
      ? null
      : elapsedSeconds >= 60
        ? t("live_viewer.minutes_seconds", {
            minutes: Math.floor(elapsedSeconds / 60),
            seconds: elapsedSeconds % 60,
          })
        : t("live_viewer.seconds", { seconds: elapsedSeconds });
  const statusText = t(`live_viewer.${state}`);

  return (
    <main
      dir={dir}
      style={{
        position: "relative",
        width: "100%",
        height: "100dvh",
        minHeight: "100svh",
        overflow: "hidden",
        background: "#E7EFED",
        color: "#0B1E3D",
      }}
    >
      <style>{`
        .live-viewer-map-pin { display:block; width:18px; height:18px; border:3px solid #fff; border-radius:50%; box-shadow:0 2px 8px rgba(11,30,61,.35); }
        .live-viewer-map-pin.pickup { background:#00A88F; }
        .live-viewer-map-pin.dropoff { background:#F5A623; }
        .live-viewer-map .leaflet-control-zoom { margin:12px !important; }
        .live-viewer-map .leaflet-control-attribution { font-size:10px; }
      `}</style>
      <div
        ref={mapElementRef}
        className="live-viewer-map"
        dir="ltr"
        role="application"
        aria-label={t("live_viewer.title")}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          direction: "ltr",
          background: "#E7EFED",
        }}
      />
      {!mapReady && !mapFailed && (
        <div
          dir={dir}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            color: "#526262",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {t("live_viewer.map_loading")}
        </div>
      )}
      <header
        dir={dir}
        style={{
          position: "absolute",
          insetBlockStart: "calc(10px + env(safe-area-inset-top))",
          insetInline: 12,
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        <h1
          style={{
            margin: 0,
            padding: "10px 13px",
            borderRadius: 12,
            background: "rgba(255,255,255,.96)",
            boxShadow: "0 2px 12px rgba(11,30,61,.12)",
            fontSize: 15,
          }}
        >
          {t("live_viewer.title")}
        </h1>
        <div
          role="group"
          aria-label={t("live_viewer.language")}
          dir="ltr"
          style={{
            display: "flex",
            gap: 4,
            padding: 4,
            borderRadius: 10,
            background: "rgba(255,255,255,.96)",
            boxShadow: "0 2px 12px rgba(11,30,61,.12)",
            pointerEvents: "auto",
          }}
        >
          {(["en", "ar"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => changeLocale(option)}
              aria-pressed={locale === option}
              aria-label={option === "en" ? "English" : "العربية"}
              style={{
                minWidth: 44,
                minHeight: 40,
                border: 0,
                borderRadius: 7,
                background: locale === option ? "#0B1E3D" : "transparent",
                color: locale === option ? "#fff" : "#0B1E3D",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      {followAvailable && (
        <button
          type="button"
          onClick={recenter}
          aria-label={t("live_viewer.recenter")}
          style={{
            position: "absolute",
            zIndex: 3,
            insetInlineEnd: 16,
            insetBlockEnd: "calc(300px + env(safe-area-inset-bottom))",
            minWidth: 48,
            minHeight: 48,
            display: "grid",
            placeItems: "center",
            border: "1px solid #DCE6E4",
            borderRadius: 12,
            background: "#fff",
            color: "#0B1E3D",
            boxShadow: "0 2px 12px rgba(11,30,61,.18)",
            cursor: "pointer",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 22 }}>◎</span>
        </button>
      )}
      <section
        dir={dir}
        aria-label={t("live_viewer.title")}
        style={{
          position: "absolute",
          zIndex: 4,
          insetInline: 0,
          insetBlockEnd: 0,
          maxHeight: "min(48dvh, 430px)",
          overflowY: "auto",
          padding: "16px 18px calc(18px + env(safe-area-inset-bottom))",
          borderRadius: "20px 20px 0 0",
          background: "#fff",
          boxShadow: "0 -6px 24px rgba(11,30,61,.14)",
          boxSizing: "border-box",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 38,
            height: 4,
            margin: "0 auto 14px",
            borderRadius: 4,
            background: "#C7D4D1",
          }}
        />
        {connectionProblem && (
          <p
            role="alert"
            style={{
              margin: "0 0 12px",
              padding: "10px 12px",
              borderRadius: 8,
              background: "#FFF4E5",
              color: "#78490A",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {t("live_viewer.connection")}
          </p>
        )}
        <div
          aria-live="polite"
          role="status"
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              flex: "0 0 10px",
              borderRadius: "50%",
              background:
                state === "live"
                  ? "#00A88F"
                  : state === "stale" || state === "connection"
                    ? "#F5A623"
                    : state === "ended" || state === "unavailable"
                      ? "#71817F"
                      : "#899997",
            }}
          />
          <strong style={{ fontSize: 14 }}>{statusText}</strong>
        </div>
        {state === "unavailable" || state === "ended" ? (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            {state === "unavailable"
              ? t("live_viewer.unavailable")
              : t("live_viewer.ended")}
          </p>
        ) : (
          <>
            {state === "stale" && (
              <p style={{ margin: "0 0 10px", color: "#78490A", fontSize: 13 }}>
                {t("live_viewer.stale")}
              </p>
            )}
            {state === "waiting" && (
              <p style={{ margin: "0 0 10px", fontSize: 13 }}>
                {t("live_viewer.waiting")}
              </p>
            )}
            {state === "loading" && (
              <p style={{ margin: "0 0 10px", fontSize: 13 }}>
                {t("live_viewer.loading")}
              </p>
            )}
            {state === "live" && (
              <p style={{ margin: "0 0 10px", fontSize: 13 }}>
                {t("live_viewer.live")}
              </p>
            )}
            {data?.driver && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "start",
                  gap: 12,
                  paddingTop: 12,
                  borderTop: "1px solid #E7EFED",
                }}
              >
                <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
                  <strong style={{ fontSize: 15 }}>
                    {data.driver.firstName ?? t("live_viewer.driver")}
                  </strong>
                  <span style={{ color: "#526262", fontSize: 13 }}>
                    {[
                      data.driver.vehicle.color,
                      data.driver.vehicle.make,
                      data.driver.vehicle.model,
                    ]
                      .filter(Boolean)
                      .join(" · ") || t("live_viewer.vehicle")}
                  </span>
                  {data.driver.vehicle.plate && (
                    <span style={{ fontSize: 13, fontWeight: 800 }}>
                      {t("live_viewer.plate")}: {data.driver.vehicle.plate}
                    </span>
                  )}
                </div>
                {elapsedLabel && (
                  <span style={{ maxWidth: 130, color: "#526262", fontSize: 12, textAlign: "end" }}>
                    {t("live_viewer.last_updated", { time: elapsedLabel })}
                  </span>
                )}
              </div>
            )}
            {mapFailed && (
              <p role="status" style={{ margin: "10px 0 0", color: "#526262", fontSize: 12 }}>
                {t("live_viewer.map_error")}
              </p>
            )}
            {!mapFailed && (
              <button
                type="button"
                onClick={recenter}
                aria-label={t("live_viewer.recenter")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: 48,
                  marginTop: 14,
                  padding: "10px 14px",
                  border: "1px solid #B9CBC6",
                  borderRadius: 8,
                  background: "#fff",
                  color: "#0B1E3D",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <span aria-hidden="true">◎</span>
                {t("live_viewer.recenter")}
              </button>
            )}
          </>
        )}
        <Link
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            marginTop: 16,
            color: "#007A6A",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {t("privacy.notice")}
        </Link>
      </section>
    </main>
  );
}
