"use client";

import { useEffect, useState } from "react";
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
import TripChat from "@/components/shared/TripChat";
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

function noShowRemainingSeconds(
  arrivedAt: string | null | undefined,
  minWaitMinutes: number,
  now: number,
): number | null {
  if (!arrivedAt) return null;
  const arrivalMs = Date.parse(arrivedAt);
  if (!Number.isFinite(arrivalMs)) return null;
  return Math.max(
    0,
    Math.ceil((arrivalMs + minWaitMinutes * 60_000 - now) / 1000),
  );
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
  const [clockNow, setClockNow] = useState(0);
  const [rideStarted, setRideStarted] = useState(
    ride.status === "active" || ride.status === "completed",
  );
  const [isCompleted, setIsCompleted] = useState(ride.status === "completed");
  const [confirmedStationIndices, setConfirmedStationIndices] = useState<number[]>([]);
  const [stationSelections, setStationSelections] = useState<Record<string, Record<string, "arrived" | "no_show">>>({});
  const [pickupPins, setPickupPins] = useState<Record<string, string>>({});
  const [driverOrigin, setDriverOrigin] = useState<GeoPoint | null>(
    ride.driverOrigin ?? null,
  );
  const [driverDestination, setDriverDestination] = useState<GeoPoint | null>(
    ride.driverDestination ?? null,
  );
  const { t, locale, dir } = useClientLocale();
  const to12h = (hhmm: string) => formatTime(locale, hhmm);
  const prettyDate = (date: string) => formatDate(locale, date);
  const passengerLabel = (passenger: RideDetailView["passengers"][number]) => {
    const label = t("driver.passenger_fallback", {
      n:
        passenger.passengerNumber ??
        ride.passengers.indexOf(passenger) + 1,
    });
    return passenger.numberOfPassengers > 1
      ? `${label} ${t("driver.passenger_group_size", {
          count: passenger.numberOfPassengers,
        })}`
      : label;
  };
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [navigationErrorByStation, setNavigationErrorByStation] = useState<Record<number, string>>({});
  const [rideActionError, setRideActionError] = useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportType, setReportType] = useState("vehicle_breakdown");
  const [reportNote, setReportNote] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [incidentReported, setIncidentReported] = useState(false);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [incidentWithdrawn, setIncidentWithdrawn] = useState(false);
  const isRideTerminal = ride.status === "cancelled" || ride.status === "completed";

  useEffect(() => {
    const updateClock = () => setClockNow(Date.now());
    const initialUpdate = window.setTimeout(updateClock, 0);
    const interval = window.setInterval(updateClock, 1000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, []);

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
    setRideActionError(null);
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
      const response = await fetch(`/api/actions/ride/${ride.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_ride",
          metadata: { currentLocation: loc },
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.errorCode || errorData?.error || t("ride.start_error"),
        );
      }
    } catch (err) {
      setRideActionError(
        err instanceof Error && err.message === "INCIDENT_OPEN"
          ? t("driver.incident.paused")
          : err instanceof TypeError
          ? t("ride.action_network_error")
          : err instanceof Error
            ? err.message
            : t("ride.start_error"),
      );
      setLoadingAction(null);
      return;
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
    const missingPin = boardingPassengersForStation.some(
      (passenger) =>
        selections[passenger.tripId] === "arrived" &&
        !/^\d{4}$/.test(pickupPins[passenger.tripId] ?? ""),
    );
    if (missingPin) {
      setRideActionError(t("pickup_pin.required"));
      return;
    }

    setLoadingAction(`confirm-${stationIndex}`);
    try {
      const confirmations = boardingPassengersForStation.map((passenger) => ({
        tripId: passenger.tripId,
        status: selections[passenger.tripId],
        ...(selections[passenger.tripId] === "arrived"
          ? { pin: pickupPins[passenger.tripId] }
          : {}),
      }));
      setRideActionError(null);
      const arrivalConfirmations = confirmations.filter(
        (confirmation) => confirmation.status === "arrived",
      );

      const res = await fetch(`/api/actions/ride/${ride.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "station_arrived",
          stationIndex,
          stationName,
          ...(arrivalConfirmations.length === 1
            ? { pin: arrivalConfirmations[0].pin }
            : {}),
          metadata: { confirmations },
        }),
      });

      const responseData = await res.json().catch(() => null);
      if (!res.ok) {
        if (responseData?.errorCode === "NO_SHOW_TOO_EARLY") {
          if (typeof responseData.arrivedAt === "string") {
            setRide((current) => ({
              ...current,
              passengers: current.passengers.map((passenger) =>
                passenger.tripId === responseData.tripId
                  ? { ...passenger, arrivedAt: responseData.arrivedAt }
                  : passenger,
              ),
            }));
          }
          setRideActionError(
            typeof responseData.arrivedAt === "string"
              ? t("driver.no_show_wait_error", {
                  time: formatCountdown(
                    Math.max(0, Number(responseData.remainingSeconds) || 0),
                  ),
                })
              : t("driver.no_show_arrival_required"),
          );
          return;
        }
        throw new Error(
          responseData?.errorCode ||
            responseData?.error ||
            t("ride.confirm_station_error", { stationIndex }),
        );
      }
      const seatAssignments = responseData?.seatAssignments as
        | Record<string, number[]>
        | undefined;

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
            seatAssignments?.[passenger.tripId] ?? nextSeatNumbers ?? [];
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

        return {
          ...passenger,
          status: nextStatus,
          seatNumbers: nextSeatNumbers,
          ...(nextStatus === "no_show"
            ? { noShowAt: new Date().toISOString() }
            : {}),
        };
      });

      setRide((prevRide) => ({
        ...prevRide,
        passengers: nextPassengers,
      }));
      setPickupPins((previous) => {
        const next = { ...previous };
        for (const passenger of boardingPassengersForStation) {
          if (selections[passenger.tripId]) delete next[passenger.tripId];
        }
        return next;
      });
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
      const errorCode = err instanceof Error ? err.message : "";
      setRideActionError(
        errorCode === "INCIDENT_OPEN"
          ? t("driver.incident.paused")
          : errorCode === "SEATS_UNAVAILABLE"
          ? t("ride.seats_unavailable")
          : errorCode === "PICKUP_PIN_INVALID"
          ? t("pickup_pin.invalid")
          : errorCode === "PICKUP_PIN_LOCKED"
            ? t("pickup_pin.locked")
            : errorCode === "PICKUP_PIN_REQUIRED"
              ? t("pickup_pin.required")
                : err instanceof TypeError
                ? t("pickup_pin.network_error")
                : t("ride.confirm_station_error", { stationIndex }),
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const handleConfirmNoShowArrival = async (
    passenger: RideDetailView["passengers"][number],
    step: StepItem,
  ) => {
    setLoadingAction(`no-show-arrival-${passenger.tripId}`);
    setRideActionError(null);
    try {
      const response = await fetch(`/api/actions/ride/${ride.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_no_show_arrival",
          tripId: passenger.tripId,
          stationIndex: step.stationIndex,
          stationName: step.name,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.errorCode || "ARRIVAL_CONFIRMATION_FAILED");
      }
      setRide((current) => ({
        ...current,
        passengers: current.passengers.map((item) =>
          item.tripId === passenger.tripId
            ? { ...item, arrivedAt: data.arrivedAt }
            : item,
        ),
      }));
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setRideActionError(
        code === "INCIDENT_OPEN"
          ? t("driver.incident.paused")
          : code === "PASSENGER_NOT_WAITING"
            ? t("driver.no_show_arrival_unavailable")
            : error instanceof TypeError
              ? t("ride.action_network_error")
              : t("driver.no_show_arrival_error"),
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCloseRide = async () => {
    setLoadingAction("close");
    setRideActionError(null);
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
      const response = await fetch(`/api/actions/ride/${ride.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "end_ride",
          metadata: { currentLocation: loc },
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || t("ride.end_error"));
      }
    } catch (err) {
      console.error(err);
      setRideActionError(
        err instanceof TypeError
          ? t("ride.action_network_error")
          : err instanceof Error
            ? err.message
            : t("ride.end_error"),
      );
      setLoadingAction(null);
      return;
    }

    if (loc) setDriverDestination(loc);
    setRide((prevRide) => ({ ...prevRide, status: "completed" }));
    setIsCompleted(true);
    setLoadingAction(null);
  };

  const handleReportIncident = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReportSubmitting(true);
    setRideActionError(null);
    try {
      const response = await fetch(
        `/api/actions/ride/${ride.id}/incident`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: reportType,
            ...(reportNote.trim() ? { note: reportNote.trim() } : {}),
          }),
        },
      );
      const responseData = await response.json().catch(() => null);
      if (!response.ok) {
        if (responseData?.errorCode === "ALREADY_REPORTED") {
          setRide((current) => ({ ...current, hasOpenIncident: true }));
          setReportDialogOpen(false);
          setRideActionError(t("driver.incident.paused"));
          return;
        }
        throw new Error(responseData?.errorCode || "REPORT_FAILED");
      }
      setRide((current) => ({ ...current, hasOpenIncident: true }));
      setIncidentReported(true);
      setReportDialogOpen(false);
      setReportNote("");
    } catch {
      setRideActionError(t("driver.incident.report_error"));
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleWithdrawIncident = async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(t("driver.incident.withdraw_confirm"))
    ) {
      return;
    }
    setWithdrawSubmitting(true);
    setRideActionError(null);
    try {
      const response = await fetch(
        `/api/actions/ride/${ride.id}/incident/withdraw`,
        { method: "POST" },
      );
      const responseData = await response.json().catch(() => null);
      if (!response.ok) {
        const errorCode = responseData?.errorCode;
        throw new Error(
          errorCode === "FORBIDDEN"
            ? t("driver.incident.withdraw_forbidden")
            : errorCode === "NO_OPEN_INCIDENT"
              ? t("driver.incident.withdraw_no_open")
              : t("driver.incident.withdraw_error"),
        );
      }
      setRide((current) => ({ ...current, hasOpenIncident: false }));
      setIncidentReported(false);
      setIncidentWithdrawn(true);
    } catch (error) {
      setRideActionError(
        error instanceof TypeError
          ? t("ride.action_network_error")
          : error instanceof Error
            ? error.message
            : t("driver.incident.withdraw_error"),
      );
    } finally {
      setWithdrawSubmitting(false);
    }
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

      <style>{`
        .trip-detail-shell {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: var(--space-24) var(--space-16) calc(96px + env(safe-area-inset-bottom));
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .trip-detail-heading {
          display: flex;
          align-items: center;
          gap: var(--space-16);
          margin-bottom: 0;
        }
        .trip-detail-heading-icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #fff;
          background: #00C2A8;
          border: 3px solid #fff;
          box-shadow: 0 0 0 1px #e8edf0, 0 8px 20px rgba(11,30,61,0.08);
        }
        .trip-detail-heading-copy {
          min-width: 0;
          flex: 1;
        }
        .trip-detail-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 16px;
        }
        .trip-detail-primary,
        .trip-detail-secondary {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-width: 0;
        }
        .trip-detail-map-card {
          background: #fff;
          border-radius: 12px;
          border: 1px solid #DCE6E4;
          overflow: hidden;
        }
        .trip-summary-card, .trip-route-card, .trip-manifest-card {
          background: #fff;
          border: 1px solid #DCE6E4;
          border-radius: 12px;
          padding: 20px;
        }
        .trip-summary-label { margin: 0; color: #526262; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        .trip-summary-price { margin: 0; color: #0B1E3D; font-size: 24px; font-weight: 800; }
        .trip-route-timeline { display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 10px; }
        .trip-route-rail { display: flex; flex-direction: column; align-items: center; padding: 4px 0; }
        .trip-route-point { width: 10px; height: 10px; flex: 0 0 10px; border: 2px solid #007A6A; border-radius: 50%; background: #fff; }
        .trip-route-point.end { border-color: #D46A32; }
        .trip-route-line { width: 2px; min-height: 42px; flex: 1; background: #C9DCD6; }
        .trip-route-stops { display: grid; gap: 12px; }
        .trip-route-stop { display: grid; gap: 4px; min-width: 0; padding: 10px; border-radius: 6px; background: #F7FAF9; }
        .trip-route-stop strong { overflow-wrap: anywhere; color: #173337; font-size: 14px; }
        .trip-route-stop span { color: #526262; font-size: 12px; }
        @media (max-width: 899px) {
          .trip-detail-grid { gap: 16px; }
          .trip-detail-primary, .trip-detail-secondary { gap: 16px; }
          .trip-summary-card, .trip-route-card, .trip-manifest-card { padding: 16px; }
        }
        @media (min-width: 900px) {
          .trip-detail-shell {
            padding: 40px var(--space-32) 72px;
            gap: 28px;
          }
          .trip-detail-grid { grid-template-columns: minmax(0, 1fr) 340px; gap: 24px; align-items: start; }
          .trip-detail-secondary { position: sticky; top: var(--app-header-offset); }
          .trip-detail-primary, .trip-detail-secondary { gap: 24px; }
        }
      `}</style>

      <main className="trip-detail-shell">
        {/* Header section matching passenger page structure */}
        <div className="trip-detail-heading">
          <div className="trip-detail-heading-icon" aria-hidden="true">
            <Car size={28} />
          </div>
          <div className="trip-detail-heading-copy">
            <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, lineHeight: 1.2, color: "#0B1E3D" }}>
              {vLabel}
            </h1>
            <p style={{ margin: "0 0 9px", fontSize: 13, color: "#5A6A7A" }}>
              {t("my_trips.ride_number", { rideNumber: ride.rideNumber })} · {prettyDate(ride.date)}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: "#EEF2F2",
                  color: "#405555",
                  whiteSpace: "nowrap",
                }}
              >
                {t(ride.rideType === "shared" ? "ride.shared" : "ride.private")}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  background: isCompleted ? "#E8F5E9" : rideStarted ? "#E2F8F5" : "#FFF3E0",
                  color: isCompleted ? "#166B48" : rideStarted ? "#006D60" : "#8B4A08",
                  whiteSpace: "nowrap",
                }}
              >
                {isCompleted ? t("driver.completed") : rideStarted ? t("driver.ongoing") : t("driver.upcoming")}
              </span>
              <strong style={{ fontSize: 14, color: "#0B1E3D", fontVariantNumeric: "tabular-nums" }}>
                {formatEgp(locale, ride.totalCost)}
              </strong>
            </div>
          </div>
        </div>

        <div className="trip-detail-grid">
          {/* Primary Column: Map, Route Timeline, Seat Map, Manifest, Route Details */}
          <div className="trip-detail-primary">
            {/* Route map */}
            <div className="trip-detail-map-card">
              <RouteMap
                pickup={stationPoints[0] ?? null}
                dropoff={stationPoints[stationPoints.length - 1] ?? null}
                stations={stationPoints.length > 2 ? stationPoints.slice(1, -1) : []}
                stationIconsOnly
                routeCoordinates={ride.routeCoordinates}
                height={280}
                interactive
              />
            </div>

            {/* Route timeline (matching passenger page structure) */}
            <section className="trip-route-card" aria-labelledby="trip-route-title">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <h2 id="trip-route-title" style={{ margin: 0, color: "#173337", fontSize: 16, fontWeight: 800 }}>
                  {t("driver.route_details")}
                </h2>
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
              <div className="trip-route-timeline">
                <div className="trip-route-rail" aria-hidden="true">
                  <span className="trip-route-point" />
                  <span className="trip-route-line" />
                  <span className="trip-route-point end" />
                </div>
                <div className="trip-route-stops">
                  <div className="trip-route-stop">
                    <span style={{ color: "#526262", fontSize: 11, fontWeight: 700 }}>
                      {t("driver.origin_label")}
                    </span>
                    <strong>{steps[0]?.name ?? t("ride.driver_origin")}</strong>
                    <span>{t("driver.origin_note")}</span>
                  </div>
                  {stationSteps.length > 0 && (
                    <div className="trip-route-stop">
                      <span style={{ color: "#526262", fontSize: 11, fontWeight: 700 }}>
                        {t("driver.station_label")} (×{stationSteps.length})
                      </span>
                      <strong>{t("driver.route_details_desc")}</strong>
                      <span>{t("driver.boarding")} + {t("driver.alighting")}</span>
                    </div>
                  )}
                  <div className="trip-route-stop">
                    <span style={{ color: "#526262", fontSize: 11, fontWeight: 700 }}>
                      {t("driver.destination_label")}
                    </span>
                    <strong>{steps[steps.length - 1]?.name ?? t("ride.driver_destination")}</strong>
                    <span>{t("driver.destination_note")}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Visual 2D Seating Map */}
            <VehicleSeatMap
              ride={ride}
              isDriver
              rideStarted={rideStarted}
              activeStationIndex={activeStationIndex}
              confirmedStationIndices={confirmedStationIndices}
              stationSelections={stationSelections}
            />

            {/* Manifest section (driver-specific: all passengers with chat) */}
            <section className="trip-manifest-card" aria-label={t("chat.manifest_title")}>
              <h2 style={{ margin: "0 0 12px", color: "#0B1E3D", fontSize: 15, fontWeight: 800 }}>
                {t("chat.manifest_title")}
              </h2>
              <div style={{ display: "grid", gap: 10 }}>
                {ride.passengers.map((passenger) => (
                  <div
                    key={`chat-passenger-${passenger.tripId}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      padding: 10,
                      border: "1px solid #E7ECEF",
                      borderRadius: 12,
                    }}
                  >
                    <strong style={{ color: "#0B1E3D", fontSize: 14 }}>
                      {passengerLabel(passenger)}
                    </strong>
                    <TripChat
                      tripId={passenger.tripId}
                      role="driver"
                      passengerNumber={passenger.passengerNumber}
                      triggerLabel={t("chat.open")}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Full Route Details Section with Driver Controls (driver-specific) */}
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #eef0f3",
                padding: "20px 20px",
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
                  const noShowPassengersForStation =
                    step.type === "station"
                      ? ride.passengers.filter(
                          (passenger) =>
                            passenger.status === "no_show" &&
                            stationMatchesPassenger(passenger, step.stationIndex, step.name, "pickup"),
                        )
                      : [];
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
                  const isPickupPinComplete = boardingPassengersForStation.every(
                    (passenger) =>
                      stationSelectionsForStep[passenger.tripId] !== "arrived" ||
                      /^\d{4}$/.test(pickupPins[passenger.tripId] ?? ""),
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

                          {!isRideTerminal && !isCompleted && step.type === "station" && isCurrentStep && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleConfirmStation(step.stationIndex, step.name)
                                }
                                disabled={
                                  loadingAction === `confirm-${step.stationIndex}` ||
                                  (requiresPassengerSelections && !isDecisionComplete)
                                  || (requiresPassengerSelections && !isPickupPinComplete)
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
                                    || (requiresPassengerSelections && !isPickupPinComplete)
                                      ? "not-allowed"
                                      : "pointer",
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                                  opacity:
                                    requiresPassengerSelections &&
                                    (!isDecisionComplete || !isPickupPinComplete)
                                      ? 0.7
                                      : 1,
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
                                  name: passengerLabel(passenger),
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
                                  {passengerLabel(passenger)}
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
                                const noShowRemaining = noShowRemainingSeconds(
                                  passenger.arrivedAt,
                                  ride.noShowMinWaitMinutes,
                                  clockNow,
                                );
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
                                        {passengerLabel(passenger)}
                                      </span>
                                      <div style={{ marginTop: 4, fontSize: 11, color: "#5A6A7A" }}>
                                        {isBoardingPassenger ? t("driver.status_boarding") : isAlightingPassenger ? t("driver.status_alighting") : t("driver.status_pending")}
                                      </div>
                                    </div>
                                    {isBoardingPassenger ? (
                                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                                          disabled={
                                            noShowRemaining === null ||
                                            noShowRemaining > 0
                                          }
                                          onClick={() => {
                                            setPickupPins((previous) => {
                                              const next = { ...previous };
                                              delete next[passenger.tripId];
                                              return next;
                                            });
                                            setStationSelections((prev) => ({
                                              ...prev,
                                              [String(step.stationIndex)]: {
                                                ...(prev[String(step.stationIndex)] ?? {}),
                                                [passenger.tripId]: "no_show",
                                              },
                                            }));
                                          }}
                                          style={{
                                            padding: "6px 10px",
                                            borderRadius: 8,
                                            border: selectedStatus === "no_show" ? "1px solid #E74C3C" : "1px solid #dbe2e8",
                                            background: selectedStatus === "no_show" ? "#FFEBEE" : "#fff",
                                            color: selectedStatus === "no_show" ? "#C0392B" : "#5A6A7A",
                                            fontWeight: 700,
                                            fontSize: 12,
                                            cursor:
                                              noShowRemaining === null ||
                                              noShowRemaining > 0
                                                ? "not-allowed"
                                                : "pointer",
                                            opacity:
                                              noShowRemaining === null ||
                                              noShowRemaining > 0
                                                ? 0.55
                                                : 1,
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
                                    {isBoardingPassenger && (
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 8,
                                          width: "100%",
                                          flexWrap: "wrap",
                                          fontSize: 11,
                                          color: "#5A6A7A",
                                        }}
                                      >
                                        {noShowRemaining === null ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleConfirmNoShowArrival(
                                                passenger,
                                                step,
                                              )
                                            }
                                            disabled={
                                              loadingAction ===
                                              `no-show-arrival-${passenger.tripId}`
                                            }
                                            style={{
                                              border: "1px solid #dbe2e8",
                                              borderRadius: 7,
                                              background: "#fff",
                                              color: "#0B1E3D",
                                              padding: "5px 8px",
                                              fontWeight: 700,
                                              cursor: "pointer",
                                            }}
                                          >
                                            {loadingAction ===
                                            `no-show-arrival-${passenger.tripId}`
                                              ? t("driver.confirming")
                                              : t("driver.confirm_arrival_for_wait")}
                                          </button>
                                        ) : noShowRemaining > 0 ? (
                                          <span>
                                            {t("driver.no_show_wait_countdown", {
                                              time: formatCountdown(noShowRemaining),
                                            })}
                                          </span>
                                        ) : (
                                          <span>{t("driver.no_show_wait_complete")}</span>
                                        )}
                                      </div>
                                    )}
                                    {isBoardingPassenger && selectedStatus === "arrived" && (
                                      <label
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 8,
                                          width: "100%",
                                          fontSize: 12,
                                          fontWeight: 700,
                                          color: "#0B1E3D",
                                        }}
                                      >
                                        {t("pickup_pin.driver_prompt")}
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          maxLength={4}
                                          autoComplete="off"
                                          pattern="[0-9]{4}"
                                          aria-label={t("pickup_pin.driver_prompt")}
                                          value={pickupPins[passenger.tripId] ?? ""}
                                          onChange={(event) => {
                                            setRideActionError(null);
                                            setPickupPins((previous) => ({
                                              ...previous,
                                              [passenger.tripId]: event.target.value
                                                .replace(/\D/g, "")
                                                .slice(0, 4),
                                            }));
                                          }}
                                          style={{
                                            width: 88,
                                            padding: "7px 9px",
                                            border: "1px solid #cbd5e1",
                                            borderRadius: 8,
                                            fontSize: 16,
                                            fontWeight: 800,
                                            letterSpacing: "0.2em",
                                            textAlign: "center",
                                          }}
                                        />
                                      </label>
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

              {!isRideTerminal && rideStarted && !isCompleted && allStationsConfirmed && (
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
          </div>

          {/* Secondary Column: Ride Summary, Report Problem, Incident Banner */}
          <div className="trip-detail-secondary">
            <aside className="trip-summary-card" aria-labelledby="trip-summary-title">
              <h2 id="trip-summary-title" style={{ margin: 0, color: "#173337", fontSize: 16, fontWeight: 800 }}>
                {t("trip_detail.summary")}
              </h2>

              <div style={{ marginTop: 14 }}>
                <p className="trip-summary-label">{t("trip_detail.status")}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 7 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      background: isCompleted ? "#E8F5E9" : rideStarted ? "#E2F8F5" : "#FFF3E0",
                      color: isCompleted ? "#166B48" : rideStarted ? "#006D60" : "#8B4A08",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isCompleted ? t("driver.completed") : rideStarted ? t("driver.ongoing") : t("driver.upcoming")}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <p className="trip-summary-label">{t("driver.passenger_count", { count: ride.passengerCount, plural: ride.passengerCount === 1 ? "" : "s" })}</p>
                <p style={{ margin: "6px 0 0", fontSize: 14, color: "#0B1E3D", fontWeight: 600 }}>
                  <Users size={14} style={{ verticalAlign: "middle", marginInlineEnd: 5 }} aria-hidden="true" />
                  {ride.passengerCount}
                </p>
              </div>

              <div style={{ marginTop: 14 }}>
                <p className="trip-summary-label">{t("trip_detail.trip_price")}</p>
                <p className="trip-summary-price">{formatEgp(locale, ride.totalCost)}</p>
              </div>

              <div style={{ marginTop: 14 }}>
                <p className="trip-summary-label">{t("driver.vehicle")}</p>
                <p style={{ margin: "6px 0 0", fontSize: 14, color: "#0B1E3D", fontWeight: 600 }}>
                  <Car size={14} style={{ verticalAlign: "middle", marginInlineEnd: 5 }} aria-hidden="true" />
                  {vLabel}
                </p>
              </div>

              <div style={{ marginTop: 14 }}>
                <p className="trip-summary-label">{t("driver.window_prefix")}</p>
                <p style={{ margin: "6px 0 0", fontSize: 14, color: "#0B1E3D", fontWeight: 600 }}>
                  <Clock size={14} style={{ verticalAlign: "middle", marginInlineEnd: 5 }} aria-hidden="true" />
                  {to12h(ride.startTime)} – {to12h(ride.endTime)}
                </p>
              </div>

              {/* Report problem button */}
              {(ride.status === "confirmed" || ride.status === "active") && !ride.hasOpenIncident && (
                <button
                  type="button"
                  onClick={() => setReportDialogOpen(true)}
                  style={{
                    marginTop: 16,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    justifyContent: "center",
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "1px solid #F5A623",
                    background: "#fff",
                    color: "#A16207",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Flag size={14} aria-hidden="true" />
                  {t("driver.incident.report_problem")}
                </button>
              )}

              {/* Start Ride Action */}
              {!isRideTerminal && !rideStarted && !isCompleted && (
                <button
                  type="button"
                  onClick={handleStartRide}
                  disabled={loadingAction === "start"}
                  style={{
                    marginTop: 16,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    justifyContent: "center",
                    padding: "12px 16px",
                    background: "#0B1E3D",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <Play size={16} fill="#fff" />
                  {loadingAction === "start" ? t("driver.starting") : t("driver.start_ride")}
                </button>
              )}
            </aside>

            {/* Incident banner */}
            {(ride.hasOpenIncident || incidentReported) && (
              <div
                role="status"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: "1px solid #F59E0B",
                  background: "#FFF8E1",
                  color: "#A16207",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                <span>{t("driver.incident.paused")}</span>
                <button
                  type="button"
                  onClick={() => void handleWithdrawIncident()}
                  disabled={withdrawSubmitting}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #A16207",
                    background: "#fff",
                    color: "#A16207",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    opacity: withdrawSubmitting ? 0.6 : 1,
                  }}
                >
                  {withdrawSubmitting
                    ? t("driver.incident.withdrawing")
                    : t("driver.incident.withdraw")}
                </button>
              </div>
            )}
            {incidentWithdrawn && !ride.hasOpenIncident && (
              <div
                role="status"
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: "1px solid #00C2A8",
                  background: "#E8F4F1",
                  color: "#006D60",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {t("driver.incident.withdrawn")}
              </div>
            )}
            {rideActionError && (
              <div
                role="alert"
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "#FFEBEE",
                  color: "#C0392B",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {rideActionError}
              </div>
            )}
          </div>
        </div>
      {/* Report incident dialog (unchanged from original) */}
      {reportDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reportSubmitting) {
              setReportDialogOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="ride-incident-dialog-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <h2
              id="ride-incident-dialog-title"
              className="mb-4 text-lg font-extrabold text-slate-900"
            >
              {t("driver.incident.dialog_title")}
            </h2>
            <form onSubmit={handleReportIncident} className="grid gap-4">
              <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
                {t("driver.incident.type_label")}
                <select
                  value={reportType}
                  onChange={(event) => setReportType(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                >
                  <option value="vehicle_breakdown">
                    {t("driver.incident.type.vehicle_breakdown")}
                  </option>
                  <option value="accident">{t("driver.incident.type.accident")}</option>
                  <option value="emergency">{t("driver.incident.type.emergency")}</option>
                  <option value="passenger_issue">
                    {t("driver.incident.type.passenger_issue")}
                  </option>
                  <option value="other">{t("driver.incident.type.other")}</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
                {t("driver.incident.note_label")}
                <textarea
                  value={reportNote}
                  onChange={(event) => setReportNote(event.target.value)}
                  maxLength={300}
                  rows={3}
                  className="resize-y rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportDialogOpen(false)}
                  disabled={reportSubmitting}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
                >
                  {t("driver.incident.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={reportSubmitting}
                  className="rounded-lg bg-[#0B1E3D] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {reportSubmitting
                    ? t("driver.incident.submitting")
                    : t("driver.incident.submit")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

    </main>
    </div>
  );
}
