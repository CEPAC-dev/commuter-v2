"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useClientLocale } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";

interface DriverLocationTrackerProps {
  resourceType: "ride" | "trip";
  resourceId: string;
  active: boolean;
  initialLocale?: Locale;
  onLocation?: (
    location: {
      lat: number;
      lng: number;
      heading: number | null;
      stale: boolean;
    } | null,
  ) => void;
}

type TrackerState = "idle" | "sharing" | "error";
const MIN_SEND_INTERVAL_MS = 3_000;
const MIN_MOVEMENT_METERS = 5;
const MAX_SILENT_INTERVAL_MS = 10_000;

function movedEnough(
  previous: { lat: number; lng: number } | null,
  next: { lat: number; lng: number },
): boolean {
  if (!previous) return true;
  const latitudeDelta = ((next.lat - previous.lat) * Math.PI) / 180;
  const longitudeDelta = ((next.lng - previous.lng) * Math.PI) / 180;
  const latitude = (next.lat * Math.PI) / 180;
  const distance =
    6_371_000 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(latitudeDelta / 2) ** 2 +
          Math.cos(latitude) *
            Math.cos(latitude) *
            Math.sin(longitudeDelta / 2) ** 2,
      ),
    );
  return distance >= MIN_MOVEMENT_METERS;
}

