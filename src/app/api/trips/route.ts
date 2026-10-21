import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import {
  isMultiDayRequestsEnabled,
  shouldCreateRequestGroup,
} from "@/lib/config/featureFlags";
import { logMultiDayEvent } from "@/lib/logging/multiday";
import { AdminSettings } from "@/models/AdminSettings";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";
import { nextSequence } from "@/models/Counter";
import { Station } from "@/models/Station";
import { getMapSettings } from "@/lib/maps/settings";
import {
  VEHICLES,
  computePrivateTripPriceEgp,
  computeTripPriceEgp,
  getVehiclePassengerCapacity,
  priceForSelectedDate,
} from "@/lib/config/vehicles";
import {
  getTripPassengerCount,
  isVehiclePassengerCountAllowed,
} from "@/lib/rideCapacity";
import { getCurrencyConfig } from "@/lib/config/regions";
import { resolveActiveRegion } from "@/lib/regions/resolveActiveRegion";
import { bookingWindow } from "@/lib/time/bookingDates";
import {
  ARRIVAL_SLOT_END_MIN,
  ARRIVAL_SLOT_START_MIN,
  snapToArrivalSlotMidpoint,
  toMinutes,
} from "@/lib/time/pickupWindow";
import { HOLDING_TRIP_STATUSES } from "@/lib/validation/tripSpacing";
import { getVehicles } from "@/lib/db/getVehicles";
import {
  findNearestStations,
  findNearestStation,
  type Station as GeoStation,
  type StationOption,
} from "@/lib/geo/stations";
import { isPointInAnyZone, isPointInZone } from "@/lib/geo/zones";
import { loadServiceZones } from "@/lib/geo/zones.server";
import type { StopInput, TripInput } from "@/types/forms";
import type { PaymentStatus } from "@/types/booking";
import { listUserTrips } from "@/lib/services/trips";
import {
  createNotification,
  createNotifications,
} from "@/lib/notifications/createNotification";
import {
  getSharedRideWaitingListEnabled,
  shouldCreateWaitingListRequest,
} from "@/lib/admin/waitingList";
import {
  buildTripBatchResponse,
  getInitialTripBookingState,
  getTripBatchDateValidationError,
  getTripBatchPayloadError,
  MAX_PENDING_UNPAID_TRIPS,
} from "@/lib/tripBooking";
import {
  createTripBatchWith,
  TooManyPendingTripsError,
  TripBatchSpacingConflictError,
  type PreparedTripBatchCandidate,
} from "@/lib/tripBatchCreation";
import {
  createRequestGroupWith,
  RequestGroupPromoError,
  saveRequestGroup,
} from "@/lib/requestGroupCreation";
import mongoose, { Types, type ClientSession } from "mongoose";
import type { Document } from "mongodb";
import {
  applyPromoCodeToTrip,
  computePromoDiscountedPrice,
  normalizePromoCode,
} from "@/lib/promoCode";
import {
  isTransientBookingConflict,
  spacingLockUpsertFields,
} from "@/lib/phase8bGuards";
import { ensureTripSpacingLockTtlIndex } from "@/lib/tripSpacingLockIndex";
import {
  notifyAdminsOfWaitingListRequest,
  notifyAdminsOfWaitingListTripBatch,
} from "@/lib/notifications/adminActivity";
import { buildWaitingListCreatedTripBatchAdminNotifications } from "@/lib/admin/waitingList";

function stationPayload(
  station: Pick<GeoStation, "id" | "lat" | "lng" | "name" | "regionCode">,
) {
  return {
    id: station.id,
    regionCode: station.regionCode,
    lat: station.lat,
    lng: station.lng,
    name: station.name,
  };
}

const PAYMENT_STATUSES = new Set<PaymentStatus>([
  "pending",
  "paid",
  "failed",
  "refunded",
  "expired",
]);

interface TripSpacingLockDocument extends Document {
  _id: string;
  createdAt?: Date;
  revision?: number;
  updatedAt?: Date;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const payment = searchParams.get("paymentStatus");
  const vehicleType = searchParams.get("vehicleType");

  if (payment && !PAYMENT_STATUSES.has(payment as PaymentStatus)) {
    return NextResponse.json(
      { error: "Invalid paymentStatus" },
      { status: 400 },
    );
  }
  if (vehicleType && !(vehicleType in VEHICLES)) {
    return NextResponse.json({ error: "Invalid vehicleType" }, { status: 400 });
  }

