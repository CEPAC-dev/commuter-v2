"use client";

import Ably from "ably";
import { useEffect, useMemo, useRef, useState } from "react";
import RouteMap from "@/components/shared/RouteMapOsmLoader";
import { useClientLocale } from "@/lib/i18n/client";
import { calculateTripProgress } from "@/lib/liveLocation/progress";
import { parseDriverLocationUpdate } from "@/lib/liveLocation/types";
import type { DriverLocationUpdate } from "@/lib/liveLocation/types";
import type { LatLng } from "@/types/geo";

interface TripLiveMapProps {
  tripId: string;
  pickup: LatLng;
  dropoff: LatLng;
  stops?: LatLng[];
  stations?: LatLng[];
  routeCoordinates?: LatLng[] | null;
}

const EMPTY_POINTS: LatLng[] = [];

function parseRoute(value: unknown): LatLng[] | null {
  if (!Array.isArray(value) || !value[0] || typeof value[0] !== "object") {
    return null;
  }
  const coordinates = (value[0] as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates)) return null;
  const points = coordinates.flatMap((entry): LatLng[] => {
    if (
      !Array.isArray(entry) ||
      typeof entry[0] !== "number" ||
      typeof entry[1] !== "number" ||
      !Number.isFinite(entry[0]) ||
      !Number.isFinite(entry[1])
    ) {
      return [];
    }
    return [{ lat: entry[0], lng: entry[1] }];
  });
  return points.length > 1 ? points : null;
}