export default function DriverLocationTracker({
  resourceType,
  resourceId,
  active,
  initialLocale,
  onLocation,
}: DriverLocationTrackerProps) {
  const { t } = useClientLocale(initialLocale);
  const [state, setState] = useState<TrackerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const sharingRequestedRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const requestCompleteRef = useRef<Promise<void>>(Promise.resolve());
  const lastSentAtRef = useRef(0);
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastResponseAtRef = useRef(0);

  const endpoint =
    resourceType === "ride"
      ? `/api/driver/rides/${encodeURIComponent(resourceId)}/location`
      : `/api/driver/trips/${encodeURIComponent(resourceId)}/location`;
  const isSharing = state === "sharing";

  const clearWatch = useCallback(() => {
    sharingRequestedRef.current = false;
    onLocation?.(null);
    if (watchIdRef.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, [onLocation]);

  const sendPosition = useCallback(
    (position: GeolocationPosition) => {
      if (!sharingRequestedRef.current) return;
      if (position.coords.accuracy <= 1_000) {
        onLocation?.({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading,
          stale: false,
        });
      }
      if (requestRef.current) return;
      const now = Date.now();
      const point = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      if (position.coords.accuracy > 1_000) {
        setError(t("live_share.weak_accuracy"));
        setState("error");
        return;
      }
      if (
        now - lastSentAtRef.current < MIN_SEND_INTERVAL_MS ||
        (!movedEnough(lastLocationRef.current, point) &&
          now - lastResponseAtRef.current < MAX_SILENT_INTERVAL_MS)
      ) {
        return;
      }

      lastSentAtRef.current = now;
      const controller = new AbortController();
      requestRef.current = controller;
      let timedOut = false;
      const requestTimeout = window.setTimeout(
        () => {
          timedOut = true;
          controller.abort();
        },
        15_000,
      );
      const pending = (async () => {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...point,
              accuracy: position.coords.accuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
              recordedAt: new Date(position.timestamp).toISOString(),
            }),
            signal: controller.signal,
          });
          if (!sharingRequestedRef.current) return;
          if (response.status === 404 || response.status === 409) {
            clearWatch();
            setError(t("driver.live_location.trip_ended"));
            setState("error");
            return;
          }
          if (!response.ok) {
            throw new Error(t("driver.live_location.update_error"));
          }
          lastLocationRef.current = point;
          lastResponseAtRef.current = Date.now();
          setError(null);
          setState("sharing");
        } catch (requestError) {
          if (!sharingRequestedRef.current) return;
          if (controller.signal.aborted && !timedOut) return;
          if (timedOut) {
            setError(t("driver.live_location.network_error"));
            setState("error");
            return;
          }
          setError(
            requestError instanceof TypeError
              ? t("driver.live_location.network_error")
              : requestError instanceof Error
                ? requestError.message
                : t("driver.live_location.update_error"),
          );
          setState("error");
        } finally {
          window.clearTimeout(requestTimeout);
          if (requestRef.current === controller) requestRef.current = null;
        }
      })();
      requestCompleteRef.current = pending;
    },
    [clearWatch, endpoint, onLocation, t],
  );

  const handleLocationError = useCallback(
    (locationError: GeolocationPositionError, stopWatching: boolean) => {
      if (stopWatching) clearWatch();
      const message =
        locationError.code === locationError.PERMISSION_DENIED
          ? t("driver.live_location.permission_error")
          : locationError.code === locationError.POSITION_UNAVAILABLE
            ? t("driver.live_location.unavailable")
            : t("driver.live_location.timeout");
      setError(message);
      setState("error");
    },
    [clearWatch, t],
  );

  const stopSharing = useCallback(async () => {
    clearWatch();
    setState("idle");
    try {
      await requestCompleteRef.current;
      const response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(t("driver.live_location.stop_error"));
      }
      setError(null);
    } catch (stopError) {
      setError(
        stopError instanceof TypeError
          ? t("driver.live_location.network_error")
          : stopError instanceof Error
            ? stopError.message
            : t("driver.live_location.stop_error"),
      );
      setState("error");
    }
  }, [clearWatch, endpoint, t]);

  const startTracking = useCallback(() => {
    if (!active || !("geolocation" in navigator)) {
      setError(t("driver.live_location.unavailable"));
      setState("error");
      return;
    }
    if (watchIdRef.current !== null) {
      setError(null);
      setState("sharing");
      return;
    }

    setError(null);
    setState("sharing");
    sharingRequestedRef.current = true;
    watchIdRef.current = navigator.geolocation.watchPosition(
      sendPosition,
      (locationError) => handleLocationError(locationError, true),
      { enableHighAccuracy: true, maximumAge: 2_000, timeout: 15_000 },
    );
    heartbeatTimerRef.current = window.setInterval(() => {
      if (requestRef.current || !sharingRequestedRef.current) return;
      navigator.geolocation.getCurrentPosition(
        sendPosition,
        (locationError) => handleLocationError(locationError, false),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
      );
    }, MAX_SILENT_INTERVAL_MS);
  }, [active, handleLocationError, sendPosition, t]);

  useEffect(() => {
    if (!active) return;
    return () => {
      clearWatch();
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [active, clearWatch]);

  if (!active) return null;

  return (
    <section
      aria-live="polite"
      style={{
        display: "grid",
        gap: 8,
        padding: 14,
        border: "1px solid #D9E7E4",
        borderRadius: 12,
        background: "#F5FAF9",
        marginBottom: 14,
      }}
    >
      <strong style={{ color: "#0B1E3D", fontSize: 14 }}>
        {t("driver.live_location.title")}
      </strong>
      <p style={{ margin: 0, color: "#526262", fontSize: 13, lineHeight: 1.5 }}>
        {t("driver.live_location.privacy")}
      </p>
      <p style={{ margin: 0, color: "#526262", fontSize: 12 }}>
        {isSharing
          ? t("driver.live_location.sharing")
          : state === "error"
            ? error
            : t("driver.live_location.paused")}
      </p>
      <button
        type="button"
        onClick={() => {
          if (isSharing) void stopSharing();
          else startTracking();
        }}
        style={{
          justifySelf: "start",
          minHeight: 40,
          padding: "8px 14px",
          border: 0,
          borderRadius: 9,
          background: isSharing ? "#526262" : "#00A88F",
          color: "#fff",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {isSharing
          ? t("driver.live_location.stop")
          : t("driver.live_location.start")}
      </button>
    </section>
  );
}
