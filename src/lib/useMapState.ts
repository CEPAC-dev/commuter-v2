"use client";

import { useState, useEffect } from "react";
import { fetchRoute } from "@/lib/openrouteservice";
import type { ORSRoute } from "@/lib/openrouteservice";
import type { RideType } from "@/types/shared";

export interface Waypoint {
  address: string;
  lat: number;
  lng: number;
}

export interface MapState {
  origin: Waypoint | null;
  stops: (Waypoint | null)[];
  destination: Waypoint | null;
  routes: ORSRoute[];
  activeRouteIndex: number;
  loading: boolean;
  error: string | null;
  rideType: RideType;
  stopsForcedPrivate: boolean;
}

export function useMapState() {
  const [origin, setOriginState] = useState<Waypoint | null>(null);
  const [stops, setStopsState] = useState<(Waypoint | null)[]>([]);
  const [destination, setDestinationState] = useState<Waypoint | null>(null);
  const [routes, setRoutes] = useState<ORSRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rideType, setRideTypeState] = useState<RideType>("shared");

  const stopsForcedPrivate = stops.length > 0;

  // Core rule: recalculate or clear whenever waypoints change
  useEffect(() => {
    // Guard: need a real origin AND destination — never fetch with 1 point
    if (
      !origin ||
      origin.lat === 0 ||
      origin.lng === 0 ||
      !destination ||
      destination.lat === 0 ||
      destination.lng === 0
    ) {
      // Clear state for invalid inputs
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoutes([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Only include stops that are fully filled (not null, not null-island)
    const filledStops = stops.filter(
      (s): s is Waypoint =>
        s !== null && s.lat !== 0 && s.lng !== 0 && s.address.trim() !== "",
    );

    const allWaypoints: Waypoint[] = [origin, ...filledStops, destination];

    let cancelled = false;

    // Clear stale route immediately before fetching
    setRoutes([]);
    setLoading(true);
    setError(null);

    fetchRoute(allWaypoints)
      .then((r) => {
        if (!cancelled) {
          if (!r || r.length === 0) {
            setError("Could not calculate route. Try different locations.");
            setRoutes([]);
          } else {
            setRoutes(r);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError((err as Error)?.message ?? "Route fetch failed");
          setRoutes([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Stringify for deep equality — avoids stale closures on object identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(origin),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(stops),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(destination),
  ]);

  function setOrigin(w: Waypoint | null) {
    setOriginState(w);
    if (!w) {
      setRoutes([]);
      setError(null);
    }
  }

  function setDestination(w: Waypoint | null) {
    setDestinationState(w);
    if (!w) {
      setRoutes([]);
      setError(null);
    }
  }

  function addStop() {
    if (stops.length >= 3) return;
    setStopsState((prev) => [...prev, null]);
    setRideTypeState("private");
  }

  function removeStop(index: number) {
    setStopsState((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setRideTypeState("shared");
      return next;
    });
  }

  function setStop(index: number, w: Waypoint | null) {
    setStopsState((prev) => {
      const next = [...prev];
      next[index] = w;
      return next;
    });
  }

  function setRideType(rt: RideType) {
    if (stopsForcedPrivate && rt === "shared") return;
    setRideTypeState(rt);
  }

  function swapOriginDestination() {
    setOriginState(destination);
    setDestinationState(origin);
  }

  function clearAll() {
    setOriginState(null);
    setStopsState([]);
    setDestinationState(null);
    setRoutes([]);
    setRideTypeState("shared");
    setError(null);
  }

  return {
    origin,
    stops,
    destination,
    routes,
    loading,
    error,
    rideType,
    stopsForcedPrivate,
    activeRoute: routes[0] ?? null,

    setOrigin,
    setStop,
    setDestination,
    addStop,
    removeStop,
    setRideType,
    swapOriginDestination,
    clearAll,
  };
}
