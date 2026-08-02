"use client";

import { useState } from "react";
import {
  CalendarDays,
  Users,
  Route,
  Car,
  Clock,
  MapPin,
  Play,
  CheckCircle2,
  Flag,
  LogIn,
  LogOut,
} from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import RouteMap from "@/components/shared/RouteMap";
import VehicleSeatMap from "@/components/trips/VehicleSeatMap";
import { VEHICLES, type VehicleKey } from "@/lib/config/vehicles";
import type { GeoPoint } from "@/types/geo";
import type { RideDetailView, RideStatus } from "@/types/booking";

function to12h(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function prettyDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
  ride,
  email,
}: {
  ride: RideDetailView;
  email: string;
}) {
  const [rideStarted, setRideStarted] = useState(
    ride.status === "active" || ride.status === "completed",
  );
  const [isCompleted, setIsCompleted] = useState(ride.status === "completed");
  const initialConfirmedStationIndex = ride.passengers.reduce((max, passenger) => {
    if (passenger.status === "picked_up") {
      return Math.max(max, passenger.pickupOrder ?? 0);
    }
    if (passenger.status === "dropped_off") {
      return Math.max(max, passenger.dropoffOrder ?? 0);
    }
    return max;
  }, 0);
  const hasConfirmedPassengerEvent = ride.passengers.some(
    (passenger) =>
      passenger.status === "picked_up" || passenger.status === "dropped_off",
  );
  const [activeStationIndex, setActiveStationIndex] = useState<number | null>(
    hasConfirmedPassengerEvent ? initialConfirmedStationIndex + 1 : null,
  );
  const [driverOrigin, setDriverOrigin] = useState<GeoPoint | null>(
    ride.driverOrigin ?? null,
  );
  const [driverDestination, setDriverDestination] = useState<GeoPoint | null>(
    ride.driverDestination ?? null,
  );
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const currentStationIndex = rideStarted ? (activeStationIndex ?? 1) : null;

  const vLabel =
    VEHICLES[ride.vehicleType as VehicleKey]?.label ?? ride.vehicleType;

  // Prepare route stops (only stations)
  let routeStops = ride.route ?? [];
  if (routeStops.length === 0 && ride.passengers.length > 0) {
    routeStops = ride.passengers.flatMap((p) => [
      {
        address: p.pickupStation?.name ?? "Pickup station",
        point: p.pickupStation
          ? { lat: p.pickupStation.lat, lng: p.pickupStation.lng, address: p.pickupStation.name }
          : p.pickup,
        boarding: p.numberOfPassengers || 1,
        alighting: 0,
        waitingMinutes: 0,
      },
      {
        address: p.dropoffStation?.name ?? "Dropoff station",
        point: p.dropoffStation
          ? { lat: p.dropoffStation.lat, lng: p.dropoffStation.lng, address: p.dropoffStation.name }
          : p.dropoff,
        boarding: 0,
        alighting: p.numberOfPassengers || 1,
        waitingMinutes: 0,
      },
    ]);
  }
  const stationCount = routeStops.length;
  const stationPoints = routeStops
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
    type: "station";
    stationIndex: number;
    name: string;
    zone: string;
    landmark?: string;
    boarding: number;
    alighting: number;
    waitingMinutes: number;
  };

  const steps: StepItem[] = routeStops.map((stop, i) => {
    const stationName = (stop as any).name ?? stop.address ?? `Station ${i + 1}`;
    const meta = stationMetaMap.get(stationName);
    return {
      type: "station" as const,
      stationIndex: i + 1,
      name: stationName,
      zone: (stop as any).direction ?? meta?.direction ?? "",
      landmark: (stop as any).landmark ?? meta?.landmark ?? "",
      boarding: stop.boarding || 0,
      alighting: stop.alighting || 0,
      waitingMinutes: stop.waitingMinutes || 0,
    };
  });

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
    setActiveStationIndex(null); // Starting ride does NOT automatically confirm first station boarding
    setLoadingAction(null);
  };

  const handleConfirmStation = async (stationIndex: number, stationName: string) => {
    setLoadingAction(`confirm-${stationIndex}`);
    try {
      const res = await fetch(`/api/actions/ride/${ride.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "station_arrived",
          stationIndex,
          stationName,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to confirm station ${stationIndex}`);
      }

      setActiveStationIndex(
        stationIndex < stationCount ? stationIndex + 1 : stationIndex,
      );
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
    setIsCompleted(true);
    setLoadingAction(null);
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
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
            Ride #{ride.rideNumber} · {prettyDate(ride.date)}
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
                {isCompleted ? "Completed" : rideStarted ? "Ongoing" : "Upcoming"}
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
                {ride.passengerCount} passenger{ride.passengerCount === 1 ? "" : "s"}
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
              {ride.totalCost} EGP
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
                Ready to Start Ride?
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94A3B8" }}>
                All chairs are empty until you press start and log your origin location.
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
              {loadingAction === "start" ? "Starting..." : "Start Ride"}
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
            pickup={stationPoints[0] ?? null}
            dropoff={stationPoints[stationPoints.length - 1] ?? null}
            stations={stationPoints.slice(1, -1)}
            stationIconsOnly
            height={220}
            interactive
          />

          <div style={{ padding: "16px 18px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Detail
                icon={<Route size={15} color="#0B1E3D" />}
                label="Ride type"
                value={ride.rideType === "shared" ? "Shared" : "Private"}
              />
              <Detail
                icon={<Car size={15} color="#0B1E3D" />}
                label="Vehicle"
                value={vLabel}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
              <Clock size={14} color="#5A6A7A" aria-hidden="true" />
              <span style={{ fontSize: 13, color: "#5A6A7A", fontWeight: 500 }}>
                Window{" "}
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
                Route Details
              </p>
              <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                Driver route and station breakdown
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
              {steps.length} Steps
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {steps.map((step, index) => {
              const isLast = index === steps.length - 1;
              const badgeBg = index === 0 ? "#00C2A8" : isLast ? "#0B1E3D" : "#5A6A7A";

              const isActiveStation = activeStationIndex === step.stationIndex;

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
                        left: 13,
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

                  <div style={{ flex: 1, minWidth: 0 }}>
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
                          Station
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

                      {/* Confirm passenger rides button */}
                      {!isCompleted && currentStationIndex === step.stationIndex && (
                        <button
                          type="button"
                          onClick={() => handleConfirmStation(step.stationIndex, step.name)}
                          disabled={loadingAction === `confirm-${step.stationIndex}`}
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
                            cursor: "pointer",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                          }}
                        >
                          <CheckCircle2 size={13} color={isActiveStation ? "#27AE60" : "#00C2A8"} />
                          {isActiveStation
                            ? "Active station"
                            : "Confirm passenger rides"}
                        </button>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        alignItems: "center",
                        marginTop: 8,
                        flexWrap: "wrap",
                      }}
                    >
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
                        Alighting: <strong style={{ color: "#0B1E3D" }}>{step.alighting}</strong>
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
                        Boarding: <strong style={{ color: "#0B1E3D" }}>{step.boarding}</strong>
                      </span>
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
                          Wait: <strong style={{ color: "#0B1E3D" }}>{step.waitingMinutes} min</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {rideStarted && !isCompleted && (
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
              {loadingAction === "close" ? "Closing..." : "Close ride"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