export default function TripLiveMap({
  tripId,
  pickup,
  dropoff,
  stops = EMPTY_POINTS,
  stations = EMPTY_POINTS,
  routeCoordinates,
}: TripLiveMapProps) {
  const { t } = useClientLocale();
  const [location, setLocation] = useState<DriverLocationUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const [snapshotError, setSnapshotError] = useState(false);
  const [tripActive, setTripActive] = useState(true);
  const [now, setNow] = useState(0);
  const [fetchedRoute, setFetchedRoute] = useState<LatLng[] | null>(null);
  const stoppedAtRef = useRef<number | null>(null);
  const endedRef = useRef(false);
  const realtimeRef = useRef<Ably.Realtime | null>(null);

  const effectiveRoute =
    routeCoordinates && routeCoordinates.length > 1
      ? routeCoordinates
      : fetchedRoute;

  useEffect(() => {
    let active = true;
    const updateLocation = (next: DriverLocationUpdate | null) => {
      if (!active) return;
      setLocation((current) => {
        if (
          next &&
          stoppedAtRef.current !== null &&
          Date.parse(next.receivedAt) <= stoppedAtRef.current
        ) {
          return null;
        }
        if (
          current &&
          next &&
          Date.parse(current.receivedAt) > Date.parse(next.receivedAt)
        ) {
          return current;
        }
        return next;
      });
    };
    const loadSnapshot = async () => {
      try {
        const response = await fetch(
          `/api/trips/${encodeURIComponent(tripId)}/live-location`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          if (active) setSnapshotError(true);
          return;
        }
        const payload: unknown = await response.json();
        const snapshot =
          payload && typeof payload === "object"
            ? (payload as { active?: unknown; driverLocation?: unknown })
            : null;
        if (endedRef.current) return;
        if (snapshot?.active === false) {
          endedRef.current = true;
          setTripActive(false);
          updateLocation(null);
          realtimeRef.current?.close();
          realtimeRef.current = null;
          return;
        }
        const value = snapshot?.driverLocation ?? null;
        updateLocation(
          value === null ? null : parseDriverLocationUpdate(value),
        );
        if (snapshot?.active === true) setTripActive(true);
        if (active) setSnapshotError(false);
      } catch {
        if (active) setSnapshotError(true);
      }
    };

    void loadSnapshot();
    endedRef.current = false;
    const realtime = new Ably.Realtime({
      authUrl: `/api/trips/${encodeURIComponent(tripId)}/live/auth`,
      authMethod: "GET",
    });
    realtimeRef.current = realtime;
    const channel = realtime.channels.get(`trip:${tripId}`);
    const onMessage = (message: Ably.Message) => {
      if (endedRef.current) return;
      if (message.name === "driver-location-stopped") {
        const stoppedAt = (message.data as { stoppedAt?: unknown } | null)
          ?.stoppedAt;
        const parsedStoppedAt =
          typeof stoppedAt === "string" ? Date.parse(stoppedAt) : Number.NaN;
        stoppedAtRef.current = Number.isFinite(parsedStoppedAt)
          ? parsedStoppedAt
          : Date.now();
        updateLocation(null);
        return;
      }
      const next = parseDriverLocationUpdate(message.data);
      if (next) {
        if (
          stoppedAtRef.current !== null &&
          Date.parse(next.receivedAt) <= stoppedAtRef.current
        ) {
          return;
        }
        stoppedAtRef.current = null;
        updateLocation({ ...next, ageSeconds: 0, stale: false });
      }
    };
    channel.subscribe(onMessage);
    realtime.connection.on("connected", () => {
      if (active) setConnected(true);
    });
    realtime.connection.on("disconnected", () => {
      if (active) setConnected(false);
    });
    realtime.connection.on("failed", () => {
      if (active) setConnected(false);
    });
    const fallbackPoll = window.setInterval(() => {
      if (!endedRef.current) void loadSnapshot();
    }, 30_000);
    const freshnessClock = window.setInterval(() => setNow(Date.now()), 1_000);

    return () => {
      active = false;
      window.clearInterval(fallbackPoll);
      window.clearInterval(freshnessClock);
      channel.unsubscribe(onMessage);
      realtime.close();
      if (realtimeRef.current === realtime) realtimeRef.current = null;
    };
  }, [tripId]);

  useEffect(() => {
    if (routeCoordinates && routeCoordinates.length > 1) return;
    let cancelled = false;
    const query = new URLSearchParams({
      origin: `${pickup.lat},${pickup.lng}`,
      dest: `${dropoff.lat},${dropoff.lng}`,
    });
    const waypoints = [...stops, ...stations];
    if (waypoints.length) {
      query.set(
        "waypoints",
        waypoints.map((point) => `${point.lat},${point.lng}`).join("|"),
      );
    }
    void fetch(`/api/directions?${query}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((value: unknown) => {
        if (!cancelled) setFetchedRoute(parseRoute(value));
      })
      .catch(() => {
        if (!cancelled) setFetchedRoute(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    pickup.lat,
    pickup.lng,
    dropoff.lat,
    dropoff.lng,
    routeCoordinates,
    stops,
    stations,
  ]);

  const ageSeconds = location
    ? Math.max(
        0,
        Math.floor((now - Date.parse(location.receivedAt)) / 1_000),
      )
    : null;
  const stale =
    ageSeconds !== null &&
    (location?.stale === true || ageSeconds >= 45);
  const progress = useMemo(
    () =>
      location
        ? calculateTripProgress({
            position: { lat: location.lat, lng: location.lng, speed: location.speed },
            destination: dropoff,
            route: effectiveRoute,
          })
        : null,
    [location, dropoff, effectiveRoute],
  );
  const driverMarker = location
    ? {
        lat: location.lat,
        lng: location.lng,
        heading: location.heading,
        stale,
      }
    : undefined;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <RouteMap
        pickup={pickup}
        dropoff={dropoff}
        stops={stops}
        routeCoordinates={effectiveRoute ?? undefined}
        driverLocation={driverMarker}
        height={280}
        interactive
      />
      <div
        aria-live="polite"
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 12px",
          borderRadius: 10,
          background: "#F5FAF9",
          color: "#0B1E3D",
          fontSize: 13,
        }}
      >
        <strong>
          {!tripActive
            ? t("live_viewer.ended")
            : snapshotError && !location
            ? t("live_viewer.driver_load_error")
            : location
              ? stale
                ? t("live_viewer.driver_stale")
                : connected
                  ? t("live_viewer.driver_live")
                  : t("live_viewer.driver_reconnecting")
              : t("live_viewer.driver_waiting")}
        </strong>
        {progress && (
          <span>
            {t("live_viewer.remaining_distance", {
              distance: progress.remainingDistanceKm.toFixed(1),
            })}
            {progress.etaMinutes !== null
              ? ` · ${t("live_viewer.eta_minutes", {
                  minutes: progress.etaMinutes,
                })}`
              : ""}
          </span>
        )}
      </div>
    </div>
  );
}
