"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  X,
  Clock,
  MapPin,
  Navigation,
  Info,
  RotateCcw,
} from "lucide-react";
import AddressInput from "@/components/landing/AddressInput";
import {
  VEHICLES,
  VEHICLE_LIST,
  priceFor,
  maxExtraPassengers,
  finalPrice,
  privateRouteLegPrices,
  waitingCostEgp,
  type VehicleKey,
  type VehicleConfig,
} from "@/lib/config/vehicles";
import {
  computeArrivalTime,
  computePickupTime,
  toHHMM,
  toMinutes,
} from "@/lib/time/pickupWindow";
import { fetchRoute } from "@/lib/openrouteservice";
import type { TripPoint } from "@/lib/store/useTripStore";
import type { SavedAddress } from "@/types/shared";
import {
  isSharedVehicle,
  findNearestStations,
  haversineKm,
  type Station,
  type StationOption,
} from "@/lib/geo/stations";

export interface PassengerDetail {
  id: string;
  sameAsMain: boolean;
  pickup: TripPoint | null;
  dropoff: TripPoint | null;
}

export interface StopPoint {
  id: string;
  point: TripPoint | null;
  alighting: number;
  boarding: number;
  waitingMinutes: number;
}

export interface RouteLeg {
  distanceKm: number;
  durationMinutes: number;
  passengers?: number;
  priceEgp?: number;
}

export interface TripData {
  id: string;
  pickup: TripPoint | null;
  dropoff: TripPoint | null;
  vehicleType: VehicleKey | ""; // "" = not yet chosen ("Select type to continue")
  arrivalTime: string; // "HH:MM" 24h
  pickupTime: string; // computed
  distanceKm: number | null;
  durationMinutes: number | null;
  priceEgp: number | null;
  routeCoordinates: [number, number][] | null;
  routeLegs: RouteLeg[];
  extraPassengers: number;
  numberOfPassengers: number;
  stops: StopPoint[];
  returnTrip?: boolean; // UI flag — reverse of source trip
  pickupStation: {
    id: number;
    lat: number;
    lng: number;
    name: string;
    direction?: string;
    stationType: string;
  } | null;
  dropoffStation: {
    id: number;
    lat: number;
    lng: number;
    name: string;
    direction?: string;
    stationType: string;
  } | null;
  pickupStationOptions: StationOption[];
  dropoffStationOptions: StationOption[];
  walkingMinToStation: number | null; // walk from pickup → pickup station
  walkingMinFromStation: number | null; // walk from dropoff station → dropoff
  passengers: PassengerDetail[]; // per-extra-passenger detail (private vehicles may set distinct points)
  baseDistanceKm: number | null; // main pickup→dropoff distance (reference for 25% detour cap)
  passengerDetourKm: number | null; // last computed combined route distance through distinct passenger points
}

interface Props {
  data: TripData;
  index: number;
  canRemove: boolean;
  onChange: (updated: TripData) => void;
  onRemove: () => void;
  picking?: "pickup" | "dropoff" | null;
  onPickFromMap?: (field: "pickup" | "dropoff") => void;
  sourceTripData?: TripData | null; // trips[0] for return-trip toggle
  savedAddresses?: SavedAddress[];
  stations?: Station[];
  minArrivalTime?: string | null; // earliest valid arrival for this trip
  onAddressSaved?: (saved: SavedAddress) => void;
  vehiclesMap?: Record<VehicleKey, VehicleConfig>; // DB-hydrated vehicle config (falls back to static seed)
  vehicleList?: VehicleConfig[]; // DB-hydrated vehicle list for the select options
}

function pickBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    padding: "6px 10px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    border: `1.5px solid ${active ? "#00C2A8" : "#e8edf0"}`,
    background: active ? "rgba(0,194,168,0.1)" : "#f8f9fa",
    color: active ? "#00897B" : "#5A6A7A",
  };
}

/** Render "HH:MM" 24h as 12h am/pm */
function to12h(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatWaitDuration(minutes: number): string {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  return `${String(Math.floor(safeMinutes / 60)).padStart(2, "0")}:${String(safeMinutes % 60).padStart(2, "0")}`;
}

function parseWaitDuration(value: string): number | null {
  const match = /^(\d{2,}):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

// Helper — check if a point is already saved
function isAlreadySaved(pt: TripPoint, saved: SavedAddress[]): boolean {
  return saved.some(
    (s) =>
      Math.abs(s.lat - pt.lat) < 0.0001 && Math.abs(s.lng - pt.lng) < 0.0001,
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#0B1E3D",
  display: "block",
  marginBottom: 6,
};

const readonlyStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 14px",
  height: 52,
  background: "#f0f4f8",
  borderRadius: 12,
  border: "1.5px solid #e8edf0",
  cursor: "not-allowed",
};

const timeInputStyle: React.CSSProperties = {
  width: "100%",
  height: 52,
  padding: "0 14px",
  borderRadius: 12,
  border: "1.5px solid #e8edf0",
  background: "#f8f9fa",
  fontSize: 15,
  fontFamily: "inherit",
  color: "#0B1E3D",
  boxSizing: "border-box",
};

const routeInfoStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 12px",
  background: "#eff7f6",
  borderRadius: 8,
  fontSize: 13,
  color: "#0B1E3D",
  fontWeight: 500,
};

const locationErrorStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#e74c3c",
  background: "rgba(231,76,60,0.07)",
  border: "1px solid rgba(231,76,60,0.2)",
  borderRadius: 8,
  padding: "8px 12px",
  marginTop: 6,
};

function counterButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: 10,
    border: "1.5px solid #e8edf0",
    background: "#f8f9fa",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 20,
    color: "#0B1E3D",
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function CounterField({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#0B1E3D" }}>
        {label}
      </span>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}
      >
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          aria-label={`Decrease ${label.toLowerCase()}`}
          style={counterButtonStyle(value <= 0)}
        >
          −
        </button>
        <span style={{ minWidth: 18, textAlign: "center", fontWeight: 700 }}>
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
          style={counterButtonStyle(value >= max)}
        >
          +
        </button>
      </div>
    </div>
  );
}

function StationOptions({
  label,
  options,
  selectedId,
  onSelect,
}: {
  label: string;
  options: StationOption[];
  selectedId: number | undefined;
  onSelect: (stationId: number) => void;
}) {
  if (!options.length) return null;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{ display: "grid", gap: 6, marginTop: 8 }}
    >
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <label
            key={option.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              border: `1.5px solid ${selected ? "#00C2A8" : "#e8edf0"}`,
              borderRadius: 8,
              background: selected ? "rgba(0,194,168,0.08)" : "#f8f9fa",
              color: "#0B1E3D",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            <input
              type="radio"
              name={label}
              value={option.id}
              checked={selected}
              onChange={() => onSelect(option.id)}
              style={{ accentColor: "#00C2A8" }}
            />
            <strong style={{ fontSize: 13 }}>
              {option.name}
              {option.direction ? ` (${option.direction})` : ""}
            </strong>
            <span style={{ marginLeft: "auto", color: "#5A6A7A" }}>
              {option.distanceKm.toFixed(2)} km · ~{option.walkingMin} min walk
            </span>
          </label>
        );
      })}
    </div>
  );
}

