"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
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
  TicketPercent,
} from "lucide-react";
import { useTripStore } from "@/lib/store/useTripStore";
import { useClientLocale } from "@/lib/locale.client";
import {
  formatTime,
  formatEgp,
  formatDistanceKm,
  formatMinutes,
} from "@/lib/i18n";
import type { TripPoint } from "@/lib/store/useTripStore";
import AppHeader from "@/components/layout/AppHeader";
import DatePicker from "./DatePicker";
import TripCycle, { type TripData } from "./TripCycle";
const CreateMap = dynamic(() => import("./CreateMapOsm"), { ssr: false });
import { earliestBookingDate } from "@/lib/time/bookingDates";
import type { SavedAddress } from "@/types/shared";
import { haversineKm } from "@/lib/geo/stations";
import type { Station } from "@/lib/geo/stations";
import { computeTripPriceForSelection } from "@/lib/config/vehicles";

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

const MOBILE_DRAWER_MIN_VH = 42;
const MOBILE_DRAWER_MAX_VH = 100;
const MOBILE_DRAWER_DEFAULT_VH = 74;

function clampDrawerHeight(vh: number): number {
  return Math.max(MOBILE_DRAWER_MIN_VH, Math.min(MOBILE_DRAWER_MAX_VH, vh));
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
  const [useReferralDiscount, setUseReferralDiscount] = useState(false);
  const [referralDiscountAvailable, setReferralDiscountAvailable] =
    useState(false);
  const [referralDiscountPercentage, setReferralDiscountPercentage] = useState<
    number | null
  >(null);
  const [referralDiscountTripsRemaining, setReferralDiscountTripsRemaining] =
    useState(0);
  const [referralWarning, setReferralWarning] = useState("");
  const [promoCodeDraft, setPromoCodeDraft] = useState("");
  const [promoCodeValid, setPromoCodeValid] = useState(false);
  const [promoCodeDiscountPercentage, setPromoCodeDiscountPercentage] =
    useState(0);
  const [promoCodeMessage, setPromoCodeMessage] = useState("");
  const [promoCodeChecking, setPromoCodeChecking] = useState(false);
  const [promoWarning, setPromoWarning] = useState("");
  const [vehiclesMap, setVehiclesMap] = useState<Record<
    string,
    (typeof VEHICLES)[keyof typeof VEHICLES]
  > | null>(null);
  const [tripErrors, setTripErrors] = useState<Record<string, string | null>>(
    {},
  );
  const [picking, setPicking] = useState<{
    tripId: string;
    field: "pickup" | "dropoff";
  } | null>(null);
  const [drawerHeightVh, setDrawerHeightVh] = useState(
    MOBILE_DRAWER_DEFAULT_VH,
  );
  const [draggingDrawer, setDraggingDrawer] = useState(false);
  const drawerDragRef = useRef({
    active: false,
    pointerId: -1,
    startY: 0,
    startHeightVh: MOBILE_DRAWER_DEFAULT_VH,
  });
  const { t, locale } = useClientLocale();

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

      try {
        const r = await fetch("/api/referral/discount-availability", {
          cache: "no-store",
        });
        if (r.ok) {
          const d = await r.json();
          const info = d?.data;
          setReferralDiscountAvailable(
            Boolean(info?.referralDiscountAvailable),
          );
          setReferralDiscountPercentage(
            typeof info?.referralDiscountPercentage === "number"
              ? info.referralDiscountPercentage
              : null,
          );
          setReferralDiscountTripsRemaining(
            Number.isInteger(info?.referralDiscountTripsRemaining)
              ? info.referralDiscountTripsRemaining
              : 0,
          );
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

  const handleTripStopErrorChange = useCallback(
    (tripId: string, error: string | null) => {
      setTripErrors((prev) => {
        if (prev[tripId] === error) return prev;
        return { ...prev, [tripId]: error };
      });
    },
    [],
  );

  const getTripPriceForSubmission = useCallback(
    (trip: TripData) => {
      if (!trip.vehicleType) return 0;
      return computeTripPriceForSelection({
        basePrice: trip.priceEgp ?? 0,
        vehicleType: trip.vehicleType,
        extraPassengers: trip.extraPassengers ?? 0,
        numberOfPassengers: trip.numberOfPassengers ?? 1,
        selectedDates,
        vehiclesMap: vehiclesMap ?? undefined,
      });
    },
    [selectedDates, vehiclesMap],
  );

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError("");
    setReferralWarning("");
    setPromoWarning("");
    let navigating = false;
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates: selectedDates,
          note: bookingNote,
          useReferralDiscount,
          promoCode: promoCodeDraft.trim() || null,
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
            priceEgp: getTripPriceForSubmission(t),
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
        setSubmitError(data.error ?? t("create.booking_create_failed"));
        return;
      }

      if (data?.referralDiscountUnavailable) {
        setReferralWarning(t("create.referral_unavailable_fallback"));
      }
      if (data?.promoCodeUnavailable) {
        setPromoWarning(
          data?.promoCodeMessage ?? t("create.promo_unavailable_fallback"),
        );
      } else if (data?.promoCodePartiallyApplied) {
        setPromoWarning(t("create.promo_partially_applied"));
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
          setSubmitError(walletData.error ?? t("create.wallet_payment_failed"));
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
        setSubmitError(payData.error ?? t("create.payment_init_failed"));
        return;
      }
      navigating = true;
      // Full redirect (not router.push) so the browser leaves the SPA entirely
      window.location.href = payData.sessionUrl;
    } catch {
      setSubmitError(t("create.network_error_retry"));
    } finally {
      if (!navigating) setSubmitting(false);
    }
  }

  async function handleValidatePromoCode() {
    const normalized = promoCodeDraft.trim().toUpperCase();
    if (!normalized) {
      setPromoCodeValid(false);
      setPromoCodeDiscountPercentage(0);
      setPromoCodeMessage("");
      return;
    }

    setPromoCodeChecking(true);
    setPromoCodeMessage("");
    try {
      const response = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const result = await response.json();
      if (!response.ok) {
        setPromoCodeValid(false);
        setPromoCodeDiscountPercentage(0);
        setPromoCodeMessage(result.error ?? t("create.promo_check_failed"));
        return;
      }

      setPromoCodeValid(Boolean(result.valid));
      setPromoCodeDiscountPercentage(
        result.valid && typeof result.discountPercentage === "number"
          ? result.discountPercentage
          : 0,
      );
      setPromoCodeMessage(
        result.message ??
          (result.valid ? t("create.promo_valid") : t("create.promo_invalid")),
      );
      if (typeof result.normalizedCode === "string") {
        setPromoCodeDraft(result.normalizedCode);
      }
    } catch {
      setPromoCodeValid(false);
      setPromoCodeDiscountPercentage(0);
      setPromoCodeMessage(t("create.promo_check_failed"));
    } finally {
      setPromoCodeChecking(false);
    }
  }

  function handlePromoCodeInputChange(value: string) {
    setPromoCodeDraft(value.toUpperCase());
    setPromoCodeValid(false);
    setPromoCodeDiscountPercentage(0);
    setPromoCodeMessage("");
    setPromoWarning("");
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

  function handleDrawerPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (window.innerWidth > 767) return;
    drawerDragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeightVh: drawerHeightVh,
    };
    setDraggingDrawer(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handleDrawerPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = drawerDragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - drag.startY;
    const deltaVh = (deltaY / window.innerHeight) * 100;
    setDrawerHeightVh(clampDrawerHeight(drag.startHeightVh - deltaVh));
  }

  function handleDrawerPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = drawerDragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    drawerDragRef.current.active = false;
    setDraggingDrawer(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const drawerStyleVars = {
    ["--drawer-height-vh" as string]: String(drawerHeightVh),
  } as React.CSSProperties;

  // Validate all trips before preview
  function validate(): string | null {
    if (selectedDates.length === 0) return t("create.select_at_least_one_date");
    for (let i = 0; i < trips.length; i++) {
      const trip = trips[i];
      const n = i + 1;
      if (!trip.vehicleType)
        return t("create.validate_vehicle_required", { n });
      if (!trip.pickup) return t("create.validate_pickup_required", { n });
      if (!trip.dropoff) return t("create.validate_dropoff_required", { n });
      const vehicle =
        vehiclesMap?.[trip.vehicleType] ?? VEHICLES[trip.vehicleType];
      const isPrivate = vehicle.ride === "private";

      if (isPrivate) {
        if (!trip.pickupTime)
          return t("create.validate_pickup_time_required", { n });
        if (!trip.arrivalTime || !trip.distanceKm || !trip.durationMinutes)
          return t("create.validate_route_calculating", { n });
        if (
          !Number.isInteger(trip.numberOfPassengers) ||
          trip.numberOfPassengers < 1 ||
          trip.numberOfPassengers > vehicle.occupancy
        )
          return t("create.validate_passenger_count", {
            n,
            max: vehicle.occupancy,
          });
        if (trip.stops.length > 4) return t("create.validate_max_stops", { n });

        let onboard = trip.numberOfPassengers;
        for (let stopIndex = 0; stopIndex < trip.stops.length; stopIndex++) {
          const stop = trip.stops[stopIndex];
          const stopN = stopIndex + 1;
          if (!stop.point)
            return t("create.validate_stop_location_required", {
              n,
              stop: stopN,
            });
          if (
            !Number.isInteger(stop.alighting) ||
            !Number.isInteger(stop.boarding) ||
            !Number.isFinite(stop.waitingMinutes) ||
            stop.alighting < 0 ||
            stop.boarding < 0 ||
            stop.waitingMinutes < 0
          )
            return t("create.validate_stop_invalid", { n, stop: stopN });
          if (stop.alighting > onboard - 1)
            return t("create.validate_stop_min_passenger", { n, stop: stopN });
          const afterAlighting = onboard - stop.alighting;
          if (stop.boarding > vehicle.occupancy - afterAlighting)
            return t("create.validate_stop_occupancy", { n, stop: stopN });
          onboard = afterAlighting + stop.boarding;
        }
      } else {
        if (!trip.arrivalTime)
          return t("create.validate_arrival_required", { n });
        if (!trip.pickupTime)
          return t("create.validate_pickup_not_computed", { n });
      }
      if (
        trip.passengerDetourKm != null &&
        trip.baseDistanceKm != null &&
        trip.passengerDetourKm > trip.baseDistanceKm * 1.25
      )
        return t("create.validate_detour_exceeded", { n });
      // Time ordering: each trip must arrive after the previous trip
      if (i > 0) {
        const prev = trips[i - 1];
        if (
          prev.arrivalTime &&
          toMinutes(trip.arrivalTime) <= toMinutes(prev.arrivalTime)
        ) {
          return t("create.validate_arrival_after_previous", {
            n,
            prev: i,
            time: formatTime(locale, prev.arrivalTime),
          });
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

  const validationWarning = validate();
  const hasStopErrors = Object.values(tripErrors).some(Boolean);
  const hasInvalidLocations = trips.some((t) => {
    if (!t.pickup || !t.dropoff) return false;
    if (t.pickup.lat === t.dropoff.lat && t.pickup.lng === t.dropoff.lng) {
      return true;
    }
    if (t.distanceKm != null) return t.distanceKm < 0.5;
    const straightLine = haversineKm(
      t.pickup.lat,
      t.pickup.lng,
      t.dropoff.lat,
      t.dropoff.lng,
    );
    return straightLine < 0.5;
  });
  const previewDisabled =
    !!validationWarning || hasStopErrors || hasInvalidLocations;

  const totalEgp = trips.reduce(
    (sum, t) => sum + getTripPriceForSubmission(t),
    0,
  );
  const baseInstancePrices = selectedDates.flatMap(() =>
    trips.map((trip) => getTripPriceForSubmission(trip)),
  );
  const baseGrandTotalEgp = baseInstancePrices.reduce(
    (sum, price) => sum + price,
    0,
  );
  const appliedReferralSlots =
    useReferralDiscount &&
    referralDiscountAvailable &&
    referralDiscountPercentage != null
      ? Math.min(referralDiscountTripsRemaining, baseInstancePrices.length)
      : 0;
  const discountedInstancePrices = baseInstancePrices.map((price, index) =>
    (() => {
      const referralPct =
        index < appliedReferralSlots && referralDiscountPercentage != null
          ? referralDiscountPercentage
          : 0;
      const promoPct = promoCodeValid ? promoCodeDiscountPercentage : 0;
      const totalPct = Math.min(100, referralPct + promoPct);
      return Math.round(price * (1 - totalPct / 100));
    })(),
  );
  const grandTotalEgp = discountedInstancePrices.reduce(
    (sum, price) => sum + price,
    0,
  );
  const totalSavingsEgp = Math.max(0, baseGrandTotalEgp - grandTotalEgp);

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
            ...drawerStyleVars,
            width: 520,
            flexShrink: 0,
            background: "#ffffff",
            borderRight: "1px solid #eef0f3",
            overflowY: draggingDrawer ? "hidden" : "auto",
            display: "flex",
            flexDirection: "column",
            margin: "40px 0 40px 40px",
            border: "1px solid #ccc",
            borderRadius: 15,
          }}
          className="create-left"
        >
          <div
            className="mobile-drawer-handle-wrap"
            aria-hidden="true"
            onPointerDown={handleDrawerPointerDown}
            onPointerMove={handleDrawerPointerMove}
            onPointerUp={handleDrawerPointerUp}
            onPointerCancel={handleDrawerPointerUp}
          >
            <span className="mobile-drawer-handle" />
          </div>
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
                {t("create.book_a_ride_heading")}
              </h1>
              <p style={{ fontSize: 13, color: "#5A6A7A", margin: 0 }}>
                {t("create.fill_trip_details")}
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
                    onStopErrorChange={(error) =>
                      handleTripStopErrorChange(trip.id, error)
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
                {t("create.add_another_trip")}
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

              {referralDiscountAvailable &&
                referralDiscountPercentage != null && (
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #e8edf0",
                      background: "#f8f9fa",
                      marginBottom: 10,
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <TicketPercent
                        size={15}
                        color="#00877A"
                        aria-hidden="true"
                      />
                      <span
                        style={{
                          fontSize: 12.5,
                          color: "#0B1E3D",
                          fontWeight: 700,
                        }}
                      >
                        {t("create.referral_toggle_label")} ·{" "}
                        {t("create.referral_toggle_offer")
                          .replace("{pct}", String(referralDiscountPercentage))
                          .replace(
                            "{count}",
                            String(referralDiscountTripsRemaining),
                          )}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={useReferralDiscount}
                      onChange={(event) =>
                        setUseReferralDiscount(event.target.checked)
                      }
                      style={{ width: 16, height: 16, accentColor: "#00C2A8" }}
                    />
                  </label>
                )}

              <div
                style={{
                  display: "grid",
                  gap: 8,
                  marginBottom: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #e8edf0",
                  background: "#f8f9fa",
                }}
              >
                <span
                  style={{ fontSize: 12.5, color: "#0B1E3D", fontWeight: 700 }}
                >
                  {t("create.promo_input_label")}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={promoCodeDraft}
                    onChange={(event) =>
                      handlePromoCodeInputChange(event.target.value)
                    }
                    placeholder="PROMO-XXXXXX"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: 38,
                      borderRadius: 8,
                      border: "1.5px solid #d0d8e0",
                      padding: "0 10px",
                      fontSize: 13,
                      color: "#0B1E3D",
                      fontFamily: "inherit",
                      textTransform: "uppercase",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleValidatePromoCode()}
                    disabled={promoCodeChecking || !promoCodeDraft.trim()}
                    style={{
                      height: 38,
                      padding: "0 12px",
                      border: 0,
                      borderRadius: 8,
                      background:
                        promoCodeChecking || !promoCodeDraft.trim()
                          ? "#9aa8b5"
                          : "#0B1E3D",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor:
                        promoCodeChecking || !promoCodeDraft.trim()
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {promoCodeChecking
                      ? t("create.promo_checking")
                      : t("create.promo_apply_action")}
                  </button>
                </div>
                {promoCodeMessage ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: promoCodeValid ? "#00877A" : "#e74c3c",
                      fontWeight: promoCodeValid ? 700 : 600,
                    }}
                  >
                    {promoCodeMessage}
                  </p>
                ) : null}
              </div>

              {totalSavingsEgp > 0 && (
                <p
                  style={{
                    textAlign: "center",
                    fontSize: 12,
                    color: "#00877A",
                    margin: "0 0 10px",
                    fontWeight: 700,
                  }}
                >
                  {t("create.discount_savings_label").replace(
                    "{amount}",
                    String(totalSavingsEgp),
                  )}
                </p>
              )}
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewDisabled}
                style={{
                  width: "100%",
                  height: 52,
                  background: previewDisabled ? "#7b8a9a" : "#0B1E3D",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 15,
                  border: "none",
                  borderRadius: 12,
                  cursor: previewDisabled ? "not-allowed" : "pointer",
                  opacity: previewDisabled ? 0.55 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontFamily: "inherit",
                  transition: "background 0.2s, opacity 0.2s",
                }}
                onMouseEnter={
                  previewDisabled
                    ? undefined
                    : (e) => {
                        e.currentTarget.style.background = "#00C2A8";
                      }
                }
                onMouseLeave={
                  previewDisabled
                    ? undefined
                    : (e) => {
                        e.currentTarget.style.background = "#0B1E3D";
                      }
                }
              >
                <Eye size={17} aria-hidden="true" />
                {t("create.preview_booking")}
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
          aria-label={t("create.map_area_aria")}
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
          aria-label={t("create.booking_preview_aria")}
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
                {t("create.booking_summary_heading")}
              </h2>
              <button
                onClick={() => setShowPreview(false)}
                aria-label={t("create.close_preview_aria")}
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
                {selectedDates.length > 1
                  ? t("create.dates_label")
                  : t("create.date_label")}
                :{" "}
                <strong style={{ color: "#0B1E3D" }}>
                  {selectedDates.join(", ")}
                </strong>
                {selectedDates.length > 1 &&
                  ` ${t("create.days_suffix").replace("{n}", String(selectedDates.length))}`}
              </p>

              {trips.map((trip, i) => {
                const isPrivate =
                  trip.vehicleType !== "" &&
                  (
                    vehiclesMap?.[trip.vehicleType] ??
                    VEHICLES[trip.vehicleType]
                  ).ride === "private";
                const routePoints = [
                  {
                    label: t("create.route_pickup_label"),
                    point: trip.pickup,
                    icon: Navigation,
                  },
                  ...trip.stops.map((stop, stopIndex) => ({
                    label: t("create.stop_label").replace(
                      "{n}",
                      String(stopIndex + 1),
                    ),
                    point: stop.point,
                    icon: MapPin,
                  })),
                  {
                    label: t("create.route_dropoff_label"),
                    point: trip.dropoff,
                    icon: Flag,
                  },
                ];
                return (
                  <div
                    key={trip.id}
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
                        {t("create.trip_number").replace("{n}", String(i + 1))}
                      </span>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: 15,
                          color: "#00C2A8",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatEgp(locale, getTripPriceForSubmission(trip))}
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
                            {trip.numberOfPassengers}{" "}
                            {trip.numberOfPassengers === 1
                              ? t("create.passenger_count_suffix")
                              : t("create.passengers_count_suffix")}
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
                            {trip.extraPassengers}{" "}
                            {trip.extraPassengers === 1
                              ? t("create.extra_passenger_count_suffix")
                              : t("create.extra_passengers_count_suffix")}
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
                          {VEHICLE_LIST_LABEL(trip.vehicleType, t)}
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
                            const leg = trip.routeLegs[pointIndex];
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
                                {trip.stops[pointIndex - 1] && (
                                  <span
                                    style={{
                                      display: "block",
                                      margin: "4px 0 0 23px",
                                      fontSize: 12,
                                      color: "#5A6A7A",
                                    }}
                                  >
                                    Alighting:{" "}
                                    {trip.stops[pointIndex - 1].alighting} ·
                                    Boarding:{" "}
                                    {trip.stops[pointIndex - 1].boarding}
                                    {trip.stops[pointIndex - 1].waitingMinutes >
                                      0 &&
                                      ` · Wait: ${trip.stops[pointIndex - 1].waitingMinutes} min`}
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
                            {trip.pickup?.address
                              ? formatDisplayName(trip.pickup.address)
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
                            {trip.dropoff?.address
                              ? formatDisplayName(trip.dropoff.address)
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
                          {t("create.early_pickup_label")}{" "}
                          <strong>{formatTime(locale, trip.pickupTime)}</strong>{" "}
                          · {t("latest_arrival_time")}{" "}
                          <strong>
                            {formatTime(locale, trip.arrivalTime)}
                          </strong>
                        </span>
                      </span>
                      {trip.distanceKm && (
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
                          {formatDistanceKm(locale, trip.distanceKm ?? 0)} ·{" "}
                          {formatMinutes(locale, trip.durationMinutes ?? 0)}
                        </span>
                      )}
                    </div>

                    {/* per-trip instructions moved to /terms page */}
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
                    {t("create.total_label")}
                    {selectedDates.length > 1 &&
                      ` ${t("create.days_suffix").replace("{n}", String(selectedDates.length))}`}
                  </span>
                  <span
                    style={{
                      fontWeight: 900,
                      fontSize: 18,
                      color: "#0B1E3D",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatEgp(locale, grandTotalEgp)}
                  </span>
                </div>
              )}

              {referralDiscountAvailable &&
                referralDiscountPercentage != null && (
                  <div
                    style={{
                      marginTop: 8,
                      marginBottom: 8,
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: "#f8f9fa",
                      border: "1px solid #eef0f3",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <TicketPercent
                          size={16}
                          color="#00877A"
                          aria-hidden="true"
                        />
                        <span
                          style={{
                            fontSize: 13,
                            color: "#0B1E3D",
                            fontWeight: 700,
                          }}
                        >
                          {t("create.referral_toggle_label")}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={useReferralDiscount}
                        onChange={(event) =>
                          setUseReferralDiscount(event.target.checked)
                        }
                        style={{
                          width: 16,
                          height: 16,
                          accentColor: "#00C2A8",
                        }}
                      />
                    </label>
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: 12,
                        color: "#5A6A7A",
                      }}
                    >
                      {t("create.referral_toggle_offer")
                        .replace("{pct}", String(referralDiscountPercentage))
                        .replace(
                          "{count}",
                          String(referralDiscountTripsRemaining),
                        )}
                    </p>
                  </div>
                )}

              <div
                style={{
                  marginTop: 8,
                  marginBottom: 8,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "#f8f9fa",
                  border: "1px solid #eef0f3",
                }}
              >
                <label
                  htmlFor="promo-code"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#0B1E3D",
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  {t("create.promo_input_label")}
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    id="promo-code"
                    type="text"
                    value={promoCodeDraft}
                    onChange={(event) =>
                      handlePromoCodeInputChange(event.target.value)
                    }
                    placeholder="PROMO-XXXXXX"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: 40,
                      borderRadius: 10,
                      border: "1.5px solid #d0d8e0",
                      padding: "0 10px",
                      fontSize: 13,
                      color: "#0B1E3D",
                      fontFamily: "inherit",
                      textTransform: "uppercase",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleValidatePromoCode()}
                    disabled={promoCodeChecking || !promoCodeDraft.trim()}
                    style={{
                      height: 40,
                      padding: "0 14px",
                      border: 0,
                      borderRadius: 10,
                      background:
                        promoCodeChecking || !promoCodeDraft.trim()
                          ? "#9aa8b5"
                          : "#0B1E3D",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor:
                        promoCodeChecking || !promoCodeDraft.trim()
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {promoCodeChecking
                      ? t("create.promo_checking")
                      : t("create.promo_apply_action")}
                  </button>
                </div>
                {promoCodeMessage ? (
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 12,
                      color: promoCodeValid ? "#00877A" : "#e74c3c",
                      fontWeight: promoCodeValid ? 700 : 600,
                    }}
                  >
                    {promoCodeMessage}
                  </p>
                ) : null}
              </div>

              {totalSavingsEgp > 0 && (
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: 12,
                    color: "#00877A",
                    fontWeight: 700,
                  }}
                >
                  {t("create.discount_savings_label").replace(
                    "{amount}",
                    String(totalSavingsEgp),
                  )}
                </p>
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
                  {t("create.add_note_label")}
                </label>
                <textarea
                  id="booking-note"
                  value={bookingNote}
                  onChange={(event) =>
                    setBookingNote(event.target.value.slice(0, 1000))
                  }
                  placeholder={t("create.pickup_instructions_placeholder")}
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
                    {t("create.terms_agree_prefix")}{" "}
                    <Link
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#00C2A8", fontWeight: 700 }}
                    >
                      {t("create.terms_link_text")}
                    </Link>{" "}
                    {t("create.terms_agree_suffix")}
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
                {t("create.confirm_request")}
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
          aria-label={t("create.payment_aria")}
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
                aria-label={t("create.close_payment_aria")}
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
                  {t("create.total_amount_label")}
                  {selectedDates.length > 1 &&
                    ` ${t("create.days_suffix").replace("{n}", String(selectedDates.length))}`}
                </span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#0B1E3D",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatEgp(locale, grandTotalEgp)}
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
                      {t("create.payment_method_label")}
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
                          {t("create.pay_card")}
                        </span>
                        <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                          {t("create.pay_via_kashier")}
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
                          {t("create.pay_wallet")}
                        </span>
                        <span style={{ fontSize: 12, color: "#5A6A7A" }}>
                          {walletBalance === null
                            ? t("create.loading_balance")
                            : t("create.wallet_balance_label").replace(
                                "{amount}",
                                formatEgp(locale, walletBalance),
                              )}
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
                        {t("create.wallet_insufficient").replace(
                          "{amount}",
                          formatEgp(locale, grandTotalEgp),
                        )}{" "}
                        <Link
                          href="/wallet"
                          style={{ color: "#00C2A8", fontWeight: 600 }}
                        >
                          {t("create.top_up_wallet")}
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

              {referralWarning && (
                <p
                  role="status"
                  aria-live="polite"
                  style={{
                    fontSize: 13,
                    color: "#0B1E3D",
                    background: "rgba(245,166,35,0.12)",
                    border: "1px solid rgba(245,166,35,0.45)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginTop: 12,
                    marginBottom: 0,
                  }}
                >
                  {referralWarning}
                </p>
              )}

              {promoWarning && (
                <p
                  role="status"
                  aria-live="polite"
                  style={{
                    fontSize: 13,
                    color: "#0B1E3D",
                    background: "rgba(245,166,35,0.12)",
                    border: "1px solid rgba(245,166,35,0.45)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginTop: 12,
                    marginBottom: 0,
                  }}
                >
                  {promoWarning}
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
                    {t("create.processing")}
                  </>
                ) : (
                  t("create.confirm_and_pay")
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .email-desktop { display: block; }
        @media (max-width: 767px) {
          .create-layout {
            position: relative !important;
            display: block !important;
            overflow: hidden !important;
            height: 100% !important;
          }
          .create-left { 
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            z-index: 20 !important;
            width: auto !important;
            max-height: min(100dvh, calc(var(--drawer-height-vh, 74) * 1dvh)) !important;
            margin: 0 !important; 
            border: 1px solid #dfe5eb !important;
            border-bottom: none !important;
            border-radius: 20px 20px 0 0 !important;
            background: #ffffff !important;
            box-shadow: 0 -12px 30px rgba(11, 30, 61, 0.14) !important;
            overflow-y: auto !important;
          }
          .create-right {
            position: relative !important;
            margin: 0 !important;
            border-radius: 0 !important;
            height: 100% !important;
          }
          .mobile-drawer-handle-wrap {
            position: sticky;
            top: 0;
            z-index: 1;
            display: flex;
            justify-content: center;
            padding: 10px 0 6px;
            background: linear-gradient(180deg, #ffffff 70%, rgba(255,255,255,0.92) 100%);
            touch-action: none;
            cursor: ns-resize;
            user-select: none;
          }
          .mobile-drawer-handle {
            width: 44px;
            height: 5px;
            border-radius: 999px;
            background: #cfd8e2;
            display: inline-block;
          }
          .create-left > div:last-child {
            padding-top: 12px !important;
          }
          .email-desktop { display: none !important; }
        }
        @media (min-width: 768px) {
          .mobile-drawer-handle-wrap { display: none; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ── Helpers local to this file ── */
import { VEHICLE_LIST, VEHICLES } from "@/lib/config/vehicles";
import { formatDisplayName } from "@/lib/nominatim";
import { toMinutes, toHHMM } from "@/lib/time/pickupWindow";

function VEHICLE_LIST_LABEL(key: string, t: (key: string) => string) {
  const translated = t(`vehicles.${key}`);
  if (translated !== `vehicles.${key}`) return translated;
  return VEHICLE_LIST.find((v) => v.key === key)?.label ?? key;
}
