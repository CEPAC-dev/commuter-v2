"use client";

import { useState } from "react";
import {
  CalendarDays,
  Users,
  Route,
  Car,
  Clock,
  Play,
  CheckCircle2,
  Flag,
  LogIn,
  LogOut,
} from "lucide-react";
import { useClientLocale } from "@/lib/i18n/client";
import { formatDate, formatTime, formatEgp } from "@/lib/i18n";
import AppHeader from "@/components/layout/AppHeader";
import RouteMap from "@/components/shared/RouteMap";
import VehicleSeatMap from "@/components/trips/VehicleSeatMap";
import { VEHICLES, type VehicleKey } from "@/lib/config/vehicles";
import type { GeoPoint } from "@/types/geo";
import type { RideDetailView, RideRouteStopDetail } from "@/types/booking";

function normalizeStationValue(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function getPassengerStationReference(
  passenger: RideDetailView["passengers"][number] | null | undefined,
  direction: "pickup" | "dropoff",
) {
  const orderValue =
    direction === "pickup"
      ? Number(passenger?.pickupOrder ?? 0)
      : Number(passenger?.dropoffOrder ?? 0);

  if (orderValue > 0) {
    return { type: "order" as const, value: orderValue };
  }

  const station =
    direction === "pickup" ? passenger?.pickupStation : passenger?.dropoffStation;
  const stationName = station?.name ?? (station as { name?: string; address?: string })?.address ?? null;

  if (stationName) {
    return { type: "name" as const, value: stationName };
  }

  return null;
}

function stationMatchesPassenger(
  passenger: RideDetailView["passengers"][number] | null | undefined,
  stationIndex: number,
  stationName: string | null | undefined,
  direction: "pickup" | "dropoff",
) {
  const stationReference = getPassengerStationReference(passenger, direction);
  if (!stationReference) {
    return false;
  }

  if (stationReference.type === "order") {
    return stationIndex === stationReference.value;
  }

  const normalizedStationName = normalizeStationValue(stationName);
  const normalizedReferenceName = normalizeStationValue(stationReference.value);
  return Boolean(normalizedStationName) && normalizedStationName === normalizedReferenceName;
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: "#f8f9fa",
        border: "1px solid #eef0f3",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ marginTop: 2, flexShrink: 0 }}>{icon}</span>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 800,
              color: "#0B1E3D",
              lineHeight: 1.25,
            }}
          >
            {label}
          </p>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              fontWeight: 500,
              color: "#5A6A7A",
            }}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DriverRideInteractiveClient({
  ride: rideProp,
  email,
}: { ride: RideDetailView; email: string }) {
  const [ride, setRide] = useState(rideProp);
  const [rideStarted, setRideStarted] = useState(
    ride.status === "active" || ride.status === "completed",
  );
  const [isCompleted, setIsCompleted] = useState(ride.status === "completed");
  const [confirmedStationIndices, setConfirmedStationIndices] = useState<number[]>([]);
  const [stationSelections, setStationSelections] = useState<Record<string, Record<string, "arrived" | "no_show">>>({});
  const [driverOrigin, setDriverOrigin] = useState<GeoPoint | null>(
    ride.driverOrigin ?? null,
  );
  const [driverDestination, setDriverDestination] = useState<GeoPoint | null>(
    ride.driverDestination ?? null,
  );
  const { t, locale, dir } = useClientLocale();
  const to12h = (hhmm: string) => formatTime(locale, hhmm);
  const prettyDate = (date: string) => formatDate(locale, date);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [navigationErrorByStation, setNavigationErrorByStation] = useState<Record<number, string>>({});

  const handleGoToLocation = async (step: StepItem) => {
    setNavigationErrorByStation((prev) => ({ ...prev, [step.stationIndex]: "" }));

    const lat = step.point?.lat;
    const lng = step.point?.lng;

    if (typeof lat !== "number" || !Number.isFinite(lat) || typeof lng !== "number" || !Number.isFinite(lng)) {
      setNavigationErrorByStation((prev) => ({
        ...prev,
        [step.stationIndex]: t("navigation.location_unavailable"),
      }));
      return;
    }

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setNavigationErrorByStation((prev) => ({
        ...prev,
        [step.stationIndex]: t("navigation.unable_access_location"),
      }));
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
      });

      const originLat = position.coords.latitude;
      const originLng = position.coords.longitude;
      const destination = `${lat},${lng}`;
      const origin = `${originLat},${originLng}`;
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
        origin,
      )}&destination=${encodeURIComponent(destination)}&travelmode=driving`;

      window.open(mapsUrl, "_blank");
    } catch {
      setNavigationErrorByStation((prev) => ({
        ...prev,
        [step.stationIndex]: t("navigation.unable_get_location"),
      }));
    }
  };

  const vLabel =
    VEHICLES[ride.vehicleType as VehicleKey]?.label ?? ride.vehicleType;

  type RouteStopWithIndex = {
    stationIndex: number;
  } & RideRouteStopDetail;

  // Prepare route stops (only stations)
  let routeStops: RouteStopWithIndex[] = (ride.route ?? []).map((stop, index) => ({
    ...stop,
    stationIndex: index + 1,
  }));

  if (routeStops.length === 0 && ride.passengers.length > 0) {
    routeStops = ride.passengers
      .flatMap((p) => [
        {
          address: p.pickupStation?.name ?? t("ride.pickup_station_fallback"),
          point: p.pickupStation
            ? { lat: p.pickupStation.lat, lng: p.pickupStation.lng, address: p.pickupStation.name }
            : p.pickup,
          boarding: p.numberOfPassengers || 1,
          alighting: 0,
          waitingMinutes: 0,
        },
        {
          address: p.dropoffStation?.name ?? t("ride.dropoff_station_fallback"),
          point: p.dropoffStation
            ? { lat: p.dropoffStation.lat, lng: p.dropoffStation.lng, address: p.dropoffStation.name }
            : p.dropoff,
          boarding: 0,
          alighting: p.numberOfPassengers || 1,
          waitingMinutes: 0,
        },
      ])
      .map((stop, index) => ({ ...stop, stationIndex: index + 1 }));
  }

  // Keep every station in view; no-shows are marked in place, never dropped.
  const visibleRouteStops = routeStops;

  const stationPoints = visibleRouteStops
    .map((r) => r.point)
    .filter((pt): pt is NonNullable<typeof pt> => Boolean(pt));

  const stationMetaMap = new Map<string, { direction?: string; landmark?: string }>();
  if (ride.pickupStation?.name) {
    stationMetaMap.set(ride.pickupStation.name, {
      direction: ride.pickupStation.direction,
      landmark: ride.pickupStation.landmark,
    });
  }
  if (ride.dropoffStation?.name) {
    stationMetaMap.set(ride.dropoffStation.name, {
      direction: ride.dropoffStation.direction,
      landmark: ride.dropoffStation.landmark,
    });
  }
  for (const p of ride.passengers) {
    if (p.pickupStation?.name) {
      stationMetaMap.set(p.pickupStation.name, {
        direction: p.pickupStation.direction,
        landmark: p.pickupStation.landmark,
      });
    }
    if (p.dropoffStation?.name) {
      stationMetaMap.set(p.dropoffStation.name, {
        direction: p.dropoffStation.direction,
        landmark: p.dropoffStation.landmark,
      });
    }
  }

  type StepItem = {
    type: "origin" | "station" | "destination";
    stationIndex: number;
    name: string;
    zone: string;
    landmark?: string;
    boarding: number;
    alighting: number;
    waitingMinutes: number;
    point?: GeoPoint | null;
  };

  type RouteStopLike = {
    name?: string;
    address?: string;
    direction?: string;
    landmark?: string;
    boarding?: number;
    alighting?: number;
    waitingMinutes?: number;
  };

  // Manifest counts stay stable after confirmation; only no-show/cancellation reduces them.
  // One rider can appear as several trip records; a no-show on any applies to all of them.
  const noShowUserIds = new Set(
    ride.passengers
      .filter((p) => ["no_show", "cancelled"].includes(p.status?.toLowerCase?.() ?? ""))
      .map((p) => p.userId)
      .filter((id): id is string => Boolean(id)),
  );
  const getStationCounts = (stationIndex: number, stationName: string) => {
    const tally = (direction: "pickup" | "dropoff") =>
      ride.passengers.reduce((count, passenger) => {
        const normalizedStatus = passenger.status?.toLowerCase?.() ?? "";
        if (["no_show", "cancelled"].includes(normalizedStatus)) return count;
        if (passenger.userId && noShowUserIds.has(passenger.userId)) return count;
        return stationMatchesPassenger(passenger, stationIndex, stationName, direction)
          ? count + (passenger.numberOfPassengers || 1)
          : count;
      }, 0);

    return { boarding: tally("pickup"), alighting: tally("dropoff") };
  };

  const steps: StepItem[] = [
    {
      type: "origin",
      stationIndex: 0,
      name: driverOrigin?.address ?? t("ride.driver_origin"),
      zone: "",
      landmark: "",
      boarding: 0,
      alighting: 0,
      waitingMinutes: 0,
    },
    ...visibleRouteStops.map((stop, i) => {
      const stopLike = stop as RouteStopLike;
      const stationName =
        stopLike.name ??
        stop.address ??
        stop.point?.address ??
        `${t("ride.station_fallback", { n: i + 1 })}`;
      const meta = stationMetaMap.get(stationName);
      const counts = getStationCounts(stop.stationIndex, stationName);
      return {
        type: "station" as const,
        stationIndex: stop.stationIndex,
        name: stationName,
        zone: stopLike.direction ?? meta?.direction ?? "",
        landmark: stopLike.landmark ?? meta?.landmark ?? "",
        boarding: counts.boarding,
        alighting: counts.alighting,
        waitingMinutes: stop.waitingMinutes || 0,
        point: stop.point ?? null,
      };
    }),
    {
      type: "destination",
      stationIndex: visibleRouteStops.length + 1,
      name: driverDestination?.address ?? t("ride.driver_destination"),
      zone: "",
      landmark: "",
      boarding: 0,
      alighting: 0,
      waitingMinutes: 0,
    },
  ];

  const stationSteps = steps.filter((step) => step.type === "station");
  // Only stations with real boarding/alighting demand require a stop.
  const actionableStationSteps = stationSteps.filter(
    (step) => step.boarding > 0 || step.alighting > 0,
  );
  const activeStationIndex = rideStarted && !isCompleted
    ? (actionableStationSteps.find(
        (step) => !confirmedStationIndices.includes(step.stationIndex),
      )?.stationIndex ?? null)
    : null;
  const activeStepIndex = steps.findIndex(
    (step) => step.type === "station" && step.stationIndex === activeStationIndex,
  );
  const allStationsConfirmed =
    actionableStationSteps.length === 0
      ? true
      : actionableStationSteps.every((step) =>
          confirmedStationIndices.includes(step.stationIndex),
        );

  // Helper for reverse geocoding location name
  const fetchLocationName = async (lat: number, lng: number, fallback: string): Promise<string> => {
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.address) return data.address;
      }
    } catch {}
    return fallback;
  };

  // Geolocation helpers
  const handleStartRide = async () => {
    setLoadingAction("start");
    let loc: GeoPoint | null = null;
    try {
      if (typeof window !== "undefined" && "geolocation" in navigator) {
        loc = await new Promise<GeoPoint | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              const address = await fetchLocationName(lat, lng, "Driver Origin");
              resolve({ lat, lng, address });
            },
            () => resolve({ lat: 30.0444, lng: 31.2357, address: "Cairo Driver Origin" }),
            { timeout: 6000 },
          );
        });
      }
    } catch {
      loc = { lat: 30.0444, lng: 31.2357, address: "Cairo Driver Origin" };
    }

    try {
      await fetch(`/api/actions/ride/${ride.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_ride",
          metadata: { currentLocation: loc },
        }),
      });
    } catch (err) {
      console.error(err);
    }

    if (loc) setDriverOrigin(loc);
    setRideStarted(true);
    setIsCompleted(false);
    setRide((prevRide) => ({
      ...prevRide,
      status: "active",
      passengers: prevRide.passengers.map((passenger) => ({
        ...passenger,
        status: "waiting",
        seatNumbers: [],
      })),
    }));
    setConfirmedStationIndices([]);
    setStationSelections({});
    setLoadingAction(null);

    // Auto-navigate to the first actionable station as soon as the ride starts.
    const firstStationStep = actionableStationSteps[0];
    if (firstStationStep) await handleGoToLocation(firstStationStep);
  };

  const handleConfirmStation = async (
    stationIndex: number,
    stationName: string,
  ) => {
    const stationKey = String(stationIndex);
    const selections = stationSelections[stationKey] ?? {};
    const passengersForStation = ride.passengers.filter((passenger) => {
      const normalizedStatus = passenger.status?.toLowerCase?.() ?? "";
      if (["dropped_off", "no_show", "cancelled"].includes(normalizedStatus)) {
        return false;
      }
      return (
        stationMatchesPassenger(passenger, stationIndex, stationName, "pickup") ||
        stationMatchesPassenger(passenger, stationIndex, stationName, "dropoff")
      );
    });

    const boardingPassengersForStation = passengersForStation.filter(
      (passenger) =>
        passenger.status === "waiting" &&
        (passenger.pickupOrder ?? 0) === stationIndex,
    );
    const requiresPassengerSelections = boardingPassengersForStation.length > 0;
    const missingSelection =
      requiresPassengerSelections &&
      boardingPassengersForStation.some((passenger) => !selections[passenger.tripId]);
    if (missingSelection) return;

    const assignedSeatNumbers = new Set<number>();
    for (const passenger of ride.passengers) {
      if (["boarding", "picked_up", "on_board"].includes(passenger.status ?? "")) {
        for (const seat of passenger.seatNumbers ?? []) {
          if (typeof seat === "number" && Number.isFinite(seat)) {
            assignedSeatNumbers.add(seat);
          }
        }
      }
    }

    const vehicleType = ride.vehicleType as VehicleKey;
    const seatCapacity = Number(
      vehicleType && VEHICLES[vehicleType]?.capacity
        ? VEHICLES[vehicleType].capacity
        : 4,
    );

    const getNextSeatNumber = () => {
      for (let seat = 1; seat <= seatCapacity; seat += 1) {
        if (!assignedSeatNumbers.has(seat)) {
          assignedSeatNumbers.add(seat);
          return seat;
        }
      }
      return 1;
    };

    setLoadingAction(`confirm-${stationIndex}`);
    try {
      const confirmations = boardingPassengersForStation.map((passenger) => ({
        tripId: passenger.tripId,
        status: selections[passenger.tripId],
      }));

      const res = await fetch(`/api/actions/ride/${ride.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "station_arrived",
          stationIndex,
          stationName,
          metadata: { confirmations },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.error || t("ride.confirm_station_error", { stationIndex }),
        );
      }

      const isLastStation =
        visibleRouteStops.length > 0 &&
        stationIndex === visibleRouteStops[visibleRouteStops.length - 1].stationIndex;

      // A rider's duplicate trip record should alight alongside the one that matched this stop.
      const droppedOffUserIdsAtThisStation = new Set(
        ride.passengers
          .filter(
            (passenger) =>
              ["on_board", "picked_up"].includes(passenger.status ?? "") &&
              stationMatchesPassenger(passenger, stationIndex, stationName, "dropoff"),
          )
          .map((passenger) => passenger.userId)
          .filter((id): id is string => Boolean(id)),
      );

      const nextPassengers = ride.passengers.map((passenger) => {
        const normalizedStatus = passenger.status?.toLowerCase?.() ?? "";
        if (["dropped_off", "no_show", "cancelled"].includes(normalizedStatus)) {
          return passenger;
        }

        const confirmation = confirmations.find((entry) => entry.tripId === passenger.tripId);
        const confirmationStatus = confirmation?.status;
        const isPickupStation = stationMatchesPassenger(passenger, stationIndex, stationName, "pickup");
        const isDropoffStation = stationMatchesPassenger(passenger, stationIndex, stationName, "dropoff");

        // Apply every transition in sequence (not early-return) so a passenger whose
        // pickup was the previous station can still alight here in the same pass.
        let nextStatus = passenger.status;
        let nextSeatNumbers = passenger.seatNumbers;

        // 1. Anyone already boarding/picked up who isn't boarding here is now fully on board.
        if ((nextStatus === "boarding" || nextStatus === "picked_up") && !isPickupStation) {
          nextStatus = "on_board";
        }

        // 2. Clear a stale red seat once its station has passed.
        if (nextStatus === "dropped_off" && !isDropoffStation && (nextSeatNumbers?.length ?? 0) > 0) {
          nextSeatNumbers = [];
        }

        // 3. Process this station's pickup confirmations.
        if (isPickupStation && confirmationStatus === "no_show") {
          nextStatus = "no_show";
          nextSeatNumbers = [];
        } else if (isPickupStation && confirmationStatus === "arrived") {
          nextStatus = "boarding";
          nextSeatNumbers =
            nextSeatNumbers && nextSeatNumbers.length > 0 ? nextSeatNumbers : [getNextSeatNumber()];
        }

        // 4. Anyone on board reaching their dropoff (or the ride's last stop) alights here.
        if ((isDropoffStation || isLastStation) && ["on_board", "picked_up"].includes(nextStatus ?? "")) {
          nextStatus = "dropped_off";
        }

        // 4b. A rider's duplicate trip record should alight alongside the one that just matched.
        if (
          passenger.userId &&
          droppedOffUserIdsAtThisStation.has(passenger.userId) &&
          ["on_board", "picked_up", "boarding"].includes(nextStatus ?? "")
        ) {
          nextStatus = "dropped_off";
        }

        if (nextStatus === passenger.status && nextSeatNumbers === passenger.seatNumbers) {
          return passenger;
        }

        return { ...passenger, status: nextStatus, seatNumbers: nextSeatNumbers };
      });

      setRide((prevRide) => ({
        ...prevRide,
        passengers: nextPassengers,
      }));
      setConfirmedStationIndices((prev) =>
        prev.includes(stationIndex) ? prev : [...prev, stationIndex],
      );

      // Confirming a stop also starts navigation to the next actionable station,
      // skipping any stop that has nothing to do (e.g. emptied by a no-show).
      const nextStationStep = actionableStationSteps.find(
        (step) => step.stationIndex > stationIndex && step.point,
      );
      if (nextStationStep) await handleGoToLocation(nextStationStep);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCloseRide = async () => {
    setLoadingAction("close");
    let loc: GeoPoint | null = null;
    try {
      if (typeof window !== "undefined" && "geolocation" in navigator) {
        loc = await new Promise<GeoPoint | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              const address = await fetchLocationName(lat, lng, "Driver Final Destination");
              resolve({ lat, lng, address });
            },
            () => resolve({ lat: 30.0444, lng: 31.2357, address: "Cairo Final Destination" }),
            { timeout: 6000 },
          );
        });
      }
    } catch {
      loc = { lat: 30.0444, lng: 31.2357, address: "Cairo Final Destination" };
    }

    try {
      await fetch(`/api/actions/ride/${ride.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "end_ride",
          metadata: { currentLocation: loc },
        }),
      });
    } catch (err) {
      console.error(err);
    }

    if (loc) setDriverDestination(loc);
    setRide((prevRide) => ({ ...prevRide, status: "completed" }));
    setIsCompleted(true);
    setLoadingAction(null);
  };

  return (
    <div dir={dir} style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader
        authed
        email={email}
        role="driver"
        variant="app"
        backHref="/my-trips?group=ongoing"
      />

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px 56px" }}>
        {/* Header summary */}
        <div style={{ marginBottom: 20 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              color: "#5A6A7A",
              marginBottom: 8,
            }}
          >
            <CalendarDays size={14} aria-hidden="true" />
            {t("my_trips.ride_number", { rideNumber: ride.rideNumber })} · {prettyDate(ride.date)}
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  background: isCompleted ? "#0B1E3D" : rideStarted ? "#00C2A8" : "#E2E8F0",
                  color: "#fff",
                }}
              >
                {isCompleted ? t("driver.completed") : rideStarted ? t("driver.ongoing") : t("driver.upcoming")}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  color: "#5A6A7A",
                  fontWeight: 600,
                }}
              >
                <Users size={12} aria-hidden="true" />
                {t("driver.passenger_count", { count: ride.passengerCount, plural: ride.passengerCount === 1 ? "" : "s" })}
              </span>
            </div>
            <span
              style={{
                fontWeight: 900,
                fontSize: 22,
                color: "#0B1E3D",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatEgp(locale, ride.totalCost)}
            </span>
          </div>
        </div>

        {/* Start Ride Action Banner */}
        {!rideStarted && !isCompleted && (
          <div
            style={{
              background: "linear-gradient(135deg, #0B1E3D 0%, #1A365D 100%)",
              color: "#fff",
              borderRadius: 16,
              padding: "18px 20px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
              boxShadow: "0 4px 14px rgba(11,30,61,0.18)",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>
                {t("driver.ready_to_start")}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94A3B8" }}>
                {t("driver.ready_to_start_desc")}
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartRide}
              disabled={loadingAction === "start"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                background: "linear-gradient(135deg, #00C2A8 0%, #00A896 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,194,168,0.3)",
                flexShrink: 0,
              }}
            >
              <Play size={16} fill="#fff" />
              {loadingAction === "start" ? t("driver.starting") : t("driver.start_ride")}
            </button>
          </div>
        )}

        {/* Route map */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #eef0f3",
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <RouteMap
            pickup={driverOrigin ?? stationPoints[0] ?? null}
            dropoff={driverDestination ?? stationPoints[stationPoints.length - 1] ?? null}
            stations={driverOrigin ? stationPoints : stationPoints.slice(1, -1)}
            stationIconsOnly
            height={220}
            interactive
          />

          <div style={{ padding: "16px 18px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Detail
                icon={<Route size={15} color="#0B1E3D" />}
                label={t("ride_type.label")}
                value={ride.rideType === "shared" ? t("ride_type.shared") : t("ride_type.private")}
              />
              <Detail
                icon={<Car size={15} color="#0B1E3D" />}
                label={t("driver.vehicle")}
                value={vLabel}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
              <Clock size={14} color="#5A6A7A" aria-hidden="true" />
              <span style={{ fontSize: 13, color: "#5A6A7A", fontWeight: 500 }}>
                {t("driver.window_prefix")}{" "}
                <strong style={{ color: "#0B1E3D" }}>
                  {to12h(ride.startTime)} – {to12h(ride.endTime)}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Visual 2D Seating Map with Live Dynamic Colors */}
        <VehicleSeatMap
          ride={ride}
          isDriver
          rideStarted={rideStarted}
          activeStationIndex={activeStationIndex}
          confirmedStationIndices={confirmedStationIndices}
          stationSelections={stationSelections}
        />

        {/* Route Details Section */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #eef0f3",
            padding: "20px 20px",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#0B1E3D",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {t("driver.route_details")}
              </p>
              <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                {t("driver.route_details_desc")}
              </span>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#00806E",
                background: "#E8F8F5",
                padding: "4px 10px",
                borderRadius: 999,
              }}
            >
              {t("driver.steps_count", { count: steps.length })}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {steps.map((step, index) => {
              const isLast = index === steps.length - 1;
              const badgeBg =
                step.type === "origin"
                  ? "#00C2A8"
                  : step.type === "destination"
                    ? "#0B1E3D"
                    : "#5A6A7A";

              const isActiveStation = activeStationIndex === step.stationIndex;
              const isCurrentStep = rideStarted && !isCompleted && activeStepIndex === index;
              const isConfirmedStep =
                step.type === "station" && confirmedStationIndices.includes(step.stationIndex);
              const passengersForStation =
                step.type === "station"
                  ? ride.passengers.filter((passenger) => {
                      const normalizedStatus = passenger.status?.toLowerCase?.() ?? "";
                      if (!["waiting", "boarding", "on_board", "picked_up"].includes(normalizedStatus)) {
                        return false;
                      }
                      // A no-show on any of this rider's duplicate trip records excludes them all.
                      if (passenger.userId && noShowUserIds.has(passenger.userId)) {
                        return false;
                      }
                      return (
                        stationMatchesPassenger(passenger, step.stationIndex, step.name, "pickup") ||
                        stationMatchesPassenger(passenger, step.stationIndex, step.name, "dropoff")
                      );
                    })
                  : [];
              const stationSelectionsForStep = stationSelections[String(step.stationIndex)] ?? {};
              const boardingPassengersForStation = passengersForStation.filter(
                (passenger) =>
                  passenger.status === "waiting" &&
                  stationMatchesPassenger(passenger, step.stationIndex, step.name, "pickup"),
              );
              const alightingPassengersForStation = passengersForStation.filter(
                (passenger) =>
                  ["picked_up", "on_board", "boarding"].includes(passenger.status ?? "") &&
                  stationMatchesPassenger(passenger, step.stationIndex, step.name, "dropoff"),
              );
              // No-shows stay visible at their pickup station instead of disappearing.
              const noShowPassengersForStation =
                step.type === "station"
                  ? ride.passengers.filter(
                      (passenger) =>
                        passenger.status === "no_show" &&
                        stationMatchesPassenger(passenger, step.stationIndex, step.name, "pickup"),
                    )
                  : [];
              // Passengers expected to alight here who never boarded (already excluded from Alighting).
              const noShowAlightingForStation =
                step.type === "station"
                  ? ride.passengers.filter(
                      (passenger) =>
                        (passenger.status === "no_show" ||
                          (passenger.userId && noShowUserIds.has(passenger.userId))) &&
                        stationMatchesPassenger(passenger, step.stationIndex, step.name, "dropoff"),
                    )
                  : [];
              const requiresPassengerSelections = boardingPassengersForStation.length > 0;
              const isDecisionComplete =
                passengersForStation.length === 0 ||
                !requiresPassengerSelections ||
                boardingPassengersForStation.every((passenger) =>
                  Boolean(stationSelectionsForStep[passenger.tripId]),
                );
              const hasNoShowAtStation =
                noShowPassengersForStation.length > 0 || noShowAlightingForStation.length > 0;

              return (
                <div
                  key={`route-step-${index}`}
                  style={{
                    display: "flex",
                    gap: 14,
                    position: "relative",
                    paddingBottom: isLast ? 0 : 20,
                  }}
                >
                  {!isLast && (
                    <div
                      style={{
                        position: "absolute",
                        ...(dir === "rtl" ? { right: 13 } : { left: 13 }),
                        top: 26,
                        bottom: 0,
                        width: 2,
                        background: "linear-gradient(to bottom, #00C2A8, #E6EAEC)",
                      }}
                    />
                  )}

                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: badgeBg,
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      zIndex: 1,
                    }}
                  >
                    {index + 1}
                  </span>

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      ...(hasNoShowAtStation
                        ? {
                            background: "rgba(231,76,60,0.08)",
                            border: "1px solid #F5C6CB",
                            borderRadius: 10,
                            padding: 10,
                          }
                        : {}),
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#5A6A7A",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            display: "block",
                          }}
                        >
                          {step.type === "origin"
                            ? t("driver.origin_label")
                            : step.type === "destination"
                              ? t("driver.destination_label")
                              : t("driver.station_label")}
                        </span>
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#0B1E3D",
                            lineHeight: 1.3,
                          }}
                        >
                          {step.name}
                        </p>
                      </div>

                      {/* Confirm stop — also opens directions to the next station */}
                      {!isCompleted && step.type === "station" && isCurrentStep && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleConfirmStation(step.stationIndex, step.name)
                            }
                            disabled={
                              loadingAction === `confirm-${step.stationIndex}` ||
                              (requiresPassengerSelections && !isDecisionComplete)
                            }
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "6px 12px",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              border: isActiveStation ? "1px solid #27AE60" : "1px solid #00C2A8",
                              background: isActiveStation ? "#E8F8F5" : "#fff",
                              color: isActiveStation ? "#196F3D" : "#00806E",
                              cursor:
                                loadingAction === `confirm-${step.stationIndex}` ||
                                (requiresPassengerSelections && !isDecisionComplete)
                                  ? "not-allowed"
                                  : "pointer",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                              opacity: requiresPassengerSelections && !isDecisionComplete ? 0.7 : 1,
                            }}
                          >
                            <CheckCircle2 size={13} color={isActiveStation ? "#27AE60" : "#00C2A8"} />
                            {loadingAction === `confirm-${step.stationIndex}`
                              ? t("driver.confirming")
                              : requiresPassengerSelections
                                ? t("driver.confirm_arrivals")
                                : t("driver.confirm_stop")}
                          </button>
                        </>
                      )}
                    </div>
                    {navigationErrorByStation[step.stationIndex] ? (
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 12,
                          color: "#C0392B",
                          background: "#FFEBEE",
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #F5C6CB",
                        }}
                      >
                        {navigationErrorByStation[step.stationIndex]}
                      </div>
                    ) : null}
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        alignItems: "center",
                        marginTop: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {step.type === "station" ? (
                        <>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              fontSize: 12,
                              color: "#5A6A7A",
                            }}
                          >
                            <LogOut size={12} aria-hidden="true" />
                            {t("driver.alighting")}: <strong style={{ color: "#0B1E3D" }}>{step.alighting}</strong>
                          </span>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              fontSize: 12,
                              color: "#5A6A7A",
                            }}
                          >
                            <LogIn size={12} aria-hidden="true" />
                            {t("driver.boarding")}: <strong style={{ color: "#0B1E3D" }}>{step.boarding}</strong>
                          </span>
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                          {step.type === "origin"
                            ? t("driver.origin_note")
                            : t("driver.destination_note")}
                        </span>
                      )}
                      {step.waitingMinutes > 0 && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 12,
                            color: "#5A6A7A",
                          }}
                        >
                          <Clock size={12} aria-hidden="true" />
                          {t("driver.wait")}: <strong style={{ color: "#0B1E3D" }}>{step.waitingMinutes} {t("ride.minutes_short")}</strong>
                        </span>
                      )}
                    </div>

                    {noShowAlightingForStation.length > 0 && (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                        {noShowAlightingForStation.map((passenger) => (
                          <div
                            key={`no-show-alighting-${passenger.tripId}`}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 8,
                              background: "#FFEBEE",
                              border: "1px solid #F5C6CB",
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#C0392B",
                            }}
                          >
                            {t("driver.no_show_alighting_note", {
                              name:
                                passenger.passengerName ??
                                t("driver.passenger_fallback", { n: passenger.pickupOrder ?? 1 }),
                            })}
                          </div>
                        ))}
                      </div>
                    )}

                    {noShowPassengersForStation.length > 0 && (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                        {noShowPassengersForStation.map((passenger) => (
                          <div
                            key={passenger.tripId}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 8,
                              padding: "8px 10px",
                              borderRadius: 8,
                              background: "#FFEBEE",
                              border: "1px solid #F5C6CB",
                            }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#C0392B" }}>
                              {passenger.passengerName ?? t("driver.passenger_fallback", { n: passenger.pickupOrder ?? 1 })}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: "#C0392B" }}>
                              {t("driver.no_show")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {step.type === "station" && isCurrentStep && (boardingPassengersForStation.length > 0 || alightingPassengersForStation.length > 0) && (
                      <div
                        style={{
                          marginTop: 12,
                          paddingTop: 12,
                          borderTop: "1px solid #eef0f3",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <p style={{ margin: 0, fontSize: 12, color: "#5A6A7A", fontWeight: 600 }}>
                          {t("driver.boarding_alighting_desc")}
                        </p>
                        {passengersForStation.length === 0 ? (
                          <p style={{ margin: 0, fontSize: 12, color: "#5A6A7A" }}>
                            {t("driver.no_passenger_assigned")}
                          </p>
                        ) : (
                          passengersForStation.map((passenger) => {
                            const selectedStatus = stationSelectionsForStep[passenger.tripId];
                            const isBoardingPassenger =
                              passenger.status === "waiting" &&
                              (passenger.pickupOrder ?? 0) === step.stationIndex;
                            const isAlightingPassenger =
                              ["picked_up", "on_board"].includes(passenger.status ?? "") &&
                              (passenger.dropoffOrder ?? 0) === step.stationIndex;
                            return (
                              <div
                                key={passenger.tripId}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 10,
                                  padding: "10px 12px",
                                  borderRadius: 10,
                                  background: "#f8f9fa",
                                  border: "1px solid #eef0f3",
                                }}
                              >
                                <div>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0B1E3D" }}>
                                    {passenger.passengerName ?? t("driver.passenger_fallback", { n: passenger.pickupOrder ?? 1 })}
                                  </span>
                                  <div style={{ marginTop: 4, fontSize: 11, color: "#5A6A7A" }}>
                                    {isBoardingPassenger ? t("driver.status_boarding") : isAlightingPassenger ? t("driver.status_alighting") : t("driver.status_pending")}
                                  </div>
                                </div>
                                {isBoardingPassenger ? (
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setStationSelections((prev) => ({
                                          ...prev,
                                          [String(step.stationIndex)]: {
                                            ...(prev[String(step.stationIndex)] ?? {}),
                                            [passenger.tripId]: "arrived",
                                          },
                                        }))
                                      }
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 8,
                                        border: selectedStatus === "arrived" ? "1px solid #27AE60" : "1px solid #dbe2e8",
                                        background: selectedStatus === "arrived" ? "#E8F8F5" : "#fff",
                                        color: selectedStatus === "arrived" ? "#196F3D" : "#5A6A7A",
                                        fontWeight: 700,
                                        fontSize: 12,
                                        cursor: "pointer",
                                      }}
                                    >
                                      {t("driver.arrived")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setStationSelections((prev) => ({
                                          ...prev,
                                          [String(step.stationIndex)]: {
                                            ...(prev[String(step.stationIndex)] ?? {}),
                                            [passenger.tripId]: "no_show",
                                          },
                                        }))
                                      }
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 8,
                                        border: selectedStatus === "no_show" ? "1px solid #E74C3C" : "1px solid #dbe2e8",
                                        background: selectedStatus === "no_show" ? "#FFEBEE" : "#fff",
                                        color: selectedStatus === "no_show" ? "#C0392B" : "#5A6A7A",
                                        fontWeight: 700,
                                        fontSize: 12,
                                        cursor: "pointer",
                                      }}
                                    >
                                      {t("driver.no_show")}
                                    </button>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 12, fontWeight: 700, color: "#00806E" }}>
                                    {t("driver.will_alight_here")}
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {step.type === "station" && isConfirmedStep && !isCurrentStep && (
                      <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: "#27AE60" }}>
                        {t("driver.confirmed_station")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {rideStarted && !isCompleted && allStationsConfirmed && (
            <button
              type="button"
              onClick={handleCloseRide}
              disabled={loadingAction === "close"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 16,
                padding: "10px 16px",
                background: "#0B1E3D",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Flag size={14} />
              {loadingAction === "close" ? t("driver.closing") : t("driver.close_ride")}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