  const result = await listUserTrips(session.userId, {
    page,
    paymentStatus: payment as PaymentStatus | undefined,
    vehicleType: vehicleType ?? undefined,
  });
  return NextResponse.json(
    {
      data: result.rows,
      page: result.page,
      pageSize: 12,
      total: result.total,
      totalPages: Math.ceil(result.total / 12),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.userId;
  let requestGroupEnabledForRequest = false;
  let requestGroupIdForLog: string | null = null;
  let requestGroupDateCount = 0;
  let requestGroupTripCount = 0;

  let body: {
    date?: string;
    dates?: string[];
    trips: TripInput[];
    note?: string;
    promoCode?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { trips } = body;
  const rawDates: unknown = body.dates ?? (body.date ? [body.date] : []);
  const promoCodeInput =
    typeof body.promoCode === "string" ? body.promoCode : "";
  const promoCode = promoCodeInput.trim()
    ? normalizePromoCode(promoCodeInput)
    : null;
  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";

  // Basic input validation
  if (!Array.isArray(rawDates) || rawDates.length === 0) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (rawDates.some((date) => typeof date !== "string")) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const dateValidationError = getTripBatchDateValidationError(
    rawDates as string[],
    bookingWindow(),
  );
  if (dateValidationError?.code === "TOO_MANY_DATES") {
    return NextResponse.json(
      {
        errorCode: dateValidationError.code,
        error: dateValidationError.code,
      },
      { status: 400 },
    );
  }
  if (dateValidationError?.code === "DUPLICATE_DATES") {
    return NextResponse.json(
      { errorCode: "DUPLICATE_DATES", error: "DUPLICATE_DATES" },
      { status: 400 },
    );
  }
  if (dateValidationError?.code === "INVALID_DATE") {
    return NextResponse.json(
      { error: `Invalid or out-of-window date: ${dateValidationError.date}` },
      { status: 400 },
    );
  }
  const dates = [...(rawDates as string[])].sort();
  if (!Array.isArray(trips) || trips.length === 0) {
    return NextResponse.json({ error: "Invalid trips" }, { status: 400 });
  }
  const tripCountError = getTripBatchPayloadError(dates.length, trips.length);
  if (tripCountError) {
    return NextResponse.json(
      { errorCode: tripCountError, error: tripCountError },
      { status: 400 },
    );
  }
  if (trips.length !== 1) {
    return NextResponse.json({ error: "Invalid trips" }, { status: 400 });
  }

  for (const trip of trips) {
    if (
      !Number.isFinite(trip.distanceKm) ||
      trip.distanceKm < 0 ||
      !Number.isFinite(trip.durationMinutes) ||
      trip.durationMinutes < 0
    ) {
      return NextResponse.json(
        { error: "Invalid route data" },
        { status: 400 },
      );
    }
  }

  await connectDB();

  const activeRegion = await resolveActiveRegion({ userId });
  const userRegion = activeRegion.code;
  const mapSettings = await getMapSettings(userRegion);
  const vehiclesMap = await getVehicles(userRegion);
  const zoneFeatures =
    mapSettings.stationAssignmentMode === "zones" || mapSettings.showZones
      ? await loadServiceZones(userRegion)
      : [];
  if (
    (mapSettings.showZones || mapSettings.stationAssignmentMode === "zones") &&
    !zoneFeatures.length
  ) {
    return NextResponse.json(
      { error: "Service zones are not configured for this region." },
      { status: 503 },
    );
  }
  if (mapSettings.showZones) {
    for (const trip of trips) {
      for (const point of [trip.pickup, trip.dropoff]) {
        if (point && !isPointInAnyZone([point.lng, point.lat], zoneFeatures)) {
          return NextResponse.json(
            {
              error:
                "Pickup and dropoff must be inside this region’s service zones.",
            },
            { status: 400 },
          );
        }
      }
    }
  }
  const usesStationsForPoint = (
    point: { lat: number; lng: number },
    vehicleType: string,
  ) => {
    if (mapSettings.stationAssignmentMode !== "zones") {
      return vehiclesMap[vehicleType]?.ride === "shared";
    }
    const pointIsInZoneList = (zoneIds: string[]) =>
      zoneFeatures.some(
        (feature) =>
          feature.id != null &&
          zoneIds.includes(String(feature.id)) &&
          isPointInZone([point.lng, point.lat], feature),
      );
    if (pointIsInZoneList(mapSettings.directPointZoneIds)) return false;
    return pointIsInZoneList(mapSettings.stationZoneIds);
  };
  const allowedVehicleSet = new Set(
    Object.values(vehiclesMap)
      .filter((vehicle) => vehicle.active !== false)
      .map((vehicle) => vehicle.key),
  );
  const stationDocs = await Station.find({
    regionCode: userRegion,
    active: true,
  }).lean();
  const canonicalStations: GeoStation[] = stationDocs.map((station) => ({
    id: station.objectId,
    regionCode: station.regionCode,
    name: station.name || station.direction || "",
    direction: station.direction,
    stationType: station.stationType ?? "",
    lat: station.lat,
    lng: station.lng,
    popupInfo: [station.direction, station.landmark, station.stationType]
      .filter(Boolean)
      .join("\n"),
  }));

  interface ServerTrip {
    pickup: { address: string; lat: number; lng: number };
    dropoff: { address: string; lat: number; lng: number };
    vehicleType: string;
    rideType: string;
    arrivalTime: string;
    pickupTime: string;
    distanceKm: number;
    durationMinutes: number;
    routeCoordinates?: [number, number][];
    priceEgp: number;
    extraPassengers: number;
    preferedGender: "male" | "female" | null;
    numberOfPassengers: number;
    stops: StopInput[];
    passengers: {
      sameAsMain: boolean;
      pickup: { address: string; lat: number; lng: number } | null;
      dropoff: { address: string; lat: number; lng: number } | null;
    }[];
    pickupStation?: { id: number; lat: number; lng: number; name: string };
    dropoffStation?: { id: number; lat: number; lng: number; name: string };
    pickupStationOptions?: StationOption[];
    dropoffStationOptions?: StationOption[];
    walkingMinToStation?: number;
    walkingMinFromStation?: number;
  }

  const currentUser = await User.findById(userId)
    .select("gender")
    .lean<{ gender?: "male" | "female" | null } | null>();
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const currentUserGender =
    currentUser.gender === "male" || currentUser.gender === "female"
      ? currentUser.gender
      : null;

  const serverTrips: ServerTrip[] = [];
  for (const t of trips) {
    if (
      t.sameGenderPreference !== undefined &&
      typeof t.sameGenderPreference !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Invalid sameGenderPreference" },
        { status: 400 },
      );
    }
    if (t.sameGenderPreference && !currentUserGender) {
      return NextResponse.json(
        { error: "Select your gender before requesting a same-gender ride." },
        { status: 400 },
      );
    }
    const preferedGender = t.sameGenderPreference ? currentUserGender : null;

    // Validate required fields
    if (!t.pickup?.address || !t.dropoff?.address) {
      return NextResponse.json(
        { error: "Missing pickup/dropoff" },
        { status: 400 },
      );
    }
    if (!allowedVehicleSet.has(t.vehicleType)) {
      return NextResponse.json(
        { error: "Invalid vehicleType" },
        { status: 400 },
      );
    }
    const vKey = t.vehicleType;
    const vehicle = vehiclesMap[vKey];
    const tripRideType = vehicle.ride;
    const vehicleCapacity = getVehiclePassengerCapacity(vKey);
    const requestedPassengerCount = Number(t.numberOfPassengers ?? 1);
    const numberOfPassengers = getTripPassengerCount(
      vKey,
      requestedPassengerCount,
      Number(t.extraPassengers ?? 0),
    );
    if (
      !Number.isInteger(requestedPassengerCount) ||
      requestedPassengerCount < 1 ||
      !isVehiclePassengerCountAllowed(vKey, numberOfPassengers)
    ) {
      return NextResponse.json(
        {
          error: "VEHICLE_CAPACITY_EXCEEDED",
          max: vehicleCapacity,
        },
        { status: 400 },
      );
    }
    let routeCoordinates: [number, number][] | undefined;
    if (t.routeCoordinates != null) {
      if (
        !Array.isArray(t.routeCoordinates) ||
        t.routeCoordinates.length > 5000 ||
        t.routeCoordinates.some(
          (coordinate) =>
            !Array.isArray(coordinate) ||
            coordinate.length !== 2 ||
            !Number.isFinite(coordinate[0]) ||
            !Number.isFinite(coordinate[1]) ||
            coordinate[0] < -90 ||
            coordinate[0] > 90 ||
            coordinate[1] < -180 ||
            coordinate[1] > 180,
        )
      ) {
        return NextResponse.json(
          { error: "Invalid route geometry" },
          { status: 400 },
        );
      }
      routeCoordinates = t.routeCoordinates;
    }

    if (tripRideType === "private") {
      if (!t.pickupTime || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t.pickupTime)) {
        return NextResponse.json(
          { error: "Invalid pickupTime" },
          { status: 400 },
        );
      }

      if (!Array.isArray(t.stops) || t.stops.length > 4) {
        return NextResponse.json({ error: "Invalid stops" }, { status: 400 });
      }

      const stops: StopInput[] = [];
      let onboard = numberOfPassengers;
      for (const stop of t.stops) {
        if (
          !stop.point?.address ||
          !Number.isFinite(stop.point.lat) ||
          !Number.isFinite(stop.point.lng) ||
          !Number.isInteger(stop.alighting) ||
          !Number.isInteger(stop.boarding) ||
          !Number.isInteger(stop.waitingMinutes) ||
          stop.alighting < 0 ||
          stop.boarding < 0 ||
          stop.waitingMinutes < 0
        ) {
          return NextResponse.json({ error: "Invalid stop" }, { status: 400 });
        }
        if (stop.alighting > onboard - 1) {
          return NextResponse.json(
            { error: "At least one passenger must remain onboard" },
            { status: 400 },
          );
        }
        const afterAlighting = onboard - stop.alighting;
        if (stop.boarding > vehicleCapacity - afterAlighting) {
          return NextResponse.json(
            { error: "VEHICLE_CAPACITY_EXCEEDED", max: vehicleCapacity },
            { status: 400 },
          );
        }
        onboard = afterAlighting + stop.boarding;
        stops.push({
          point: {
            address: stop.point.address,
            lat: stop.point.lat,
            lng: stop.point.lng,
          },
          alighting: stop.alighting,
          boarding: stop.boarding,
          waitingMinutes: stop.waitingMinutes,
        });
      }

      const distinctPassengers = (t.passengers ?? []).filter(
        (passenger) =>
          !passenger.sameAsMain && passenger.pickup && passenger.dropoff,
      );
      if (stops.length > 0 && distinctPassengers.length > 0) {
        return NextResponse.json(
          { error: "Stop points cannot be combined with passenger detours" },
          { status: 400 },
        );
      }
      const serverPassengers = (t.passengers ?? []).map((passenger) =>
        passenger.sameAsMain || !passenger.pickup || !passenger.dropoff
          ? { sameAsMain: true, pickup: null, dropoff: null }
          : {
              sameAsMain: false,
              pickup: passenger.pickup,
              dropoff: passenger.dropoff,
            },
      );

      const submittedLegs = t.routeLegs ?? [];
      if (
        submittedLegs.length !== stops.length + 1 ||
        submittedLegs.some(
          (leg) =>
            !Number.isFinite(leg.distanceKm) ||
            leg.distanceKm < 0 ||
            (leg.passengers != null &&
              (!Number.isInteger(leg.passengers) || leg.passengers < 1)),
        )
      ) {
        return NextResponse.json(
          { error: "Invalid route legs" },
          { status: 400 },
        );
      }
      const routeDistanceKm = submittedLegs.reduce(
        (sum, leg) => sum + leg.distanceKm,
        0,
      );
      if (!Number.isFinite(t.durationMinutes) || t.durationMinutes < 0) {
        return NextResponse.json(
          { error: "Invalid trip durationMinutes" },
          { status: 400 },
        );
      }
      const pickupTime = t.pickupTime;
      if (!pickupTime || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(pickupTime)) {
        return NextResponse.json(
          { error: "Invalid pickupTime" },
          { status: 400 },
        );
      }
      const arrivalTime = t.arrivalTime;
      if (!arrivalTime || !/^\d{2}:\d{2}$/.test(arrivalTime)) {
        return NextResponse.json(
          { error: "Invalid arrivalTime" },
          { status: 400 },
        );
      }
      let passengersOnboard = numberOfPassengers;
      const routeLegs = submittedLegs.map((submittedLeg, index) => {
        const leg = {
          distanceKm: submittedLeg.distanceKm,
          passengers: submittedLeg.passengers ?? passengersOnboard,
        };
        const stop = stops[index];
        if (stop) passengersOnboard += stop.boarding - stop.alighting;
        return leg;
      });
      const waitingMinutes = stops.reduce(
        (sum, stop) => sum + stop.waitingMinutes,
        0,
      );
      const priceEgp = computePrivateTripPriceEgp(
        routeLegs,
        waitingMinutes,
        vKey,
        vehiclesMap,
      );

      const zoneBasedStations = mapSettings.stationAssignmentMode === "zones";
      const pickupNeedsStation =
        zoneBasedStations && usesStationsForPoint(t.pickup, vKey);
      const dropoffNeedsStation =
        zoneBasedStations && usesStationsForPoint(t.dropoff, vKey);
      const pickupStationOptions = pickupNeedsStation
        ? findNearestStations(
            t.pickup.lat,
            t.pickup.lng,
            canonicalStations,
            vKey,
          )
        : [];
      const dropoffStationOptions = dropoffNeedsStation
        ? findNearestStations(
            t.dropoff.lat,
            t.dropoff.lng,
            canonicalStations,
            vKey,
          )
        : [];
      const selectedPickup = pickupStationOptions.find(
        (station) => station.id === t.pickupStation?.id,
      );
      const selectedDropoff = dropoffStationOptions.find(
        (station) => station.id === t.dropoffStation?.id,
      );
      if (
        (pickupNeedsStation && !selectedPickup) ||
        (dropoffNeedsStation && !selectedDropoff) ||
        (!pickupNeedsStation && t.pickupStation) ||
        (!dropoffNeedsStation && t.dropoffStation)
      ) {
        return NextResponse.json(
          {
            error:
              "The selected station no longer matches the configured zones. Please review the trip locations.",
          },
          { status: 400 },
        );
      }

      const nearPickup = zoneBasedStations
        ? selectedPickup
        : findNearestStation(
            t.pickup.lat,
            t.pickup.lng,
            canonicalStations,
            vKey,
          );
      const nearDropoff = zoneBasedStations
        ? selectedDropoff
        : findNearestStation(
            t.dropoff.lat,
            t.dropoff.lng,
            canonicalStations,
            vKey,
          );

      serverTrips.push({
        pickup: t.pickup,
        dropoff: t.dropoff,
        vehicleType: vKey,
        rideType: tripRideType,
        arrivalTime,
        pickupTime,
        distanceKm: routeDistanceKm,
        durationMinutes: Math.round(Number(t.durationMinutes)),
        ...(routeCoordinates && { routeCoordinates }),
        priceEgp,
        extraPassengers: 0,
        preferedGender,
        numberOfPassengers,
        stops,
        passengers: serverPassengers,
        ...(nearPickup && {
          pickupStation: stationPayload(nearPickup),
        }),
        ...(nearDropoff && {
          dropoffStation: stationPayload(nearDropoff),
        }),
        ...(pickupNeedsStation && {
          pickupStationOptions,
          walkingMinToStation: selectedPickup?.walkingMin,
        }),
        ...(dropoffNeedsStation && {
          dropoffStationOptions,
          walkingMinFromStation: selectedDropoff?.walkingMin,
        }),
      });
      continue;
    }

    if (!t.arrivalTime || !/^\d{2}:\d{2}$/.test(t.arrivalTime)) {
      return NextResponse.json(
        { error: "Invalid arrivalTime" },
        { status: 400 },
      );
    }
    const pickupNeedsStation = usesStationsForPoint(t.pickup, vKey);
    const dropoffNeedsStation = usesStationsForPoint(t.dropoff, vKey);
    if (
      (pickupNeedsStation && !Number.isInteger(t.pickupStation?.id)) ||
      (dropoffNeedsStation && !Number.isInteger(t.dropoffStation?.id)) ||
      (!pickupNeedsStation && t.pickupStation) ||
      (!dropoffNeedsStation && t.dropoffStation)
    ) {
      return NextResponse.json(
        {
          error:
            "The selected station no longer matches the configured zones. Please review the trip locations.",
        },
        { status: 400 },
      );
    }

    const pickupStationOptions = pickupNeedsStation
      ? findNearestStations(t.pickup.lat, t.pickup.lng, canonicalStations, vKey)
      : [];
    const dropoffStationOptions = dropoffNeedsStation
      ? findNearestStations(
          t.dropoff.lat,
          t.dropoff.lng,
          canonicalStations,
          vKey,
        )
      : [];
    const selectedPickup = pickupStationOptions.find(
      (station) => station.id === t.pickupStation?.id,
    );
    const selectedDropoff = dropoffStationOptions.find(
      (station) => station.id === t.dropoffStation?.id,
    );
    if (
      (pickupNeedsStation && !selectedPickup) ||
      (dropoffNeedsStation && !selectedDropoff)
    ) {
      return NextResponse.json(
        { error: "Invalid station selection" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(t.distanceKm) || t.distanceKm < 0) {
      return NextResponse.json(
        { error: "Invalid trip distanceKm" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(t.durationMinutes) || t.durationMinutes < 0) {
      return NextResponse.json(
        { error: "Invalid trip durationMinutes" },
        { status: 400 },
      );
    }
    const pickupTime = t.pickupTime;
    if (!pickupTime || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(pickupTime)) {
      return NextResponse.json(
        { error: "Invalid pickupTime" },
        { status: 400 },
      );
    }
    if (!t.arrivalTime || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t.arrivalTime)) {
      return NextResponse.json(
        { error: "Invalid arrivalTime" },
        { status: 400 },
      );
    }
    const arrivalMinutes = toMinutes(t.arrivalTime);
    if (
      arrivalMinutes < ARRIVAL_SLOT_START_MIN ||
      arrivalMinutes >= ARRIVAL_SLOT_END_MIN
    ) {
      return NextResponse.json(
        { error: "Invalid arrivalTime" },
        { status: 400 },
      );
    }
    const arrivalTime = snapToArrivalSlotMidpoint(t.arrivalTime);
    const priceEgp = computeTripPriceEgp({
      distanceKm: Number(t.distanceKm),
      vehicleType: vKey,
      extraPassengers: Math.max(0, Math.round(Number(t.extraPassengers ?? 0))),
      vehiclesMap,
    });
    const extraPassengers = Math.max(
      0,
      Math.round(Number(t.extraPassengers ?? 0)),
    );

    serverTrips.push({
      pickup: {
        address: t.pickup.address,
        lat: t.pickup.lat,
        lng: t.pickup.lng,
      },
      dropoff: {
        address: t.dropoff.address,
        lat: t.dropoff.lat,
        lng: t.dropoff.lng,
      },
      vehicleType: vKey,
      rideType: tripRideType,
      arrivalTime,
      pickupTime,
      distanceKm: Number(t.distanceKm),
      durationMinutes: Math.round(Number(t.durationMinutes)),
      ...(routeCoordinates && { routeCoordinates }),
      priceEgp,
      extraPassengers,
      preferedGender,
      numberOfPassengers,
      stops: [],
      passengers: [],
      ...(selectedPickup && {
        pickupStation: stationPayload(selectedPickup),
      }),
      ...(selectedDropoff && {
        dropoffStation: stationPayload(selectedDropoff),
      }),
      pickupStationOptions,
      dropoffStationOptions,
      ...(selectedPickup && {
        walkingMinToStation: selectedPickup.walkingMin,
      }),
      ...(selectedDropoff && {
        walkingMinFromStation: selectedDropoff.walkingMin,
      }),
    });
  }

  const batchId = randomUUID();
  const tripInstances = dates.map((date) => ({
    id: new Types.ObjectId(),
    date,
    cycleIndex: 0,
    trip: serverTrips[0],
  }));
  const batchCandidates = tripInstances.map((instance) => ({
    id: String(instance.id),
    date: instance.date,
    arrivalTime: instance.trip.arrivalTime,
    basePriceEgp: priceForSelectedDate(
      instance.trip.priceEgp,
      instance.date,
      dates,
    ),
    payload: instance,
  }));
  const hasSharedRide = serverTrips.some((trip) => trip.rideType === "shared");
  const settings = await AdminSettings.findOne()
    .select("sharedRideWaitingListEnabled")
    .lean<{ sharedRideWaitingListEnabled?: boolean } | null>();
  const sharedRideWaitingListEnabled = getSharedRideWaitingListEnabled(
    settings?.sharedRideWaitingListEnabled,
  );
  const isWaitingListTrip = shouldCreateWaitingListRequest(
    hasSharedRide,
    sharedRideWaitingListEnabled,
  );

  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection is unavailable");
    const spacingLockCollection =
      db.collection<TripSpacingLockDocument>("trip_spacing_locks");
    await ensureTripSpacingLockTtlIndex(spacingLockCollection);
    const lockIds = [
      ...dates.map((date) => `${userId}:${date}`),
      `${userId}:pending-cap`,
    ];
    for (const lockId of lockIds) {
      try {
        const now = new Date();
        await spacingLockCollection.updateOne(
          { _id: lockId },
          { $setOnInsert: spacingLockUpsertFields(now) },
          { upsert: true },
        );
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        const lock = await spacingLockCollection.findOne({ _id: lockId });
        if (!lock) throw error;
      }
    }

    const requestGroupEnabled = shouldCreateRequestGroup(
      isMultiDayRequestsEnabled(userId),
      dates.length,
    );
    const requestId = requestGroupEnabled ? new Types.ObjectId() : null;
    requestGroupEnabledForRequest = requestGroupEnabled;
    requestGroupIdForLog = requestId ? String(requestId) : null;
    requestGroupDateCount = dates.length;
    requestGroupTripCount = tripInstances.length;
    const batchStore = {
      async withTransaction<TResult>(
        work: (dbSession: ClientSession) => Promise<TResult>,
      ) {
        const dbSession = await mongoose.startSession();
        try {
          return await dbSession.withTransaction(() => work(dbSession));
        } finally {
          await dbSession.endSession();
        }
      },
      async acquireLocks(
        dbSession: ClientSession,
        selectedDates: readonly string[],
      ) {
        const selectedLockIds = [
          ...selectedDates.map((date) => `${userId}:${date}`),
          `${userId}:pending-cap`,
        ];
        for (const lockId of selectedLockIds) {
          const lockUpdate = await spacingLockCollection.updateOne(
            { _id: lockId },
            {
              $inc: { revision: 1 },
              $set: { updatedAt: new Date() },
            },
            { session: dbSession },
          );
          if (lockUpdate.matchedCount !== 1) {
            throw new Error(`Trip-spacing lock is missing: ${lockId}`);
          }
        }
      },
      async countPendingUnpaid(
        dbSession: ClientSession,
        pendingUserId: string,
      ) {
        return Trip.countDocuments({
          userId: new Types.ObjectId(pendingUserId),
          $or: [
            { status: { $in: ["pending_payment", "waiting_list"] } },
            {
              status: "approved",
              paymentStatus: { $nin: ["paid", "refunded"] },
            },
          ],
        }).session(dbSession);
      },
      async findSpacingWindows(
        dbSession: ClientSession,
        spacingUserId: string,
        selectedDates: readonly string[],
      ) {
        const existingTrips = await Trip.find({
          userId: new Types.ObjectId(spacingUserId),
          date: { $in: selectedDates },
          status: { $in: HOLDING_TRIP_STATUSES },
        })
          .select("date arrivalTime status requestId")
          .session(dbSession)
          .lean();
        return existingTrips.map((trip) => ({
          date: trip.date,
          arrivalTime: trip.arrivalTime,
          status: trip.status,
          requestId: trip.requestId ? String(trip.requestId) : null,
        }));
      },
      async applyPromo(
        dbSession: ClientSession,
        promoUserId: string,
        tripId: string,
      ) {
        if (!promoCode) return { success: false as const, message: "" };
        const result = await applyPromoCodeToTrip(
          promoCode,
          promoUserId,
          tripId,
          dbSession,
        );
        if (
          result.success &&
          result.discountType &&
          typeof result.discountValue === "number" &&
          result.promoCodeId &&
          result.usageId
        ) {
          return {
            success: true as const,
            discountType: result.discountType,
            discountValue: result.discountValue,
            promoCodeId: result.promoCodeId,
            usageId: result.usageId,
          };
        }
        return { success: false as const, message: result.message };
      },
      async insert(
        dbSession: ClientSession,
        documents: InstanceType<typeof Trip>[],
      ) {
        await Trip.insertMany(documents, { session: dbSession });
      },
    };
    const buildTripDocument = async (
      candidate: PreparedTripBatchCandidate<(typeof tripInstances)[number]>,
    ) => {
      const instance = candidate.payload;
      return new Trip({
        _id: instance.id,
        tripNumber: await nextSequence("tripNumber"),
        regionCode: userRegion,
        currencyCode: getCurrencyConfig(userRegion).code,
        userId: new Types.ObjectId(userId),
        date: candidate.date,
        cycleIndex: instance.cycleIndex,
        ...(requestId ? { requestId } : { batchId }),
        ...instance.trip,
        ...(note ? { note } : {}),
        basePriceEgp: candidate.basePriceEgp,
        priceEgp: candidate.priceEgp,
        ...(candidate.promoApply && {
          appliedPromoCode: new Types.ObjectId(
            candidate.promoApply.promoCodeId,
          ),
          promoDiscountType: candidate.promoApply.discountType,
          promoDiscountValue: candidate.promoApply.discountValue,
          promoDiscountAmountEgp: candidate.promoDiscountAmountEgp,
        }),
        ...getInitialTripBookingState(requestId ? false : isWaitingListTrip),
      });
    };
    const groupResult = requestId
      ? await createRequestGroupWith<
          ClientSession,
          InstanceType<typeof Trip>,
          InstanceType<typeof Request>,
          (typeof tripInstances)[number]
        >(
          {
            ...batchStore,
            async saveRequest(
              dbSession: ClientSession,
              request: InstanceType<typeof Request>,
            ) {
              await saveRequestGroup(request, dbSession);
            },
          },
          {
            userId,
            dates,
            allowedDates: bookingWindow(),
            routeCount: serverTrips.length,
            cycleCount: trips.length,
            candidates: batchCandidates,
            maxPendingUnpaidTrips: MAX_PENDING_UNPAID_TRIPS,
            promoCode,
            computeDiscountedPrice: computePromoDiscountedPrice,
            buildDocument: buildTripDocument,
            buildRequest: (candidates, documents, amountEgp) =>
              new Request({
                _id: requestId,
                userId: new Types.ObjectId(userId),
                regionCode: userRegion,
                currencyCode: getCurrencyConfig(userRegion).code,
                tripIds: documents.map((trip) => trip._id),
                dates: candidates.map((candidate) => candidate.date),
                amountEgp,
                note,
                paymentStatus: "pending",
                status: isWaitingListTrip ? "waiting_list" : "pending_payment",
              }),
          },
        )
      : null;
    const batchResult =
      groupResult ??
      (await createTripBatchWith<
        ClientSession,
        InstanceType<typeof Trip>,
        (typeof tripInstances)[number]
      >(batchStore, {
        userId,
        dates,
        candidates: batchCandidates,
        maxPendingUnpaidTrips: MAX_PENDING_UNPAID_TRIPS,
        promoCode,
        computeDiscountedPrice: computePromoDiscountedPrice,
        buildDocument: buildTripDocument,
      }));

    const tripDocuments = batchResult.documents;
    if (groupResult) {
      const requestId = String(groupResult.request._id);
      const tripIds = tripDocuments.map((trip) => String(trip._id));
      logMultiDayEvent({
        event: "group_created",
        requestId,
        userId,
        counts: { dates: dates.length, trips: tripIds.length },
      });
      const amountEgp = groupResult.request.amountEgp;
      const promoCodeAppliedTrips = groupResult.candidates.filter(
        (candidate) => candidate.promoApply,
      ).length;
      const promoCodeApplied = promoCodeAppliedTrips > 0;
      const promoCodePartiallyApplied =
        promoCodeAppliedTrips > 0 &&
        promoCodeAppliedTrips < groupResult.candidates.length;
      const promoCodeUnavailable = Boolean(promoCode) && !promoCodeApplied;
      const promoFailureMessage = groupResult.promoFailureMessage;

      if (isWaitingListTrip) {
        try {
          const routeSummary = `${serverTrips[0].pickup.address} → ${serverTrips[0].dropoff.address}`;
          await notifyAdminsOfWaitingListRequest({
            requestId,
            userId,
            tripCount: tripIds.length,
            date: dates[0],
            routeSummary,
          });
          const admins = await User.find({ role: "admin" })
            .select("_id")
            .lean();
          await createNotifications(
            admins.map((admin) => ({
              userId: String(admin._id),
              type: "waiting_list_created",
              title: "New multi-day shared-ride Request",
              body: `${tripIds.length} days are waiting for review: ${routeSummary}.`,
              titleAr: "طلب رحلة مشتركة متعدد الأيام",
              bodyAr: `${tripIds.length} أيام مستنية المراجعة: ${routeSummary}.`,
              data: {
                requestId,
                bookingId: requestId,
                tripIds,
                tripCount: tripIds.length,
                linkUrl: "/admin/waiting-list",
                linkLabel: "Review waiting list",
              },
            })),
          );
        } catch (error) {
          console.error(
            `[Waiting list] Admin notification failed for Request ${requestId}:`,
            error,
          );
        }
      }

      try {
        await createNotification({
          userId,
          type: "request_created",
          title: isWaitingListTrip
            ? "Your shared-ride Request was received"
            : "Your Request is ready for payment",
          body: isWaitingListTrip
            ? `Your ${tripIds.length}-day Request is waiting for review.`
            : `Your ${tripIds.length}-day Request is ready for payment.`,
          data: {
            requestId,
            bookingId: requestId,
            tripIds,
            linkUrl: "/my-trips",
            amountEgp,
            waitlist: isWaitingListTrip,
          },
        });
      } catch (error) {
        console.error(
          `[Trip booking] Passenger notification failed for Request ${requestId}:`,
          error,
        );
      }

      return NextResponse.json(
        {
          requestId,
          bookingId: requestId,
          tripIds,
          trips: tripDocuments.map((trip) => ({
            id: String(trip._id),
            tripNumber: trip.tripNumber,
            date: trip.date,
            priceEgp: trip.priceEgp,
            status: trip.status,
            paymentStatus: trip.paymentStatus,
          })),
          amountEgp,
          status: groupResult.request.status,
          paymentStatus: groupResult.request.paymentStatus,
          waitlist: isWaitingListTrip,
          requiresPayment: !isWaitingListTrip,
          promoCode,
          promoCodeApplied,
          promoCodeAppliedTrips,
          promoCodePartiallyApplied,
          promoCodeUnavailable,
          ...(promoFailureMessage
            ? { promoCodeMessage: promoFailureMessage }
            : {}),
        },
        { status: 201 },
      );
    }

    const batchResponse = buildTripBatchResponse({
      batchId,
      candidates: batchResult.candidates,
      waitlist: isWaitingListTrip,
    });
    const amountEgp = batchResponse.totalEgp;
    const promoCodeAppliedTrips = batchResult.candidates.filter(
      (candidate) => candidate.promoApply,
    ).length;
    const promoCodeApplied = promoCodeAppliedTrips > 0;
    const promoCodePartiallyApplied =
      promoCodeAppliedTrips > 0 &&
      promoCodeAppliedTrips < batchResult.candidates.length;
    const promoCodeUnavailable = Boolean(promoCode) && !promoCodeApplied;
    const promoFailureMessage = batchResult.promoFailureMessage;
    const tripIds = tripDocuments.map((trip) => String(trip._id));
    const representativeTripId = tripIds[0];

    if (isWaitingListTrip) {
      try {
        await notifyAdminsOfWaitingListTripBatch({
          batchId,
          userId,
          tripCount: tripIds.length,
          date: dates[0],
          routeSummary: `${serverTrips[0].pickup.address} → ${serverTrips[0].dropoff.address}`,
        });
        const admins = await User.find({ role: "admin" }).select("_id").lean();
        await createNotifications(
          buildWaitingListCreatedTripBatchAdminNotifications({
            adminIds: admins.map((admin) => String(admin._id)),
            tripId: representativeTripId,
            batchId,
            tripCount: tripIds.length,
            routeSummary: `${serverTrips[0].pickup.address} → ${serverTrips[0].dropoff.address}`,
            date: dates[0],
          }),
        );
      } catch (error) {
        console.error(
          `[Waiting list] Admin notification failed for batch ${batchId}:`,
          error,
        );
      }
    }
    try {
      await createNotification({
        userId,
        type: "request_created",
        title: isWaitingListTrip
          ? "Shared-ride trips received"
          : "Trips ready for payment",
        body: isWaitingListTrip
          ? `Your ${tripIds.length} shared-ride ${tripIds.length === 1 ? "trip is" : "trips are"} waiting for review.`
          : `Your ${tripIds.length} ${tripIds.length === 1 ? "trip is" : "trips are"} ready for payment.`,
        data: {
          batchId,
          tripIds,
          tripId: representativeTripId,
          linkUrl: "/my-trips",
          amountEgp,
          waitlist: isWaitingListTrip,
        },
      });
    } catch (error) {
      console.error(
        `[Trip booking] Passenger notification failed for trip ${representativeTripId}:`,
        error,
      );
    }

    return NextResponse.json(
      {
        ...batchResponse,
        ...(isWaitingListTrip
          ? {
              status: "waiting_list",
              requiresPayment: false,
            }
          : {}),
        promoCode,
        promoCodeApplied,
        promoCodeAppliedTrips,
        promoCodePartiallyApplied,
        promoCodeUnavailable,
        ...(promoFailureMessage
          ? { promoCodeMessage: promoFailureMessage }
          : {}),
      },
      { status: 201 },
    );
  } catch (err) {
    if (requestGroupEnabledForRequest) {
      const reason =
        err instanceof RequestGroupPromoError
          ? "REQUEST_PROMO_UNAVAILABLE"
          : err instanceof TripBatchSpacingConflictError
            ? "TRIP_SPACING_CONFLICT"
            : err instanceof TooManyPendingTripsError
              ? "TOO_MANY_PENDING_TRIPS"
              : isTransientBookingConflict(err)
                ? "BOOKING_BUSY"
                : "CREATION_FAILED";
      logMultiDayEvent({
        event: "group_create_rejected",
        requestId: requestGroupIdForLog,
        userId,
        counts: {
          dates: requestGroupDateCount,
          trips: requestGroupTripCount,
        },
        reason,
      });
    }
    if (err instanceof RequestGroupPromoError) {
      return NextResponse.json(
        {
          errorCode: "REQUEST_PROMO_UNAVAILABLE",
          error: err.message,
        },
        { status: 409 },
      );
    }
    if (err instanceof TripBatchSpacingConflictError) {
      return NextResponse.json(
        { error: "TRIP_SPACING_CONFLICT", conflict: err.conflict },
        { status: 409 },
      );
    }
    if (err instanceof TooManyPendingTripsError) {
      return NextResponse.json(
        {
          errorCode: "TOO_MANY_PENDING_TRIPS",
          error: "TOO_MANY_PENDING_TRIPS",
        },
        { status: 409 },
      );
    }
    if (isTransientBookingConflict(err)) {
      return NextResponse.json(
        {
          errorCode: "BOOKING_BUSY",
          error: "BOOKING_BUSY",
        },
        { status: 503, headers: { "Retry-After": "2" } },
      );
    }
    console.error("Trip booking failed:", err);
    return NextResponse.json(
      { error: "Failed to create trips" },
      { status: 500 },
    );
  }
}
