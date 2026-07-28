"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Eye,
  Car,
  MapPin,
  Flag,
  Clock,
  Route,
  Users,
  Navigation,
} from "lucide-react";
import { useTripStore } from "@/lib/store/useTripStore";
import type { TripPoint } from "@/lib/store/useTripStore";
import AppHeader from "@/components/layout/AppHeader";
import DatePicker from "./DatePicker";
import TripCycle, { type TripData } from "./TripCycle";
import CreateMap from "./CreateMap";
import { earliestBookingDate } from "@/lib/time/bookingDates";
import type { SavedAddress } from "@/types/shared";
import type { Station } from "@/lib/geo/stations";

interface Props {
  userEmail: string;
  onAddressSaved?: (saved: SavedAddress) => void;
}

function makeTripId() {
  return Math.random().toString(36).slice(2, 9);
}

function defaultTrip(
  pickup: TripPoint | null,
  dropoff: TripPoint | null,
): TripData {
  return {
    id: makeTripId(),
    pickup,
    dropoff,
    vehicleType: "",
    arrivalTime: "",
    pickupTime: "",
    distanceKm: null,
    durationMinutes: null,
    priceEgp: null,
    routeCoordinates: null,
    routeLegs: [],
    extraPassengers: 0,
    numberOfPassengers: 1,
    stops: [],
    pickupStation: null,
    dropoffStation: null,
    pickupStationOptions: [],
    dropoffStationOptions: [],
    walkingMinToStation: null,
    walkingMinFromStation: null,
    passengers: [],
    baseDistanceKm: null,
    passengerDetourKm: null,
  };
}