function WaitDurationInput({
  id,
  minutes,
  onChange,
}: {
  id: string;
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  const [value, setValue] = useState(() => formatWaitDuration(minutes));

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      pattern="\d{2,}:\d{2}"
      placeholder="00:00"
      value={value}
      onChange={(event) => {
        const nextValue = event.target.value;
        if (!/^\d{0,}(:\d{0,2})?$/.test(nextValue)) return;
        setValue(nextValue);
        const nextMinutes = parseWaitDuration(nextValue);
        if (nextMinutes !== null) onChange(nextMinutes);
      }}
      onBlur={() => {
        const nextMinutes = parseWaitDuration(value);
        if (nextMinutes === null) setValue(formatWaitDuration(minutes));
      }}
      required
      style={timeInputStyle}
    />
  );
}

export default function TripCycle({
  data,
  index,
  canRemove,
  onChange,
  onRemove,
  picking,
  onPickFromMap,
  sourceTripData,
  savedAddresses = [],
  stations = [],
  minArrivalTime,
  onAddressSaved,
  vehiclesMap,
  vehicleList,
}: Props) {
  const [routeLoading, setRouteLoading] = useState(false);
  const [stopError, setStopError] = useState("");
  const [locating, setLocating] = useState<"pickup" | "dropoff" | null>(null);
  const vMap = vehiclesMap ?? VEHICLES;
  const vList = vehicleList ?? VEHICLE_LIST;

  function handleReturnToggle(checked: boolean) {
    if (checked && sourceTripData) {
      // Swap pickup/dropoff from source trip
      onChange({
        ...data,
        returnTrip: true,
        pickup: sourceTripData.dropoff,
        dropoff: sourceTripData.pickup,
        arrivalTime: "",
        pickupTime: "",
        distanceKm: null,
        durationMinutes: null,
        priceEgp: null,
        routeCoordinates: null,
        routeLegs: [],
        pickupStation: null,
        dropoffStation: null,
        pickupStationOptions: [],
        dropoffStationOptions: [],
        walkingMinToStation: null,
        walkingMinFromStation: null,
        passengers: [],
        numberOfPassengers: 1,
        stops: [],
        baseDistanceKm: null,
        passengerDetourKm: null,
      });
    } else {
      onChange({
        ...data,
        returnTrip: false,
        pickup: null,
        dropoff: null,
        arrivalTime: "",
        pickupTime: "",
        distanceKm: null,
        durationMinutes: null,
        priceEgp: null,
        routeCoordinates: null,
        routeLegs: [],
        pickupStation: null,
        dropoffStation: null,
        pickupStationOptions: [],
        dropoffStationOptions: [],
        walkingMinToStation: null,
        walkingMinFromStation: null,
        passengers: [],
        numberOfPassengers: 1,
        stops: [],
        baseDistanceKm: null,
        passengerDetourKm: null,
      });
    }
  }

  /* ── Auto-fetch route when both pickup+dropoff filled ── */
  useEffect(() => {
    if (!isSharedVehicle(data.vehicleType)) return;
    if (!data.pickup || !data.dropoff) {
      onChange({
        ...data,
        distanceKm: null,
        durationMinutes: null,
        priceEgp: null,
        pickupTime: "",
        routeCoordinates: null,
        routeLegs: [],
        pickupStation: null,
        dropoffStation: null,
        pickupStationOptions: [],
        dropoffStationOptions: [],
        walkingMinToStation: null,
        walkingMinFromStation: null,
        baseDistanceKm: null,
        passengerDetourKm: null,
      });
      return;
    }

    if (!data.vehicleType) return;
    const vehicleType = data.vehicleType;

    const shared = isSharedVehicle(vehicleType);

    // For shared vehicles route through currently selected nearby stations.
    let routeFrom: TripPoint = data.pickup;
    let routeTo: TripPoint = data.dropoff;
    let selectedPickupStation: TripData["pickupStation"] = null;
    let selectedDropoffStation: TripData["dropoffStation"] = null;
    let pickupStationOptions: StationOption[] = [];
    let dropoffStationOptions: StationOption[] = [];
    let walkMinToStation: number | null = null;
    let walkMinFromStation: number | null = null;

    if (shared && stations.length > 0) {
      pickupStationOptions = findNearestStations(
        data.pickup.lat,
        data.pickup.lng,
        stations,
        vehicleType,
      );
      dropoffStationOptions = findNearestStations(
        data.dropoff.lat,
        data.dropoff.lng,
        stations,
        vehicleType,
      );
      const pickupOption =
        pickupStationOptions.find(
          (option) => option.id === data.pickupStation?.id,
        ) ?? pickupStationOptions[0];
      const dropoffOption =
        dropoffStationOptions.find(
          (option) => option.id === data.dropoffStation?.id,
        ) ?? dropoffStationOptions[0];

      if (pickupOption) {
        selectedPickupStation = {
          id: pickupOption.id,
          lat: pickupOption.lat,
          lng: pickupOption.lng,
          name: pickupOption.name,
          direction: pickupOption.direction,
          stationType: pickupOption.stationType,
        };
        walkMinToStation = pickupOption.walkingMin;
        routeFrom = {
          address: pickupOption.name,
          lat: pickupOption.lat,
          lng: pickupOption.lng,
        };
      }
      if (dropoffOption) {
        selectedDropoffStation = {
          id: dropoffOption.id,
          lat: dropoffOption.lat,
          lng: dropoffOption.lng,
          name: dropoffOption.name,
          direction: dropoffOption.direction,
          stationType: dropoffOption.stationType,
        };
        walkMinFromStation = dropoffOption.walkingMin;
        routeTo = {
          address: dropoffOption.name,
          lat: dropoffOption.lat,
          lng: dropoffOption.lng,
        };
      }
    }

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRouteLoading(true);
    fetchRoute([routeFrom, routeTo])
      .then((routes) => {
        if (cancelled || !routes.length) return;
        const { distance_km, duration_minutes, coordinates } = routes[0];
        const price = priceFor(distance_km, vehicleType, vMap);
        // For shared: also subtract walk-from-station time from arrival before computing pickup
        const extraWalk = walkMinFromStation ?? 0;
        const pt = data.arrivalTime
          ? computePickupTime(
              data.arrivalTime,
              duration_minutes + extraWalk,
              vehicleType,
              vMap,
            )
          : "";
        onChange({
          ...data,
          distanceKm: distance_km,
          durationMinutes: duration_minutes,
          priceEgp: price,
          pickupTime: pt,
          routeCoordinates: coordinates,
          pickupStation: selectedPickupStation,
          dropoffStation: selectedDropoffStation,
          pickupStationOptions,
          dropoffStationOptions,
          walkingMinToStation: walkMinToStation,
          walkingMinFromStation: walkMinFromStation,
          baseDistanceKm: distance_km,
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(data.pickup),
    JSON.stringify(data.dropoff),
    data.vehicleType,
    stations.length,
    data.pickupStation?.id,
    data.dropoffStation?.id,
  ]);

  /* ── Private route: pickup → ordered stops → dropoff ── */
  const privateStopsSignature = JSON.stringify(data.stops);
  useEffect(() => {
    if (!data.vehicleType || isSharedVehicle(data.vehicleType)) return;

    const hasCompleteRoute =
      data.pickup && data.dropoff && data.stops.every((stop) => stop.point);
    if (!hasCompleteRoute) {
      if (
        data.distanceKm !== null ||
        data.durationMinutes !== null ||
        data.priceEgp !== null ||
        data.arrivalTime ||
        data.routeCoordinates !== null
      ) {
        onChange({
          ...data,
          distanceKm: null,
          durationMinutes: null,
          priceEgp: null,
          arrivalTime: "",
          routeCoordinates: null,
          routeLegs: [],
          pickupStation: null,
          dropoffStation: null,
          pickupStationOptions: [],
          dropoffStationOptions: [],
          walkingMinToStation: null,
          walkingMinFromStation: null,
        });
      }
      return;
    }

    const vehicleType = data.vehicleType;
    const totalWaitingMinutes = data.stops.reduce(
      (total, stop) => total + stop.waitingMinutes,
      0,
    );
    let cancelled = false;
    const routePoints = [
      data.pickup!,
      ...data.stops.map((stop) => stop.point!),
      data.dropoff!,
    ];
    Promise.all([
      fetchRoute(routePoints),
      ...routePoints
        .slice(0, -1)
        .map((point, pointIndex) =>
          fetchRoute([point, routePoints[pointIndex + 1]]),
        ),
    ])
      .then(([routes, ...legRoutes]) => {
        if (cancelled || !routes.length) return;
        const { distance_km, duration_minutes, coordinates } = routes[0];
        let onboard = data.numberOfPassengers;
        const routeLegs: RouteLeg[] = legRoutes.map((legRoute, legIndex) => {
          const leg = {
            distanceKm: legRoute[0]?.distance_km ?? 0,
            durationMinutes: legRoute[0]?.duration_minutes ?? 0,
            passengers: onboard,
          };
          const stop = data.stops[legIndex];
          if (stop) onboard += stop.boarding - stop.alighting;
          return leg;
        });
        const legPrices = privateRouteLegPrices(
          routeLegs.map((leg) => ({
            distanceKm: leg.distanceKm,
            passengers: leg.passengers ?? 1,
          })),
          vehicleType,
          vMap,
        );
        routeLegs.forEach((leg, legIndex) => {
          leg.priceEgp = legPrices[legIndex];
        });
        const price = Math.round(
          legPrices.reduce((sum, legPrice) => sum + legPrice, 0) +
            waitingCostEgp(totalWaitingMinutes, vehicleType, vMap),
        );
        onChange({
          ...data,
          distanceKm: distance_km,
          durationMinutes: duration_minutes,
          priceEgp: price,
          arrivalTime: data.pickupTime
            ? computeArrivalTime(
                data.pickupTime,
                duration_minutes,
                totalWaitingMinutes,
                10,
              )
            : "",
          routeCoordinates: coordinates,
          routeLegs,
          pickupStation: null,
          dropoffStation: null,
          pickupStationOptions: [],
          dropoffStationOptions: [],
          walkingMinToStation: null,
          walkingMinFromStation: null,
          baseDistanceKm: distance_km,
          passengerDetourKm: null,
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(data.pickup),
    JSON.stringify(data.dropoff),
    privateStopsSignature,
    data.vehicleType,
    data.numberOfPassengers,
    data.pickupTime,
  ]);

  /* ── Passenger detour: combined route through distinct passenger points (private vehicles only) ── */
  useEffect(() => {
    if (!data.pickup || !data.dropoff || !data.vehicleType) return;
    const vehicleType = data.vehicleType;
    const isPrivate = !isSharedVehicle(vehicleType);
    const distinct = isPrivate
      ? (data.passengers ?? []).filter(
          (p) => !p.sameAsMain && p.pickup && p.dropoff,
        )
      : [];

    let cancelled = false;

    if (distinct.length === 0) {
      // Nothing distinct — ensure distanceKm reflects the base pickup→dropoff route.
      if (data.passengerDetourKm == null) return;
      fetchRoute([data.pickup, data.dropoff])
        .then((routes) => {
          if (cancelled || !routes.length) return;
          const { distance_km, duration_minutes, coordinates } = routes[0];
          const price = priceFor(distance_km, vehicleType, vMap);
          const pt = data.arrivalTime
            ? computePickupTime(
                data.arrivalTime,
                duration_minutes,
                vehicleType,
                vMap,
              )
            : data.pickupTime;
          onChange({
            ...data,
            distanceKm: distance_km,
            durationMinutes: duration_minutes,
            priceEgp: price,
            pickupTime: pt,
            routeCoordinates: coordinates,
            baseDistanceKm: distance_km,
            passengerDetourKm: null,
          });
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }

    const waypoints = [
      data.pickup,
      ...distinct.map((p) => p.pickup!),
      ...distinct.map((p) => p.dropoff!),
      data.dropoff,
    ];

    fetchRoute(waypoints)
      .then((routes) => {
        if (cancelled || !routes.length) return;
        const { distance_km, duration_minutes, coordinates } = routes[0];
        const base = data.baseDistanceKm ?? distance_km;
        const withinLimit = distance_km <= base * 1.25;
        if (withinLimit) {
          const price = priceFor(distance_km, vehicleType, vMap);
          const pt = data.arrivalTime
            ? computePickupTime(
                data.arrivalTime,
                duration_minutes,
                vehicleType,
                vMap,
              )
            : data.pickupTime;
          onChange({
            ...data,
            distanceKm: distance_km,
            durationMinutes: duration_minutes,
            priceEgp: price,
            pickupTime: pt,
            routeCoordinates: coordinates,
            passengerDetourKm: distance_km,
          });
        } else {
          onChange({ ...data, passengerDetourKm: distance_km });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(data.passengers),
    JSON.stringify(data.pickup),
    JSON.stringify(data.dropoff),
    data.vehicleType,
    data.baseDistanceKm,
  ]);

  /* ── Recompute pickup time when arrival, vehicle, or walking changes ── */
  useEffect(() => {
    if (!isSharedVehicle(data.vehicleType)) return;
    if (!data.arrivalTime || !data.durationMinutes || !data.vehicleType) return;
    const extraWalk = isSharedVehicle(data.vehicleType)
      ? (data.walkingMinFromStation ?? 0)
      : 0;
    const pt = computePickupTime(
      data.arrivalTime,
      data.durationMinutes + extraWalk,
      data.vehicleType,
      vMap,
    );
    if (pt !== data.pickupTime) onChange({ ...data, pickupTime: pt });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data.arrivalTime,
    data.vehicleType,
    data.durationMinutes,
    data.walkingMinFromStation,
  ]);

  /* ── Recompute price when vehicle changes ── */
  useEffect(() => {
    if (!isSharedVehicle(data.vehicleType)) return;
    if (!data.distanceKm || !data.vehicleType) return;
    const price = priceFor(data.distanceKm, data.vehicleType, vMap);
    if (price !== data.priceEgp) onChange({ ...data, priceEgp: price });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.vehicleType, data.distanceKm]);

  const set = useCallback(
    <K extends keyof TripData>(key: K, val: TripData[K]) => {
      onChange({ ...data, [key]: val });
    },
    [data, onChange],
  );

  function handleCurrentLocation(field: "pickup" | "dropoff") {
    if (!navigator.geolocation) return;
    setLocating(field);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const lat = coords.latitude;
        const lng = coords.longitude;
        let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
          if (res.ok) {
            const result = await res.json();
            if (result.address) address = result.address;
          }
        } catch {}
        onChange({ ...data, [field]: { address, lat, lng } });
        setLocating(null);
      },
      () => setLocating(null),
      { timeout: 8000 },
    );
  }

  // Pickup window end = start + 10 min margin
  const pickupWindowEnd = data.pickupTime
    ? toHHMM(toMinutes(data.pickupTime) + 10)
    : "";

  // Arrival time constraint check
  const arrivalTooEarly = !!(
    data.arrivalTime &&
    minArrivalTime &&
    toMinutes(data.arrivalTime) <= toMinutes(minArrivalTime)
  );

  // After pickupWindowEnd line
  const locationError: string | null = (() => {
    if (!data.pickup || !data.dropoff) return null;
    if (
      data.pickup.lat === data.dropoff.lat &&
      data.pickup.lng === data.dropoff.lng
    )
      return "Pickup and dropoff cannot be the same location.";
    // Use actual route distance once known; straight-line only as a pre-route fallback
    const dist =
      data.distanceKm ??
      haversineKm(
        data.pickup.lat,
        data.pickup.lng,
        data.dropoff.lat,
        data.dropoff.lng,
      );
    if (dist < 0.5)
      return "Minimum distance is 500 m — choose locations farther apart.";
    return null;
  })();

  // Extra-passenger detour: combined route (private vehicles) must not exceed 25% of base distance
  const detourExceeded =
    !isSharedVehicle(data.vehicleType) &&
    data.passengerDetourKm != null &&
    data.baseDistanceKm != null &&
    data.passengerDetourKm > data.baseDistanceKm * 1.25;

  function updatePassenger(id: string, patch: Partial<PassengerDetail>) {
    onChange({
      ...data,
      passengers: (data.passengers ?? []).map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    });
  }

  function updateStop(id: string, patch: Partial<StopPoint>) {
    if (patch.point) setStopError("");
    onChange({
      ...data,
      stops: data.stops.map((stop) =>
        stop.id === id ? { ...stop, ...patch } : stop,
      ),
    });
  }

  function updateNumberOfPassengers(numberOfPassengers: number) {
    setStopError("");
    onChange({
      ...data,
      numberOfPassengers,
      stops: data.stops.map((stop) => ({
        ...stop,
        alighting: 0,
        boarding: 0,
      })),
    });
  }

  function addStopPoint() {
    if (data.stops.some((stop) => !stop.point)) {
      setStopError("Enter stop address location for the active stop first.");
      return;
    }
    setStopError("");
    set("stops", [
      ...data.stops,
      {
        id: Math.random().toString(36).slice(2, 9),
        point: null,
        alighting: 0,
        boarding: 0,
        waitingMinutes: 0,
      },
    ]);
  }

  function selectStation(field: "pickup" | "dropoff", stationId: number) {
    const options =
      field === "pickup"
        ? data.pickupStationOptions
        : data.dropoffStationOptions;
    const station = options.find((option) => option.id === stationId);
    if (!station) return;

    const selectedStation = {
      id: station.id,
      lat: station.lat,
      lng: station.lng,
      name: station.name,
      direction: station.direction,
      stationType: station.stationType,
    };
    onChange({
      ...data,
      pickupStation: field === "pickup" ? selectedStation : data.pickupStation,
      dropoffStation:
        field === "dropoff" ? selectedStation : data.dropoffStation,
      distanceKm: null,
      durationMinutes: null,
      priceEgp: null,
      pickupTime: "",
      routeCoordinates: null,
      routeLegs: [],
      baseDistanceKm: null,
      passengerDetourKm: null,
    });
  }

  const isPrivate = !!data.vehicleType && !isSharedVehicle(data.vehicleType);
  const displayedPrice = isPrivate
    ? data.priceEgp
    : data.priceEgp == null
      ? null
      : finalPrice(data.priceEgp, data.extraPassengers ?? 0, data.vehicleType);

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 16,
        border: "1.5px solid #eef0f3",
        boxShadow: "0 2px 8px rgba(11,30,61,0.04)",
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: "1px solid #eef0f3",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          background: "#fafbfc",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, color: "#0B1E3D" }}>
          Trip {index + 1}
        </span>

        {/* Return trip checkbox — only for trips after the first */}
        {index > 0 && sourceTripData && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: data.returnTrip ? "#00897B" : "#5A6A7A",
              background: data.returnTrip ? "rgba(0,194,168,0.08)" : "#f0f4f8",
              border: `1.5px solid ${data.returnTrip ? "#00C2A8" : "#e8edf0"}`,
              borderRadius: 8,
              padding: "5px 10px",
              transition: "all 0.15s",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={!!data.returnTrip}
              onChange={(e) => handleReturnToggle(e.target.checked)}
              style={{
                width: 14,
                height: 14,
                accentColor: "#00C2A8",
                cursor: "pointer",
              }}
            />
            <RotateCcw size={12} aria-hidden="true" />
            Return trip
          </label>
        )}

        {displayedPrice != null && (
          <span
            className="price-pop"
            style={{
              fontWeight: 800,
              fontSize: 15,
              color: "#00C2A8",
              fontVariantNumeric: "tabular-nums",
              marginLeft: "auto",
            }}
          >
            {displayedPrice} EGP
          </span>
        )}
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove trip ${index + 1}`}
            style={{
              background: "rgba(231,76,60,0.08)",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              color: "#e74c3c",
              padding: "6px 8px",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              minHeight: 36,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(231,76,60,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(231,76,60,0.08)";
            }}
          >
            <X size={14} /> Remove
          </button>
        )}
      </div>

      {/* Form fields */}
      <div
        style={{
          padding: "18px 18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Vehicle type */}
        <div>
          <label htmlFor={`vehicle-${data.id}`} style={labelStyle}>
            Vehicle type{" "}
            <span aria-hidden="true" style={{ color: "#e74c3c" }}>
              *
            </span>
          </label>
          <select
            id={`vehicle-${data.id}`}
            value={data.vehicleType}
            onChange={(e) => {
              const newVehicle = e.target.value as VehicleKey | "";
              if (!newVehicle) {
                onChange({ ...data, vehicleType: "" });
                return;
              }
              const newMax = maxExtraPassengers(newVehicle);
              const clampedPassengers = Math.min(
                data.extraPassengers ?? 0,
                newMax,
              );
              // Sync passengers array AFTER extraPassengers is clamped — trim to
              // the new count; shared vehicles force everyone back to "same as main".
              const isPrivate = !isSharedVehicle(newVehicle);
              const syncedPassengers = Array.from(
                { length: clampedPassengers },
                (_, i) => {
                  const existing = (data.passengers ?? [])[i];
                  if (!isPrivate) {
                    return {
                      id:
                        existing?.id ?? Math.random().toString(36).slice(2, 9),
                      sameAsMain: true,
                      pickup: null,
                      dropoff: null,
                    };
                  }
                  return (
                    existing ?? {
                      id: Math.random().toString(36).slice(2, 9),
                      sameAsMain: true,
                      pickup: null,
                      dropoff: null,
                    }
                  );
                },
              );
              const newPickupTime =
                data.arrivalTime && data.durationMinutes
                  ? computePickupTime(
                      data.arrivalTime,
                      data.durationMinutes,
                      newVehicle,
                      vMap,
                    )
                  : data.pickupTime;
              onChange({
                ...data,
                vehicleType: newVehicle,
                extraPassengers: isPrivate ? 0 : clampedPassengers,
                numberOfPassengers: isPrivate
                  ? Math.min(
                      Math.max(1, data.numberOfPassengers),
                      vMap[newVehicle].occupancy,
                    )
                  : 1,
                stops: isPrivate ? data.stops : [],
                passengers: isPrivate ? [] : syncedPassengers,
                pickupTime: newPickupTime,
              });
            }}
            style={{
              width: "100%",
              height: 52,
              padding: "0 14px",
              borderRadius: 12,
              border: "1.5px solid #e8edf0",
              background: "#f8f9fa",
              fontSize: 15,
              fontFamily: "inherit",
              color: "#0B1E3D",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235A6A7A' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 14px center",
              paddingRight: 40,
              cursor: "pointer",
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#00C2A8";
              e.currentTarget.style.boxShadow =
                "0 0 0 3px rgba(0,194,168,0.12)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#e8edf0";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <option value="" disabled>
              Select type to continue
            </option>
            {vList.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {/* Everything below is exclusive to shared rides for now — private ride
            form structure lands in a follow-up phase. */}
        {isSharedVehicle(data.vehicleType) && (
          <>
            {/* Pickup */}
            <div>
              <label style={labelStyle}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Navigation
                    size={13}
                    style={{ color: "#0B1E3D" }}
                    aria-hidden="true"
                  />
                  Pickup location{" "}
                  <span aria-hidden="true" style={{ color: "#e74c3c" }}>
                    *
                  </span>
                </span>
              </label>
              <AddressInput
                id={`pickup-${data.id}`}
                placeholder="Enter pickup address"
                value={data.pickup}
                onChange={(p) => set("pickup", p)}
                iconColor="#0B1E3D"
                savedAddresses={savedAddresses}
              />
              <div className="flex flex-row gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => handleCurrentLocation("pickup")}
                  disabled={locating === "pickup"}
                  style={pickBtnStyle(false)}
                >
                  {locating === "pickup" ? (
                    <Loader2 size={13} className="spin" aria-hidden="true" />
                  ) : (
                    <Navigation size={13} aria-hidden="true" />
                  )}
                  Use my current location
                </button>
                {data.pickup &&
                  !isAlreadySaved(data.pickup, savedAddresses) && (
                    <SaveAddressButton
                      point={data.pickup}
                      onSaved={(s) => onAddressSaved?.(s)}
                    />
                  )}
                {onPickFromMap && (
                  <button
                    type="button"
                    onClick={() => onPickFromMap("pickup")}
                    style={pickBtnStyle(picking === "pickup")}
                  >
                    <MapPin size={13} aria-hidden="true" />
                    {picking === "pickup" ? "Click the map…" : "Pick from map"}
                  </button>
                )}
              </div>

              {isSharedVehicle(data.vehicleType) &&
                data.pickup &&
                data.pickupStation && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 6,
                      fontSize: 12,
                      color: "#7A5000",
                      background: "rgba(245,166,35,0.1)",
                      border: "1px solid rgba(245,166,35,0.35)",
                      borderRadius: 8,
                      padding: "5px 10px",
                    }}
                  >
                    <span aria-hidden="true">↪</span>
                    <span>
                      Station: <strong>{data.pickupStation.name}</strong>
                      {data.walkingMinToStation != null
                        ? ` (~${data.walkingMinToStation} min walk)`
                        : ""}
                    </span>
                  </div>
                )}
              <StationOptions
                label={`Pickup station for trip ${index + 1}`}
                options={data.pickupStationOptions}
                selectedId={data.pickupStation?.id}
                onSelect={(stationId) => selectStation("pickup", stationId)}
              />
            </div>

            {/* Dropoff */}
            <div>
              <label style={labelStyle}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin
                    size={13}
                    style={{ color: "#00C2A8" }}
                    aria-hidden="true"
                  />
                  Dropoff location{" "}
                  <span aria-hidden="true" style={{ color: "#e74c3c" }}>
                    *
                  </span>
                </span>
              </label>
              <AddressInput
                id={`dropoff-${data.id}`}
                placeholder="Enter dropoff address"
                value={data.dropoff}
                onChange={(p) => set("dropoff", p)}
                iconColor="#00C2A8"
                savedAddresses={savedAddresses}
              />
              <button
                type="button"
                onClick={() => handleCurrentLocation("dropoff")}
                disabled={locating === "dropoff"}
                style={pickBtnStyle(false)}
              >
                {locating === "dropoff" ? (
                  <Loader2 size={13} className="spin" aria-hidden="true" />
                ) : (
                  <Navigation size={13} aria-hidden="true" />
                )}
                Use my current location
              </button>
              {data.dropoff &&
                !isAlreadySaved(data.dropoff, savedAddresses) && (
                  <SaveAddressButton
                    point={data.dropoff}
                    onSaved={(s) => onAddressSaved?.(s)}
                  />
                )}
              {onPickFromMap && (
                <button
                  type="button"
                  onClick={() => onPickFromMap("dropoff")}
                  style={pickBtnStyle(picking === "dropoff")}
                >
                  <MapPin size={13} aria-hidden="true" />
                  {picking === "dropoff" ? "Click the map…" : "Pick from map"}
                </button>
              )}
              {isSharedVehicle(data.vehicleType) &&
                data.dropoff &&
                data.dropoffStation && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 6,
                      fontSize: 12,
                      color: "#7A5000",
                      background: "rgba(245,166,35,0.1)",
                      border: "1px solid rgba(245,166,35,0.35)",
                      borderRadius: 8,
                      padding: "5px 10px",
                    }}
                  >
                    <span aria-hidden="true">↪</span>
                    <span>
                      Station: <strong>{data.dropoffStation.name}</strong>
                      {data.walkingMinFromStation != null
                        ? ` (~${data.walkingMinFromStation} min walk)`
                        : ""}
                    </span>
                  </div>
                )}
              <StationOptions
                label={`Dropoff station for trip ${index + 1}`}
                options={data.dropoffStationOptions}
                selectedId={data.dropoffStation?.id}
                onSelect={(stationId) => selectStation("dropoff", stationId)}
              />
              {locationError && (
                <div
                  role="alert"
                  style={{
                    fontSize: 13,
                    color: "#e74c3c",
                    background: "rgba(231,76,60,0.07)",
                    border: "1px solid rgba(231,76,60,0.2)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    marginTop: 6,
                  }}
                >
                  ⚠ {locationError}
                </div>
              )}
            </div>

            {/* Route info pill */}
            {routeLoading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "#5A6A7A",
                }}
              >
                <Loader2 size={14} className="spin" aria-hidden="true" />
                Calculating route…
              </div>
            )}
            {!routeLoading && data.distanceKm && data.durationMinutes && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  background: "#eff7f6",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#0B1E3D",
                  fontWeight: 500,
                }}
              >
                <Info
                  size={14}
                  style={{ color: "#00C2A8", flexShrink: 0 }}
                  aria-hidden="true"
                />
                <span>
                  <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                    {data.distanceKm} km
                  </strong>
                  {" · "}
                  <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                    {data.durationMinutes} min
                  </strong>
                  {" drive"}
                </span>
              </div>
            )}

            {/* Arrival time */}
            <div>
              <label htmlFor={`arrival-${data.id}`} style={labelStyle}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Clock
                    size={13}
                    style={{ color: "#F5A623" }}
                    aria-hidden="true"
                  />
                  Arrival time{" "}
                  <span aria-hidden="true" style={{ color: "#e74c3c" }}>
                    *
                  </span>
                </span>
              </label>
              <input
                id={`arrival-${data.id}`}
                type="time"
                value={data.arrivalTime}
                min={minArrivalTime ?? undefined}
                onChange={(e) => set("arrivalTime", e.target.value)}
                required
                style={{
                  width: "100%",
                  height: 52,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: `1.5px solid ${arrivalTooEarly ? "#e74c3c" : "#e8edf0"}`,
                  background: "#f8f9fa",
                  fontSize: 15,
                  fontFamily: "inherit",
                  color: "#0B1E3D",
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = arrivalTooEarly
                    ? "#e74c3c"
                    : "#00C2A8";
                  e.currentTarget.style.boxShadow = arrivalTooEarly
                    ? "0 0 0 3px rgba(231,76,60,0.12)"
                    : "0 0 0 3px rgba(0,194,168,0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = arrivalTooEarly
                    ? "#e74c3c"
                    : "#e8edf0";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {arrivalTooEarly && minArrivalTime ? (
                <p
                  role="alert"
                  style={{
                    fontSize: 12,
                    color: "#e74c3c",
                    margin: "5px 0 0",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  ⚠ Must be after <strong>{to12h(minArrivalTime)}</strong> —
                  when the previous trip ends.
                </p>
              ) : (
                <p
                  style={{ fontSize: 12, color: "#5A6A7A", margin: "5px 0 0" }}
                >
                  When do you need to arrive at your destination?
                </p>
              )}
            </div>

            {/* Pickup time — readonly window: arrival − duration − vehicle margin, ±10min */}
            <div>
              <label
                style={{
                  ...labelStyle,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Clock
                  size={13}
                  style={{ color: "#00C2A8" }}
                  aria-hidden="true"
                />
                {isSharedVehicle(data.vehicleType)
                  ? "Board station by"
                  : "Pickup time"}
                <span
                  title={
                    isSharedVehicle(data.vehicleType)
                      ? "Time to be at the pickup station. Computed from arrival − walk from dropoff station − ride − buffer."
                      : "Computed from arrival − drive − buffer. You can depart earlier."
                  }
                  style={{ cursor: "help", color: "#5A6A7A" }}
                >
                  <Info size={12} aria-hidden="true" />
                </span>
              </label>
              {data.pickupTime ? (
                <div
                  style={readonlyStyle}
                  aria-label="Pickup time window"
                  role="status"
                >
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#0B1E3D",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {/* {to12h(data.pickupTime)} ~ {to12h(pickupWindowEnd)} */}
                    {to12h(data.pickupTime)}
                  </span>
                </div>
              ) : (
                <div
                  style={readonlyStyle}
                  aria-label="Computed pickup time"
                  role="status"
                >
                  <span style={{ fontSize: 14, color: "#9aa5b4" }}>
                    {!data.pickup || !data.dropoff
                      ? "Set pickup + dropoff first"
                      : !data.arrivalTime
                        ? "Set arrival time above"
                        : "Calculating…"}
                  </span>
                </div>
              )}
              {/* {isSharedVehicle(data.vehicleType) &&
                data.pickupTime &&
                data.walkingMinToStation != null &&
                data.walkingMinToStation > 0 && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "#7A5000",
                      margin: "5px 0 0",
                    }}
                  >
                    Leave home by{" "}
                    <strong>
                      {to12h(
                        toHHMM(
                          toMinutes(data.pickupTime) - data.walkingMinToStation,
                        ),
                      )}
                    </strong>{" "}
                    (~{data.walkingMinToStation} min walk to station)
                  </p>
                )} */}
            </div>

            {/* Extra passengers */}
            <div>
              <label style={labelStyle}>Extra passengers</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    const nextPassengers = (data.passengers ?? []).slice(0, -1);
                    onChange({
                      ...data,
                      extraPassengers: nextPassengers.length,
                      passengers: nextPassengers,
                    });
                  }}
                  disabled={(data.extraPassengers ?? 0) <= 0}
                  aria-label="Decrease passengers"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    border: "1.5px solid #e8edf0",
                    background: "#f8f9fa",
                    cursor:
                      (data.extraPassengers ?? 0) <= 0
                        ? "not-allowed"
                        : "pointer",
                    fontSize: 20,
                    color: "#0B1E3D",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  −
                </button>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#0B1E3D",
                    minWidth: 24,
                    textAlign: "center",
                  }}
                >
                  {data.extraPassengers ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      (data.extraPassengers ?? 0) >=
                      maxExtraPassengers(data.vehicleType)
                    )
                      return;
                    const nextPassengers = [
                      ...(data.passengers ?? []),
                      {
                        id: Math.random().toString(36).slice(2, 9),
                        sameAsMain: true,
                        pickup: null,
                        dropoff: null,
                      },
                    ];
                    onChange({
                      ...data,
                      extraPassengers: nextPassengers.length,
                      passengers: nextPassengers,
                    });
                  }}
                  disabled={
                    (data.extraPassengers ?? 0) >=
                    maxExtraPassengers(data.vehicleType)
                  }
                  aria-label="Increase passengers"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    border: "1.5px solid #e8edf0",
                    background: "#f8f9fa",
                    cursor:
                      (data.extraPassengers ?? 0) >=
                      maxExtraPassengers(data.vehicleType)
                        ? "not-allowed"
                        : "pointer",
                    fontSize: 20,
                    color: "#0B1E3D",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  +
                </button>
                <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                  (you + {data.extraPassengers ?? 0} passenger
                  {(data.extraPassengers ?? 0) !== 1 ? "s" : ""})
                </span>
              </div>

              {/* Per-passenger pickup/dropoff choice — private vehicles only */}
              {!isSharedVehicle(data.vehicleType) &&
                (data.passengers ?? []).map((p, idx) => (
                  <div
                    key={p.id}
                    style={{
                      marginTop: 10,
                      padding: "10px 12px",
                      background: "#f8f9fa",
                      borderRadius: 10,
                      border: "1.5px solid #e8edf0",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#0B1E3D",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Passenger {idx + 1}
                    </span>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <button
                        type="button"
                        onClick={() =>
                          updatePassenger(p.id, {
                            sameAsMain: true,
                            pickup: null,
                            dropoff: null,
                          })
                        }
                        style={pickBtnStyle(p.sameAsMain)}
                      >
                        Same as main
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updatePassenger(p.id, { sameAsMain: false })
                        }
                        style={pickBtnStyle(!p.sameAsMain)}
                      >
                        Different points
                      </button>
                    </div>
                    {!p.sameAsMain && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <div>
                          <AddressInput
                            id={`pax-${p.id}-pickup`}
                            placeholder="Passenger pickup address"
                            value={p.pickup}
                            onChange={(pt) =>
                              updatePassenger(p.id, { pickup: pt })
                            }
                            iconColor="#0B1E3D"
                            savedAddresses={savedAddresses}
                          />
                          {data.pickup && (
                            <button
                              type="button"
                              onClick={() =>
                                updatePassenger(p.id, { pickup: data.pickup })
                              }
                              style={{
                                marginTop: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                fontFamily: "inherit",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#0B1E3D",
                                padding: 0,
                              }}
                            >
                              Use main pickup location
                            </button>
                          )}
                        </div>
                        <div>
                          <AddressInput
                            id={`pax-${p.id}-dropoff`}
                            placeholder="Passenger dropoff address"
                            value={p.dropoff}
                            onChange={(pt) =>
                              updatePassenger(p.id, { dropoff: pt })
                            }
                            iconColor="#00C2A8"
                            savedAddresses={savedAddresses}
                          />
                          {data.dropoff && (
                            <button
                              type="button"
                              onClick={() =>
                                updatePassenger(p.id, { dropoff: data.dropoff })
                              }
                              style={{
                                marginTop: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                fontFamily: "inherit",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#00897B",
                                padding: 0,
                              }}
                            >
                              Use main dropoff location
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

              {detourExceeded && (
                <div
                  role="alert"
                  style={{
                    fontSize: 13,
                    color: "#e74c3c",
                    background: "rgba(231,76,60,0.07)",
                    border: "1px solid rgba(231,76,60,0.2)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    marginTop: 10,
                  }}
                >
                  ⚠ Passenger detour exceeds 25% of the base route — adjust
                  points.
                </div>
              )}
            </div>
          </>
        )}

        {isPrivate && (
          <>
            <div>
              <label style={labelStyle}>Number of passengers</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  onClick={() =>
                    updateNumberOfPassengers(
                      Math.max(1, data.numberOfPassengers - 1),
                    )
                  }
                  disabled={data.numberOfPassengers <= 1}
                  aria-label="Decrease passengers"
                  style={counterButtonStyle(data.numberOfPassengers <= 1)}
                >
                  −
                </button>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#0B1E3D",
                    minWidth: 24,
                    textAlign: "center",
                  }}
                >
                  {data.numberOfPassengers}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateNumberOfPassengers(
                      Math.min(
                        vMap[data.vehicleType as VehicleKey].occupancy,
                        data.numberOfPassengers + 1,
                      ),
                    )
                  }
                  disabled={
                    data.numberOfPassengers >=
                    vMap[data.vehicleType as VehicleKey].occupancy
                  }
                  aria-label="Increase passengers"
                  style={counterButtonStyle(
                    data.numberOfPassengers >=
                      vMap[data.vehicleType as VehicleKey].occupancy,
                  )}
                >
                  +
                </button>
                <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                  Up to {vMap[data.vehicleType as VehicleKey].occupancy}{" "}
                  including you
                </span>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Pickup location *</label>
              <AddressInput
                id={`pickup-${data.id}`}
                placeholder="Enter pickup address"
                value={data.pickup}
                onChange={(point) => set("pickup", point)}
                iconColor="#0B1E3D"
                savedAddresses={savedAddresses}
              />
              <button
                type="button"
                onClick={() => handleCurrentLocation("pickup")}
                disabled={locating === "pickup"}
                style={pickBtnStyle(false)}
              >
                {locating === "pickup" ? (
                  <Loader2 size={13} className="spin" aria-hidden="true" />
                ) : (
                  <Navigation size={13} aria-hidden="true" />
                )}
                Use my current location
              </button>
              {data.pickup && !isAlreadySaved(data.pickup, savedAddresses) && (
                <SaveAddressButton
                  point={data.pickup}
                  onSaved={(saved) => onAddressSaved?.(saved)}
                />
              )}
              {onPickFromMap && (
                <button
                  type="button"
                  onClick={() => onPickFromMap("pickup")}
                  style={pickBtnStyle(picking === "pickup")}
                >
                  <MapPin size={13} aria-hidden="true" />
                  {picking === "pickup" ? "Click the map…" : "Pick from map"}
                </button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.stops.map((stop, stopIndex) => {
                const onboardBefore = data.stops
                  .slice(0, stopIndex)
                  .reduce(
                    (count, previous) =>
                      count - previous.alighting + previous.boarding,
                    data.numberOfPassengers,
                  );
                const maxAlighting = Math.max(0, onboardBefore - 1);
                const maxBoarding = Math.max(
                  0,
                  vMap[data.vehicleType as VehicleKey].occupancy -
                    (onboardBefore - stop.alighting),
                );
                return (
                  <div
                    key={stop.id}
                    style={{
                      padding: 12,
                      background: "#f8f9fa",
                      border: "1.5px solid #e8edf0",
                      borderRadius: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <strong style={{ fontSize: 13, color: "#0B1E3D" }}>
                        Stop {stopIndex + 1}
                      </strong>
                      <button
                        type="button"
                        onClick={() =>
                          set(
                            "stops",
                            data.stops.filter((item) => item.id !== stop.id),
                          )
                        }
                        aria-label={`Remove stop ${stopIndex + 1}`}
                        style={{
                          border: "none",
                          background: "none",
                          color: "#e74c3c",
                          cursor: "pointer",
                          padding: 4,
                        }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <AddressInput
                      id={`stop-${data.id}-${stop.id}`}
                      placeholder="Enter stop address"
                      value={stop.point}
                      onChange={(point) => updateStop(stop.id, { point })}
                      iconColor="#F5A623"
                      savedAddresses={savedAddresses}
                    />
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                        marginTop: 10,
                      }}
                    >
                      <CounterField
                        label="Alighting"
                        value={stop.alighting}
                        max={maxAlighting}
                        onChange={(alighting) =>
                          updateStop(stop.id, { alighting })
                        }
                      />
                      <CounterField
                        label="Boarding"
                        value={stop.boarding}
                        max={maxBoarding}
                        onChange={(boarding) =>
                          updateStop(stop.id, { boarding })
                        }
                      />
                    </div>
                    <label
                      htmlFor={`wait-${stop.id}`}
                      style={{ ...labelStyle, marginTop: 10 }}
                    >
                      Waiting time (hh:mm)
                    </label>
                    <WaitDurationInput
                      key={`${stop.id}-${stop.waitingMinutes}`}
                      id={`wait-${stop.id}`}
                      minutes={stop.waitingMinutes}
                      onChange={(waitingMinutes) =>
                        updateStop(stop.id, { waitingMinutes })
                      }
                    />
                  </div>
                );
              })}
              {data.stops.length < 4 && (
                <button
                  type="button"
                  onClick={addStopPoint}
                  style={{ ...pickBtnStyle(false), marginTop: 0 }}
                >
                  + Add stop point
                </button>
              )}
              {stopError && (
                <p role="alert" style={{ ...locationErrorStyle, marginTop: 0 }}>
                  {stopError}
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle}>Dropoff location *</label>
              <AddressInput
                id={`dropoff-${data.id}`}
                placeholder="Enter dropoff address"
                value={data.dropoff}
                onChange={(point) => set("dropoff", point)}
                iconColor="#00C2A8"
                savedAddresses={savedAddresses}
              />
              <button
                type="button"
                onClick={() => handleCurrentLocation("dropoff")}
                disabled={locating === "dropoff"}
                style={pickBtnStyle(false)}
              >
                {locating === "dropoff" ? (
                  <Loader2 size={13} className="spin" aria-hidden="true" />
                ) : (
                  <Navigation size={13} aria-hidden="true" />
                )}
                Use my current location
              </button>
              {data.dropoff &&
                !isAlreadySaved(data.dropoff, savedAddresses) && (
                  <SaveAddressButton
                    point={data.dropoff}
                    onSaved={(saved) => onAddressSaved?.(saved)}
                  />
                )}
              {onPickFromMap && (
                <button
                  type="button"
                  onClick={() => onPickFromMap("dropoff")}
                  style={pickBtnStyle(picking === "dropoff")}
                >
                  <MapPin size={13} aria-hidden="true" />
                  {picking === "dropoff" ? "Click the map…" : "Pick from map"}
                </button>
              )}
              {locationError && (
                <div role="alert" style={locationErrorStyle}>
                  ⚠ {locationError}
                </div>
              )}
            </div>

            {routeLoading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "#5A6A7A",
                }}
              >
                <Loader2 size={14} className="spin" aria-hidden="true" />
                Calculating route…
              </div>
            )}
            {!routeLoading && data.distanceKm && data.durationMinutes && (
              <div style={routeInfoStyle}>
                <Info
                  size={14}
                  style={{ color: "#00C2A8", flexShrink: 0 }}
                  aria-hidden="true"
                />
                <span>
                  <strong>{data.distanceKm} km</strong> ·{" "}
                  <strong>{data.durationMinutes} min</strong> drive
                </span>
              </div>
            )}

            <div>
              <label htmlFor={`pickup-time-${data.id}`} style={labelStyle}>
                Pickup time *
              </label>
              <input
                id={`pickup-time-${data.id}`}
                type="time"
                value={data.pickupTime}
                onChange={(event) => set("pickupTime", event.target.value)}
                required
                style={timeInputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Arrival time</label>
              <div style={readonlyStyle} role="status">
                <Clock
                  size={15}
                  style={{ color: "#F5A623" }}
                  aria-hidden="true"
                />
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: data.arrivalTime ? "#0B1E3D" : "#9aa5b4",
                  }}
                >
                  {data.arrivalTime
                    ? to12h(data.arrivalTime)
                    : "Set pickup and route first"}
                </span>
              </div>
              {data.stops.length > 0 && (
                <p
                  style={{ fontSize: 12, color: "#5A6A7A", margin: "5px 0 0" }}
                >
                  Includes{" "}
                  {data.stops.reduce(
                    (total, stop) => total + stop.waitingMinutes,
                    0,
                  )}{" "}
                  min waiting time.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SaveAddressButton({
  point,
  onSaved,
}: {
  point: TripPoint;
  onSaved: (s: SavedAddress) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/auth/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: point.address.split(",")[0].trim(),
          address: point.address,
          lat: point.lat,
          lng: point.lng,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        onSaved(d.savedAddress);
        setDone(true);
      }
    } finally {
      setSaving(false);
    }
  }

  if (done)
    return (
      <span
        style={{
          fontSize: 12,
          color: "#00897B",
          marginTop: 4,
          display: "block",
        }}
      >
        ✓ Saved
      </span>
    );
  return (
    <button
      type="button"
      onClick={save}
      disabled={saving}
      style={{
        marginTop: 5,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "inherit",
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "#5A6A7A",
        padding: 0,
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {saving ? "Saving…" : "＋ Save this location"}
    </button>
  );
}