export default function CreateClient({ userEmail }: Props) {
  const { pickup, dropoff } = useTripStore();
  const [mounted, setMounted] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([
    earliestBookingDate(),
  ]);
  const [trips, setTrips] = useState<TripData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [payMethod, setPayMethod] = useState<"card" | "wallet">("card");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [bookingNote, setBookingNote] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [vehiclesMap, setVehiclesMap] = useState<Record<
    string,
    (typeof VEHICLES)[keyof typeof VEHICLES]
  > | null>(null);
  const [picking, setPicking] = useState<{
    tripId: string;
    field: "pickup" | "dropoff";
  } | null>(null);

  // Hydrate from store after mount (avoid SSR mismatch)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setTrips([defaultTrip(pickup, dropoff)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load wallet balance, saved addresses, and transit stations
  useEffect(() => {
    fetch("/api/stations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.stations) setStations(d.stations as Station[]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await fetch("/api/wallet/reconcile", { method: "POST" });
      } catch {
        /* non-fatal */
      }
      try {
        const r = await fetch("/api/wallet", { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          setWalletBalance(d.balanceEgp);
        }
      } catch {
        /* non-fatal */
      }
      try {
        const r = await fetch("/api/auth/addresses", { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          setSavedAddresses(d.savedAddresses ?? []);
        }
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  // Vehicles — DB-hydrated (mobile-parity source of truth); falls back to static config on failure
  useEffect(() => {
    fetch("/api/vehicles", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.vehicles?.length) return;
        const map: Record<string, (typeof VEHICLES)[keyof typeof VEHICLES]> =
          {};
        for (const v of d.vehicles) map[v.key] = v;
        setVehiclesMap(map);
      })
      .catch(() => {});
  }, []);

  const handleMapPick = useCallback(
    (point: TripPoint) => {
      if (!picking) return;
      setTrips((prev) =>
        prev.map((t) =>
          t.id === picking.tripId ? { ...t, [picking.field]: point } : t,
        ),
      );
      setPicking(null);
    },
    [picking],
  );

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError("");
    let navigating = false;
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates: selectedDates,
          note: bookingNote,
          trips: trips.map((t) => ({
            pickup: t.pickup,
            dropoff: t.dropoff,
            vehicleType: t.vehicleType,
            arrivalTime: t.arrivalTime,
            pickupTime: t.pickupTime,
            distanceKm: t.distanceKm,
            durationMinutes: t.durationMinutes,
            extraPassengers: t.extraPassengers,
            passengers: t.passengers,
            numberOfPassengers: t.numberOfPassengers,
            stops: t.stops.map((stop) => ({
              point: stop.point,
              alighting: stop.alighting,
              boarding: stop.boarding,
              waitingMinutes: stop.waitingMinutes,
            })),
            ...(t.pickupStation
              ? {
                  pickupStation: t.pickupStation,
                  dropoffStation: t.dropoffStation,
                  pickupStationOptions: t.pickupStationOptions,
                  dropoffStationOptions: t.dropoffStationOptions,
                  walkingMinToStation: t.walkingMinToStation,
                  walkingMinFromStation: t.walkingMinFromStation,
                }
              : {}),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(
          data.error ?? "Failed to create booking. Please try again.",
        );
        return;
      }

      // ── Wallet payment ──
      if (payMethod === "wallet") {
        const walletRes = await fetch("/api/payments/wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: data.bookingId }),
        });
        const walletData = await walletRes.json();
        if (!walletRes.ok) {
          setSubmitError(
            walletData.error ?? "Wallet payment failed. Please try again.",
          );
          return;
        }
        navigating = true;
        window.location.href = `/checkout/callback?bookingId=${data.bookingId}`;
        return;
      }

      // ── Card payment (Kashier) ──
      const payRes = await fetch("/api/payments/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: data.bookingId }),
      });
      const payData = await payRes.json();
      if (!payRes.ok) {
        setSubmitError(
          payData.error ?? "Failed to initiate payment. Please try again.",
        );
        return;
      }
      navigating = true;
      // Full redirect (not router.push) so the browser leaves the SPA entirely
      window.location.href = payData.sessionUrl;
    } catch {
      setSubmitError("Network error. Please check your connection and retry.");
    } finally {
      if (!navigating) setSubmitting(false);
    }
  }

  const updateTrip = useCallback((id: string, updated: TripData) => {
    setTrips((prev) => {
      const tripIndex = prev.findIndex((t) => t.id === id);

      // Exclusive: only one trip can be a return trip at a time
      if (updated.returnTrip) {
        return prev.map((t) =>
          t.id === id ? updated : { ...t, returnTrip: false },
        );
      }

      // Sync the immediate next trip if it has returnTrip: true
      // and this trip's pickup or dropoff just changed
      const pickupChanged =
        JSON.stringify(updated.pickup) !==
        JSON.stringify(prev[tripIndex]?.pickup);
      const dropoffChanged =
        JSON.stringify(updated.dropoff) !==
        JSON.stringify(prev[tripIndex]?.dropoff);

      if (pickupChanged || dropoffChanged) {
        const nextTrip = prev[tripIndex + 1];
        if (nextTrip?.returnTrip) {
          return prev.map((t, idx) => {
            if (t.id === id) return updated;
            if (idx === tripIndex + 1) {
              return {
                ...t,
                pickup: updated.dropoff,
                dropoff: updated.pickup,
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
                passengers: [],
                numberOfPassengers: 1,
                stops: [],
                baseDistanceKm: null,
                passengerDetourKm: null,
              };
            }
            return t;
          });
        }
      }

      return prev.map((t) => (t.id === id ? updated : t));
    });
  }, []);

  const removeTrip = useCallback((id: string) => {
    setTrips((prev) => prev.filter((t) => t.id !== id));
  }, []);

  function addTrip() {
    setTrips((prev) => [...prev, defaultTrip(null, null)]);
  }

  // Validate all trips before preview
  function validate(): string | null {
    if (selectedDates.length === 0) return "Select at least one date.";
    for (let i = 0; i < trips.length; i++) {
      const t = trips[i];
      if (!t.vehicleType) return `Trip ${i + 1}: vehicle type required.`;
      if (!t.pickup) return `Trip ${i + 1}: pickup location required.`;
      if (!t.dropoff) return `Trip ${i + 1}: dropoff location required.`;
      const vehicle = vehiclesMap?.[t.vehicleType] ?? VEHICLES[t.vehicleType];
      const isPrivate = vehicle.ride === "private";

      if (isPrivate) {
        if (!t.pickupTime) return `Trip ${i + 1}: pickup time required.`;
        if (!t.arrivalTime || !t.distanceKm || !t.durationMinutes)
          return `Trip ${i + 1}: route is still calculating — wait a moment.`;
        if (
          !Number.isInteger(t.numberOfPassengers) ||
          t.numberOfPassengers < 1 ||
          t.numberOfPassengers > vehicle.occupancy
        )
          return `Trip ${i + 1}: passenger count must be between 1 and ${vehicle.occupancy}.`;
        if (t.stops.length > 4)
          return `Trip ${i + 1}: no more than 4 stop points allowed.`;

        let onboard = t.numberOfPassengers;
        for (let stopIndex = 0; stopIndex < t.stops.length; stopIndex++) {
          const stop = t.stops[stopIndex];
          if (!stop.point)
            return `Trip ${i + 1}, stop ${stopIndex + 1}: location required.`;
          if (
            !Number.isInteger(stop.alighting) ||
            !Number.isInteger(stop.boarding) ||
            !Number.isFinite(stop.waitingMinutes) ||
            stop.alighting < 0 ||
            stop.boarding < 0 ||
            stop.waitingMinutes < 0
          )
            return `Trip ${i + 1}, stop ${stopIndex + 1}: invalid stop details.`;
          if (stop.alighting > onboard - 1)
            return `Trip ${i + 1}, stop ${stopIndex + 1}: at least one passenger must continue.`;
          const afterAlighting = onboard - stop.alighting;
          if (stop.boarding > vehicle.occupancy - afterAlighting)
            return `Trip ${i + 1}, stop ${stopIndex + 1}: vehicle occupancy exceeded.`;
          onboard = afterAlighting + stop.boarding;
        }
      } else {
        if (!t.arrivalTime) return `Trip ${i + 1}: arrival time required.`;
        if (!t.pickupTime)
          return `Trip ${i + 1}: pickup time not yet computed — wait a moment.`;
      }
      if (
        t.passengerDetourKm != null &&
        t.baseDistanceKm != null &&
        t.passengerDetourKm > t.baseDistanceKm * 1.25
      )
        return `Trip ${i + 1}: passenger detour exceeds 25% of the base route — adjust points.`;
      // Time ordering: each trip must arrive after the previous trip
      if (i > 0) {
        const prev = trips[i - 1];
        if (
          prev.arrivalTime &&
          toMinutes(t.arrivalTime) <= toMinutes(prev.arrivalTime)
        ) {
          return `Trip ${i + 1}: arrival time must be after trip ${i} ends (${to12h(prev.arrivalTime)}).`;
        }
      }
    }
    return null;
  }

  const [validationError, setValidationError] = useState("");

  function handlePreview() {
    const err = validate();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError("");
    setAgreedTerms(false);
    setShowPreview(true);
  }

  const totalEgp = trips.reduce((sum, t) => {
    const isPrivate =
      t.vehicleType !== "" &&
      (vehiclesMap?.[t.vehicleType] ?? VEHICLES[t.vehicleType]).ride ===
        "private";
    return (
      sum +
      (isPrivate
        ? (t.priceEgp ?? 0)
        : finalPrice(t.priceEgp ?? 0, t.extraPassengers ?? 0, t.vehicleType))
    );
  }, 0);
  const grandTotalEgp = totalEgp * Math.max(1, selectedDates.length);

  if (!mounted) {
    return (
      <div
        style={{
          height: "100dvh",
          overflow: "hidden",
          background: "#f8f9fa",
          display: "flex",
          flexDirection: "column",
          // alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "#5A6A7A", fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "#f8f9fa",
      }}
    >
      {/* Top nav bar */}
      <AppHeader authed email={userEmail} variant="app" />

      {/* Main split layout */}
      <div
        style={{ flex: 1, display: "flex", overflow: "hidden" }}
        className="create-layout"
      >
        {/* ── Left: form panel ── */}
        <aside
          style={{
            width: 520,
            flexShrink: 0,
            background: "#ffffff",
            borderRight: "1px solid #eef0f3",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            margin: "40px 0 40px 40px",
            border: "1px solid #ccc",
            borderRadius: 15,
          }}
          className="create-left"
        >
          <div
            style={{
              padding: "32px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#0B1E3D",
                  margin: "0 0 4px",
                  letterSpacing: "-0.02em",
                }}
              >
                Book a ride
              </h1>
              <p style={{ fontSize: 13, color: "#5A6A7A", margin: 0 }}>
                Fill in the details for each trip on your chosen date.
              </p>
            </div>

            <DatePicker value={selectedDates} onChange={setSelectedDates} />

            {/* Trip cycles */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {trips.map((trip, i) => {
                // Minimum arrival time = prev trip's arrival + this trip's drive + buffer
                let minArrivalTime: string | null = null;
                if (i > 0) {
                  const prev = trips[i - 1];
                  if (prev.arrivalTime) {
                    const prevMins = toMinutes(prev.arrivalTime);
                    if (trip.durationMinutes && trip.vehicleType) {
                      const vWindow = VEHICLES[trip.vehicleType].window;
                      minArrivalTime = toHHMM(
                        prevMins + trip.durationMinutes + vWindow,
                      );
                    } else {
                      minArrivalTime = toHHMM(prevMins + 1);
                    }
                  }
                }
                // Return trip source = immediately preceding trip.
                // Hide checkbox if prev trip is itself a return trip.
                const prevTrip = i > 0 ? trips[i - 1] : null;
                const canBeReturn =
                  !!prevTrip &&
                  !prevTrip.returnTrip &&
                  !!(prevTrip.pickup && prevTrip.dropoff);
                return (
                  <TripCycle
                    key={trip.id}
                    data={trip}
                    index={i}
                    canRemove={trips.length > 1}
                    onChange={(updated) => updateTrip(trip.id, updated)}
                    onRemove={() => removeTrip(trip.id)}
                    picking={picking?.tripId === trip.id ? picking.field : null}
                    onPickFromMap={(field) =>
                      setPicking({ tripId: trip.id, field })
                    }
                    sourceTripData={canBeReturn ? prevTrip : null}
                    savedAddresses={savedAddresses}
                    onAddressSaved={(s) =>
                      setSavedAddresses((prev) => [...prev, s])
                    }
                    stations={stations}
                    minArrivalTime={minArrivalTime}
                    vehiclesMap={vehiclesMap ?? undefined}
                    vehicleList={
                      vehiclesMap ? Object.values(vehiclesMap) : undefined
                    }
                  />
                );
              })}
            </div>

            {/* Add trip */}
            {trips.length < 3 && (
              <button
                type="button"
                onClick={addTrip}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  width: "100%",
                  height: 48,
                  background: "transparent",
                  border: "2px dashed #d0d8e0",
                  borderRadius: 12,
                  cursor: "pointer",
                  color: "#5A6A7A",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#00C2A8";
                  e.currentTarget.style.color = "#00C2A8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#d0d8e0";
                  e.currentTarget.style.color = "#5A6A7A";
                }}
              >
                <Plus size={16} aria-hidden="true" />
                Add another trip
              </button>
            )}

            {/* Validation error */}
            {validationError && (
              <p
                role="alert"
                aria-live="assertive"
                style={{
                  fontSize: 13,
                  color: "#e74c3c",
                  background: "rgba(231,76,60,0.07)",
                  border: "1px solid rgba(231,76,60,0.2)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  margin: 0,
                }}
              >
                {validationError}
              </p>
            )}

            {/* Preview CTA */}
            <div
              style={{
                background: "#ffffff",
                borderTop: "1px solid #eef0f3",
                borderRadius: 12,
                position: "sticky",
                bottom: 0,
                paddingTop: 12,
                paddingBottom: 8,
                marginTop: -4,
              }}
            >
              {totalEgp > 0 && (
                <p
                  style={{
                    textAlign: "center",
                    fontSize: 13,
                    color: "#5A6A7A",
                    margin: "0 0 10px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  Estimated total:{" "}
                  <strong
                    style={{ color: "#00C2A8", fontSize: 15, fontWeight: 800 }}
                  >
                    {grandTotalEgp} EGP
                  </strong>
                  {
                    selectedDates.length > 1
                    // && ` × ${selectedDates.length} days`
                  }
                </p>
              )}
              <button
                type="button"
                onClick={handlePreview}
                style={{
                  width: "100%",
                  height: 52,
                  background: "#0B1E3D",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 15,
                  border: "none",
                  borderRadius: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontFamily: "inherit",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#00C2A8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#0B1E3D";
                }}
              >
                <Eye size={17} aria-hidden="true" />
                Preview booking
              </button>
            </div>
          </div>
        </aside>

        {/* ── Right: map placeholder (Phase 4 will fill this) ── */}
        <main
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            margin: 40,
            borderRadius: 15,
          }}
          aria-label="Map area"
          className="create-right"
        >
          <CreateMap
            trips={trips}
            picking={picking}
            onMapPick={handleMapPick}
            onCancelPick={() => setPicking(null)}
          />
        </main>
      </div>

      {/* ── Preview modal ── */}
      {showPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Booking preview"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(11,30,61,0.55)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "0 0 0 0",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPreview(false);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 520,
              maxHeight: "85dvh",
              overflowY: "auto",
              padding: "0 0 24px",
            }}
          >
            {/* Handle */}
            <div
              style={{
                padding: "16px 24px 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#0B1E3D",
                  margin: 0,
                }}
              >
                Booking summary
              </h2>
              <button
                onClick={() => setShowPreview(false)}
                aria-label="Close preview"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#5A6A7A",
                  padding: 4,
                  minWidth: 36,
                  minHeight: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "8px 24px 0" }}>
              <p style={{ fontSize: 13, color: "#5A6A7A", margin: "0 0 16px" }}>
                Date{selectedDates.length > 1 ? "s" : ""}:{" "}
                <strong style={{ color: "#0B1E3D" }}>
                  {selectedDates.join(", ")}
                </strong>
                {selectedDates.length > 1 &&
                  ` (× ${selectedDates.length} days)`}
              </p>

              {trips.map((t, i) => {
                const isPrivate =
                  t.vehicleType !== "" &&
                  (vehiclesMap?.[t.vehicleType] ?? VEHICLES[t.vehicleType])
                    .ride === "private";
                const routePoints = [
                  {
                    label: "Pickup location",
                    point: t.pickup,
                    icon: Navigation,
                  },
                  ...t.stops.map((stop, stopIndex) => ({
                    label: `Stop ${stopIndex + 1}`,
                    point: stop.point,
                    icon: MapPin,
                  })),
                  { label: "Dropoff location", point: t.dropoff, icon: Flag },
                ];
                return (
                  <div
                    key={t.id}
                    style={{
                      padding: "14px 16px",
                      background: "#f8f9fa",
                      borderRadius: 12,
                      marginBottom: 10,
                      border: "1px solid #eef0f3",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: "#0B1E3D",
                        }}
                      >
                        Trip {i + 1}
                      </span>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: 15,
                          color: "#00C2A8",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {t.vehicleType !== "" &&
                        (
                          vehiclesMap?.[t.vehicleType] ??
                          VEHICLES[t.vehicleType]
                        ).ride === "private"
                          ? (t.priceEgp ?? 0)
                          : finalPrice(
                              t.priceEgp ?? 0,
                              t.extraPassengers ?? 0,
                              t.vehicleType,
                            )}{" "}
                        EGP
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#5A6A7A",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {isPrivate ? (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Users size={15} color="#0B1E3D" />
                          <strong style={{ color: "#0B1E3D", fontWeight: 600 }}>
                            {t.numberOfPassengers} passenger
                            {t.numberOfPassengers === 1 ? "" : "s"}
                          </strong>
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Users size={15} color="#0B1E3D" />
                          <strong style={{ color: "#0B1E3D", fontWeight: 600 }}>
                            {t.extraPassengers} Extra passenger
                            {t.extraPassengers === 1 ? "" : "s"}
                          </strong>
                        </span>
                      )}
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Car
                          size={15}
                          color="#0B1E3D"
                          aria-hidden="true"
                          style={{ flexShrink: 0 }}
                        />
                        <strong style={{ color: "#0B1E3D", fontWeight: 600 }}>
                          {VEHICLE_LIST_LABEL(t.vehicleType)}
                        </strong>
                      </span>
                      {isPrivate ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            padding: "10px 0",
                            borderTop: "1px solid #e5e9ee",
                            borderBottom: "1px solid #e5e9ee",
                          }}
                        >
                          {routePoints.map((routePoint, pointIndex) => {
                            const Icon = routePoint.icon;
                            const leg = t.routeLegs[pointIndex];
                            return (
                              <div key={routePoint.label}>
                                <span
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                  }}
                                >
                                  <Icon
                                    size={15}
                                    color={
                                      pointIndex === routePoints.length - 1
                                        ? "#F5A623"
                                        : pointIndex === 0
                                          ? "#0B1E3D"
                                          : "#00C2A8"
                                    }
                                    aria-hidden="true"
                                    style={{ flexShrink: 0 }}
                                  />
                                  <strong
                                    style={{
                                      color: "#0B1E3D",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {routePoint.label}
                                  </strong>
                                  <span>
                                    {routePoint.point?.address
                                      ? formatDisplayName(
                                          routePoint.point.address,
                                        )
                                      : "—"}
                                  </span>
                                </span>
                                {leg && pointIndex < routePoints.length - 1 && (
                                  <span
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      margin: "5px 0 0 22px",
                                      fontSize: 12,
                                      color: "#5A6A7A",
                                    }}
                                  >
                                    <Route size={13} aria-hidden="true" />
                                    To {routePoints[pointIndex + 1].label}:{" "}
                                    {leg.distanceKm} km · {leg.durationMinutes}{" "}
                                    min
                                    {leg.passengers != null &&
                                      ` · ${leg.passengers} passenger${leg.passengers === 1 ? "" : "s"}`}
                                    {leg.priceEgp != null &&
                                      ` · ${Math.round(leg.priceEgp)} EGP`}
                                  </span>
                                )}
                                {t.stops[pointIndex - 1] && (
                                  <span
                                    style={{
                                      display: "block",
                                      margin: "4px 0 0 23px",
                                      fontSize: 12,
                                      color: "#5A6A7A",
                                    }}
                                  >
                                    Alighting:{" "}
                                    {t.stops[pointIndex - 1].alighting} ·
                                    Boarding: {t.stops[pointIndex - 1].boarding}
                                    {t.stops[pointIndex - 1].waitingMinutes >
                                      0 &&
                                      ` · Wait: ${t.stops[pointIndex - 1].waitingMinutes} min`}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <MapPin
                              size={15}
                              color="#00C2A8"
                              aria-hidden="true"
                              style={{ flexShrink: 0 }}
                            />
                            {t.pickup?.address
                              ? formatDisplayName(t.pickup.address)
                              : "—"}
                          </span>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Flag
                              size={15}
                              color="#F5A623"
                              aria-hidden="true"
                              style={{ flexShrink: 0 }}
                            />
                            {t.dropoff?.address
                              ? formatDisplayName(t.dropoff.address)
                              : "—"}
                          </span>
                        </>
                      )}
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Clock
                          size={15}
                          color="#5A6A7A"
                          aria-hidden="true"
                          style={{ flexShrink: 0 }}
                        />
                        <span>
                          Pickup: <strong>{to12h(t.pickupTime)}</strong> ·
                          Arrive: <strong>{to12h(t.arrivalTime)}</strong>
                        </span>
                      </span>
                      {t.distanceKm && (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Route
                            size={15}
                            color="#5A6A7A"
                            aria-hidden="true"
                            style={{ flexShrink: 0 }}
                          />
                          {t.distanceKm} km · {t.durationMinutes} min drive
                        </span>
                      )}
                    </div>

                    {/* Per-trip instructions */}
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 12px",
                        background: "rgba(245,166,35,0.07)",
                        border: "1px solid rgba(245,166,35,0.35)",
                        borderRadius: 8,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#0B1E3D",
                          margin: "0 0 6px",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        ⚠️ Instructions & Conditions
                      </p>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 16,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <li
                          style={{
                            fontSize: 12,
                            color: "#0B1E3D",
                            fontWeight: 600,
                            listStyle: "inside",
                          }}
                        >
                          Be punctual — driver will not wait beyond the allowed
                          time.
                        </li>
                        <li
                          style={{
                            fontSize: 12,
                            color: "#e74c3c",
                            fontWeight: 600,
                            listStyle: "inside",
                          }}
                        >
                          Only declared passengers may board (except for
                          infants). All passengers are picked up and dropped off
                          exclusively at the specified locations — no additional
                          stops.
                        </li>
                        {(t.vehicleType === "van_shared" ||
                          t.vehicleType === "microbus_shared") && (
                          <>
                            <li
                              style={{
                                fontSize: 12,
                                color: "#e74c3c",
                                fontWeight: 700,
                                listStyle: "inside",
                              }}
                            >
                              No extra baggage allowed
                            </li>
                            <li
                              style={{
                                fontSize: 12,
                                color: "#e74c3c",
                                fontWeight: 700,
                                listStyle: "inside",
                              }}
                            >
                              No waiting time for Van / Microbus — be at the
                              pickup point on time.
                            </li>
                          </>
                        )}
                        {t.vehicleType === "taxi_shared" && (
                          <>
                            <li
                              style={{
                                fontSize: 12,
                                color: "#e74c3c",
                                fontWeight: 600,
                                listStyle: "inside",
                              }}
                            >
                              No extra baggage allowed
                            </li>
                            <li
                              style={{
                                fontSize: 12,
                                color: "#0B1E3D",
                                fontWeight: 600,
                                listStyle: "inside",
                              }}
                            >
                              Shared Taxi: maximum waiting time is{" "}
                              <strong>2 minutes</strong>.
                            </li>
                          </>
                        )}
                        {(t.vehicleType === "private_car" ||
                          t.vehicleType === "taxi_private") && (
                          <>
                            <li
                              style={{
                                fontSize: 12,
                                color: "#0B1E3D",
                                fontWeight: 600,
                                listStyle: "inside",
                              }}
                            >
                              Maximum waiting time: <strong>2 minutes</strong>.
                            </li>
                            <li
                              style={{
                                fontSize: 12,
                                color: "#0B1E3D",
                                fontWeight: 600,
                                listStyle: "inside",
                              }}
                            >
                              Maximum baggage: <strong>2 back bags</strong>.
                            </li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                );
              })}

              {totalEgp > 0 && (
                <div
                  style={{
                    padding: "12px 0",
                    borderTop: "1.5px solid #eef0f3",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 4,
                  }}
                >
                  <span
                    style={{ fontWeight: 700, fontSize: 15, color: "#0B1E3D" }}
                  >
                    Total
                    {selectedDates.length > 1 &&
                      ` (× ${selectedDates.length} days)`}
                  </span>
                  <span
                    style={{
                      fontWeight: 900,
                      fontSize: 18,
                      color: "#0B1E3D",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {grandTotalEgp} EGP
                  </span>
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <label
                  htmlFor="booking-note"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#0B1E3D",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Add note
                </label>
                <textarea
                  id="booking-note"
                  value={bookingNote}
                  onChange={(event) =>
                    setBookingNote(event.target.value.slice(0, 1000))
                  }
                  placeholder="Add pickup details or instructions for this request"
                  rows={4}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    resize: "vertical",
                    minHeight: 92,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1.5px solid #e8edf0",
                    background: "#f8f9fa",
                    color: "#0B1E3D",
                    fontSize: 13,
                    fontFamily: "inherit",
                    lineHeight: 1.45,
                    outline: "none",
                  }}
                />
                <p
                  style={{ fontSize: 11, color: "#5A6A7A", margin: "5px 0 0" }}
                >
                  {bookingNote.length}/1000
                </p>
              </div>

              {/* ── Terms & conditions ── */}
              <div
                style={{
                  marginTop: 16,
                  padding: "14px 16px",
                  background: "#f8f9fa",
                  borderRadius: 12,
                  border: "1.5px solid #eef0f3",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    style={{
                      marginTop: 2,
                      width: 16,
                      height: 16,
                      accentColor: "#00C2A8",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: "#0B1E3D",
                      fontWeight: 600,
                      lineHeight: 1.5,
                    }}
                  >
                    I have read and agree to all the instructions, conditions,
                    and trip details above and confirm they are correct.
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowPreview(false);
                  setShowPaymentModal(true);
                }}
                disabled={!agreedTerms}
                style={{
                  marginTop: 14,
                  width: "100%",
                  height: 52,
                  background: agreedTerms ? "#0B1E3D" : "#d0d8e0",
                  color: agreedTerms ? "#ffffff" : "#9aa5b4",
                  fontWeight: 700,
                  fontSize: 15,
                  border: "none",
                  borderRadius: 12,
                  cursor: agreedTerms ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                  transition: "background 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  if (agreedTerms) e.currentTarget.style.background = "#00C2A8";
                }}
                onMouseLeave={(e) => {
                  if (agreedTerms) e.currentTarget.style.background = "#0B1E3D";
                }}
              >
                Confirm the request →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment modal ── */}
      {showPaymentModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Payment"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(11,30,61,0.55)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPaymentModal(false);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 520,
              maxHeight: "70dvh",
              overflowY: "auto",
              padding: "0 0 32px",
            }}
          >
            <div
              style={{
                padding: "16px 24px 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#0B1E3D",
                  margin: 0,
                }}
              >
                Payment
              </h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                aria-label="Close payment"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#5A6A7A",
                  padding: 4,
                  minWidth: 36,
                  minHeight: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "16px 24px 0" }}>
              {/* Total recap */}
              <div
                style={{
                  padding: "12px 14px",
                  background: "#f8f9fa",
                  borderRadius: 12,
                  border: "1.5px solid #eef0f3",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 18,
                }}
              >
                <span
                  style={{ fontSize: 14, fontWeight: 600, color: "#5A6A7A" }}
                >
                  Total amount
                  {selectedDates.length > 1 &&
                    ` (× ${selectedDates.length} days)`}
                </span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#0B1E3D",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {grandTotalEgp} EGP
                </span>
              </div>

              {/* Payment method */}
              {(() => {
                const walletEnough =
                  walletBalance !== null && walletBalance >= grandTotalEgp;
                return (
                  <div>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#0B1E3D",
                        display: "block",
                        marginBottom: 10,
                      }}
                    >
                      Payment method
                    </span>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setPayMethod("card")}
                        style={{
                          flex: 1,
                          padding: "12px 14px",
                          borderRadius: 12,
                          border:
                            payMethod === "card"
                              ? "1.5px solid #00C2A8"
                              : "1.5px solid #eef0f3",
                          background:
                            payMethod === "card"
                              ? "rgba(0,194,168,0.08)"
                              : "#fff",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#0B1E3D",
                          }}
                        >
                          Card
                        </span>
                        <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                          Pay via Kashier
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => walletEnough && setPayMethod("wallet")}
                        disabled={!walletEnough}
                        style={{
                          flex: 1,
                          padding: "12px 14px",
                          borderRadius: 12,
                          border:
                            payMethod === "wallet"
                              ? "1.5px solid #00C2A8"
                              : "1.5px solid #eef0f3",
                          background:
                            payMethod === "wallet"
                              ? "rgba(0,194,168,0.08)"
                              : "#fff",
                          cursor: walletEnough ? "pointer" : "not-allowed",
                          opacity: walletEnough ? 1 : 0.55,
                          fontFamily: "inherit",
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#0B1E3D",
                          }}
                        >
                          Wallet
                        </span>
                        <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                          {walletBalance === null
                            ? "Loading balance…"
                            : `Balance: ${walletBalance} EGP`}
                        </span>
                      </button>
                    </div>
                    {walletBalance !== null && !walletEnough && (
                      <p
                        style={{
                          fontSize: 12,
                          color: "#5A6A7A",
                          margin: "8px 0 0",
                        }}
                      >
                        Not enough balance to pay {grandTotalEgp} EGP.{" "}
                        <Link
                          href="/wallet"
                          style={{ color: "#00C2A8", fontWeight: 600 }}
                        >
                          Top up your wallet
                        </Link>
                      </p>
                    )}
                  </div>
                );
              })()}

              {submitError && (
                <p
                  role="alert"
                  aria-live="assertive"
                  style={{
                    fontSize: 13,
                    color: "#e74c3c",
                    background: "rgba(231,76,60,0.07)",
                    border: "1px solid rgba(231,76,60,0.2)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginTop: 12,
                    marginBottom: 0,
                  }}
                >
                  {submitError}
                </p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  marginTop: 16,
                  width: "100%",
                  height: 52,
                  background: submitting ? "#5A6A7A" : "#0B1E3D",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 15,
                  border: "none",
                  borderRadius: 12,
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  transition: "background 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  if (!submitting) e.currentTarget.style.background = "#00C2A8";
                }}
                onMouseLeave={(e) => {
                  if (!submitting) e.currentTarget.style.background = "#0B1E3D";
                }}
              >
                {submitting ? (
                  <>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        border: "2px solid rgba(255,255,255,0.4)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "spin 0.7s linear infinite",
                      }}
                      aria-hidden="true"
                    />
                    Processing…
                  </>
                ) : (
                  "Confirm & pay →"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .email-desktop { display: block; }
        @media (max-width: 767px) {
          .create-layout { flex-direction: column !important; overflow-y: auto !important; overflow-x: hidden !important; }
          .create-left { 
            width: 100% !important; 
            margin: 0 !important; 
            border: none !important; 
            border-radius: 0 !important; 
            border-bottom: 1px solid #eef0f3 !important; 
            // overflow-y: visible !important; 
            flex-shrink: 0 !important;
          }
          .create-right { flex: 1 1 100% !important; height: 45vh !important; flex-shrink: 0 !important; }
          .email-desktop { display: none !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ── Helpers local to this file ── */
import { VEHICLE_LIST, finalPrice, VEHICLES } from "@/lib/config/vehicles";
import { formatDisplayName } from "@/lib/nominatim";
import { toMinutes, toHHMM } from "@/lib/time/pickupWindow";

function VEHICLE_LIST_LABEL(key: string) {
  return VEHICLE_LIST.find((v) => v.key === key)?.label ?? key;
}

function to12h(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}
