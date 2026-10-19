import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { getVehiclePassengerCapacity } from "@/lib/config/vehicles";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { Log } from "@/models/Log";
import { getSession } from "@/lib/auth/session";
import * as rideActions from "@/lib/services/rideActionHelpers";
import { creditReferralBonusIfEligible } from "@/lib/referral";
import { normalizeSharedRidePassengers } from "@/lib/services/sharedRideManifest";
import { notifyAdminsOfCompletedPaidTrip } from "@/lib/notifications/adminActivity";
import { notifyPassengersOfNoShowTrips } from "@/lib/notifications/noShowTrip";
import {
  getRideActionStatusDecision,
  shouldBlockRideActionForOpenIncident,
} from "@/lib/rideActionGuards";
import {
  getCompletableTripIds,
  getNoShowTripIds,
} from "@/lib/rideTripCompletion";
import {
  canMarkNoShow,
  NO_SHOW_MIN_WAIT_MINUTES,
} from "@/lib/noShowRules";
import {
  assertPickupPinSecret,
  verifyPin,
  PickupPinConfigError,
} from "@/lib/pickupPin";
import { decidePickupPinAttempt } from "@/lib/pickupPinAttempts";
import {
  createPickupPinAuditRecord,
  sanitizePickupPinFields,
} from "@/lib/pickupPinSafety";
import {
  planBoardingSeatAssignments,
} from "@/lib/seatAllocation";

interface RideRouteStop {
  address?: string;
  point: { address: string; lat: number; lng: number };
  alighting: number;
  boarding: number;
  waitingMinutes: number;
}

interface RidePassengerLike {
  tripId?: string | { toString(): string } | null;
  userId?: string | { toString(): string } | null;
  status?: string | null;
  arrivedAt?: Date | string | null;
  noShowAt?: Date | string | null;
  numberOfPassengers?: number | null;
  pickupOrder?: number | null;
  dropoffOrder?: number | null;
  pickupStation?: {
    id?: number | null;
    name?: string | null;
    address?: string | null;
  } | null;
  dropoffStation?: {
    id?: number | null;
    name?: string | null;
    address?: string | null;
  } | null;
  seatNumbers?: number[] | null;
}

interface RideDocLike {
  passengers?: RidePassengerLike[];
  route?: RideRouteStop[];
  vehicleType?: string;
  vehicleCapacity?: number;
  driverId?: string;
  rideType?: string;
  status?: string;
}

// Appends an audit entry directly on the ride document (saved with the caller's .save()).
function pushRideLog(
  rideDoc: { logs?: { push(entry: unknown): void } },
  entry: {
    action: string;
    tripId?: unknown;
    userId?: unknown;
    stationIndex?: number;
    stationName?: string;
    previousStatus?: string;
    newStatus?: string;
    metadata?: Record<string, unknown>;
  },
) {
  rideDoc.logs?.push({ ...entry, createdAt: new Date() });
}

function noShowTooEarlyResponse(
  arrivedAt: Date | string | null | undefined,
  tripId?: string,
) {
  const decision = canMarkNoShow({
    arrivedAt,
    now: new Date(),
    minWaitMinutes: NO_SHOW_MIN_WAIT_MINUTES,
  });
  return NextResponse.json(
    {
      success: false,
      errorCode: "NO_SHOW_TOO_EARLY",
      error: "Wait at the pickup before marking the passenger as not present.",
      remainingSeconds: decision.remainingSeconds,
      arrivedAt:
        arrivedAt instanceof Date
          ? arrivedAt.toISOString()
          : typeof arrivedAt === "string" && Number.isFinite(Date.parse(arrivedAt))
            ? new Date(arrivedAt).toISOString()
            : null,
      ...(tripId ? { tripId } : {}),
    },
    { status: 409 },
  );
}

function materializeSharedRidePassengers(ride: {
  rideType?: string;
  toObject(): Record<string, unknown>;
  set(path: string, value: unknown): void;
}) {
  if (ride.rideType !== "shared") return;
  ride.set("passengers", normalizeSharedRidePassengers(ride.toObject()));
}

interface RideLogLike {
  action?: string;
  stationIndex?: number;
  createdAt?: Date;
}

function getPassengerStatus(
  passenger: RidePassengerLike | null | undefined,
): string {
  return String(passenger?.status ?? "waiting").toLowerCase();
}

function normalizeStationValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

type PickupPinTrip = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  status: string;
  pinVersion?: number;
  pinFailedAttempts?: number;
  pinLockedUntil?: Date | null;
};

async function logPickupPinEvent(
  trip: PickupPinTrip,
  rideId: string,
  driverId: string,
  action: "pickup_pin_ok" | "pickup_pin_failed" | "pickup_pin_lockout",
  failedAttempts?: number,
) {
  await Log.create(
    createPickupPinAuditRecord({
      tripId: trip._id,
      rideId,
      userId: trip.userId,
      driverId,
      status: trip.status,
      action,
      failedAttempts,
    }),
  );
}

function pickupPinAttemptFilter(trip: PickupPinTrip, rideId: string) {
  const filter: Record<string, unknown> = {
    _id: trip._id,
    rideId,
    status: { $in: ["confirmed", "active"] },
    pinLockedUntil: trip.pinLockedUntil ?? null,
  };
  const conditions: Record<string, unknown>[] = [];
  const version = trip.pinVersion ?? 0;
  if (version === 0) {
    conditions.push({
      $or: [{ pinVersion: 0 }, { pinVersion: { $exists: false } }],
    });
  } else {
    filter.pinVersion = version;
  }

  const failedAttempts = trip.pinFailedAttempts ?? 0;
  if (failedAttempts === 0) {
    conditions.push({
      $or: [
        { pinFailedAttempts: 0 },
        { pinFailedAttempts: { $exists: false } },
      ],
    });
  } else {
    filter.pinFailedAttempts = failedAttempts;
  }
  if (conditions.length) filter.$and = conditions;
  return filter;
}

async function recordPickupPinFailure(
  tripId: Types.ObjectId,
  rideId: string,
  driverId: string,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const trip = await Trip.findOne({ _id: tripId, rideId })
      .select("userId status pinVersion pinFailedAttempts pinLockedUntil")
      .lean<PickupPinTrip | null>();
    if (!trip) return { kind: "trip_changed" as const };

    const now = new Date();
    const decision = decidePickupPinAttempt(
      {
        failedAttempts: trip.pinFailedAttempts ?? 0,
        lockedUntil: trip.pinLockedUntil,
      },
      false,
      now,
    );
    if (decision.kind === "locked" && !decision.lockoutStarted) {
      return decision;
    }

    const update: Record<string, unknown> = {
      $set: { pinFailedAttempts: decision.failedAttempts },
      $unset: { pinLockedUntil: 1 },
    };
    if (decision.kind === "locked") {
      update.$set = {
        pinFailedAttempts: decision.failedAttempts,
        pinLockedUntil: decision.lockedUntil,
      };
      update.$unset = {};
    }

    const updatedTrip = await Trip.findOneAndUpdate(
      pickupPinAttemptFilter(trip, rideId),
      update,
      {
      new: true,
      },
    )
      .select("userId status pinVersion pinFailedAttempts pinLockedUntil")
      .lean<PickupPinTrip | null>();
    if (!updatedTrip) continue;

    await logPickupPinEvent(
      updatedTrip,
      rideId,
      driverId,
      "pickup_pin_failed",
      decision.failedAttempts,
    );
    if (decision.kind === "locked" && decision.lockoutStarted) {
      await logPickupPinEvent(
        updatedTrip,
        rideId,
        driverId,
        "pickup_pin_lockout",
        decision.failedAttempts,
      );
    }
    return decision;
  }
  return { kind: "trip_changed" as const };
}

async function resetPickupPinAttempts(
  trip: PickupPinTrip,
  rideId: string,
): Promise<"reset" | "locked" | "changed"> {
  const now = new Date();
  if (trip.pinLockedUntil && trip.pinLockedUntil.getTime() > now.getTime()) {
    return "locked";
  }

  const updated = await Trip.findOneAndUpdate(
    pickupPinAttemptFilter(trip, rideId),
    {
      $set: { pinFailedAttempts: 0 },
      $unset: { pinLockedUntil: 1 },
    },
    { new: true },
  )
    .select("_id")
    .lean();
  if (updated) return "reset";

  const current = await Trip.findById(trip._id)
    .select("pinLockedUntil")
    .lean<{ pinLockedUntil?: Date | null } | null>();
  return current?.pinLockedUntil &&
    current.pinLockedUntil.getTime() > now.getTime()
    ? "locked"
    : "changed";
}

function getPassengerStationKey(
  passenger: RidePassengerLike | null | undefined,
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
    direction === "pickup"
      ? passenger?.pickupStation
      : passenger?.dropoffStation;

  if (
    typeof station?.id === "number" &&
    Number.isFinite(station.id) &&
    station.id > 0
  ) {
    return { type: "id" as const, value: station.id };
  }

  const stationName = station?.name ?? station?.address ?? null;
  if (stationName) {
    return { type: "name" as const, value: stationName };
  }

  return null;
}

function stationMatchesPassenger(
  passenger: RidePassengerLike | null | undefined,
  stationIndex: number,
  stationName: string | null | undefined,
  direction: "pickup" | "dropoff",
) {
  const stationReference = getPassengerStationKey(passenger, direction);
  if (!stationReference) {
    return false;
  }

  if (stationReference.type === "order") {
    return stationIndex === stationReference.value;
  }

  if (stationReference.type === "id") {
    return false;
  }

  const normalizedStationName = normalizeStationValue(stationName);
  const normalizedPassengerStation = normalizeStationValue(
    stationReference.value,
  );

  return (
    Boolean(normalizedStationName) &&
    normalizedStationName === normalizedPassengerStation
  );
}

function getRemainingStations(ride: RideDocLike | null | undefined) {
  const route = Array.isArray(ride?.route) ? ride.route : [];
  const remainingStationKeys = new Set<number>();

  for (const passenger of ride?.passengers ?? []) {
    const status = getPassengerStatus(passenger);

    if (status === "waiting") {
      const pickupKey = getPassengerStationKey(passenger, "pickup");
      if (!pickupKey) {
        continue;
      }

      for (const [index, stop] of route.entries()) {
        const stationIndex = index + 1;
        const stationName = stop?.point?.address ?? stop?.address ?? null;

        if (
          (pickupKey.type === "order" && stationIndex === pickupKey.value) ||
          (pickupKey.type === "name" &&
            normalizeStationValue(stationName) ===
              normalizeStationValue(pickupKey.value))
        ) {
          remainingStationKeys.add(stationIndex);
        }
      }
    }

    if (["picked_up", "boarding", "on_board"].includes(status)) {
      const dropoffKey = getPassengerStationKey(passenger, "dropoff");
      if (!dropoffKey) {
        continue;
      }

      for (const [index, stop] of route.entries()) {
        const stationIndex = index + 1;
        const stationName = stop?.point?.address ?? stop?.address ?? null;

        if (
          (dropoffKey.type === "order" && stationIndex === dropoffKey.value) ||
          (dropoffKey.type === "name" &&
            normalizeStationValue(stationName) ===
              normalizeStationValue(dropoffKey.value))
        ) {
          remainingStationKeys.add(stationIndex);
        }
      }
    }
  }

  return route
    .map((stop: RideRouteStop, index: number) => {
      const stationIndex = index + 1;
      if (!remainingStationKeys.has(stationIndex)) {
        return null;
      }
      return {
        stationIndex,
        stationName: stop?.point?.address ?? `Station ${stationIndex}`,
      };
    })
    .filter(Boolean) as Array<{ stationIndex: number; stationName: string }>;
}

function getSeatCapacity(ride: RideDocLike): number {
  return getVehiclePassengerCapacity(ride.vehicleType ?? "");
}

/**
 * GET /api/actions/ride/:rideId
 * Get the next action/prompt for the driver based on current ride state
 * Returns:
 * - For shared rides: station information and boarding/alighting counts
 * - For private rides: pickup/stop point information
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ rideId: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    await connectDB();

    const { rideId } = await context.params;

    // Fetch ride
    const ride = await Ride.findById(rideId)
      .populate("passengers.tripId")
      .lean<RideDocLike | null>();

    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride not found" },
        { status: 404 },
      );
    }

    // Verify driver owns this ride
    if (ride.driverId?.toString() !== session.userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden - not your ride" },
        { status: 403 },
      );
    }

    // Get ride logs to determine current progress
    const { Log } = await import("@/models/Log");
    const logs = await Log.find({ rideId }).sort({ createdAt: -1 }).lean();

    const lastLog = logs[0];

    // Determine next action based on ride type and current state
    let nextAction: Record<string, unknown> = {};

    if (ride.rideType === "shared") {
      nextAction = getNextSharedRideAction(ride, logs, lastLog);
    } else if (ride.rideType === "private") {
      nextAction = getNextPrivateRideAction(ride, logs, lastLog);
    }

    return NextResponse.json(
      {
        success: true,
        rideId,
        currentStatus: ride.status,
        rideType: ride.rideType,
        nextAction,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GET /api/actions/ride/:rideId]", error);
    return NextResponse.json(
      { success: false, error: "Failed to get next action" },
      { status: 500 },
    );
  }
}

/**
 * Determine next action for shared rides
 */
function getNextSharedRideAction(
  ride: RideDocLike & { route?: RideRouteStop[] },
  logs: RideLogLike[],
  lastLog?: RideLogLike,
) {
  const route = ride.route as RideRouteStop[];

  // Check if ride hasn't started yet
  if (!lastLog || lastLog.action === "matched") {
    return {
      type: "start_ride",
      label: "Start Ride",
      description: "Press to begin the ride",
      timestamp: new Date(),
    };
  }

  // Find last station arrived at
  let lastStationIndex = -1;
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].action === "station_arrived") {
      lastStationIndex = logs[i].stationIndex || -1;
      break;
    }
  }

  // If no station arrived yet, prompt first station
  if (lastStationIndex === -1 && route.length > 0) {
    return {
      type: "station_arrived",
      stationIndex: 0,
      stationName: route[0].point.address,
      requiresBoardingAlighting: true,
      allowBoarding: true,
      allowAlighting: false, // First station: no alighting
      nextStationIndex: 0,
      timestamp: new Date(),
    };
  }

  // If we've arrived at the last station, prompt end ride
  if (lastStationIndex === route.length - 1) {
    return {
      type: "end_ride",
      label: "End Ride",
      description: "Press to complete the ride",
      timestamp: new Date(),
    };
  }

  // Otherwise, prompt next station
  const nextStationIndex = lastStationIndex + 1;
  if (nextStationIndex < route.length) {
    const isLastStation = nextStationIndex === route.length - 1;

    return {
      type: "station_arrived",
      stationIndex: nextStationIndex,
      stationName: route[nextStationIndex].point.address,
      requiresBoardingAlighting: true,
      allowBoarding: !isLastStation, // Last station: no boarding
      allowAlighting: true,
      nextStationIndex,
      timestamp: new Date(),
    };
  }

  // Default: end ride
  return {
    type: "end_ride",
    label: "End Ride",
    description: "Press to complete the ride",
    timestamp: new Date(),
  };
}

/**
 * Determine next action for private rides
 */
function getNextPrivateRideAction(
  ride: RideDocLike & { route?: RideRouteStop[] },
  logs: RideLogLike[],
  lastLog?: RideLogLike,
) {
  const route = ride.route as RideRouteStop[];

  // Check if ride hasn't started yet
  if (!lastLog || lastLog.action === "matched") {
    return {
      type: "start_ride",
      label: "Start Ride",
      description: "Press to begin the ride",
      timestamp: new Date(),
    };
  }

  // Check if we need to go to first passenger pickup
  const firstPickupLog = logs.find(
    (log) => log.action === "pickup_arrived" && (log.stationIndex ?? -1) === 0,
  );

  if (!firstPickupLog && route.length > 0) {
    return {
      type: "pickup_arrived",
      pickupAddress: route[0].point.address,
      passengerIndex: 0,
      requiresPickupConfirmation: true,
      options: ["Passenger picked up", "No show"],
      timestamp: new Date(),
    };
  }

  // Find last stop point we've handled
  let lastStopIndex = -1;
  for (let i = logs.length - 1; i >= 0; i--) {
    if (
      logs[i].action === "stop_point_arrived" ||
      logs[i].action === "passenger_picked_up"
    ) {
      lastStopIndex = (logs[i].stationIndex ?? -1) + 1;
      break;
    }
  }

  // Check if there are more stop points
  if (lastStopIndex < route.length) {
    const isLastStop = lastStopIndex === route.length - 1;

    return {
      type: "stop_point_arrived",
      stationIndex: lastStopIndex,
      stationName: route[lastStopIndex].point.address,
      isLastStop,
      requiresBoardingAlighting: true,
      allowBoarding: !isLastStop,
      allowAlighting: true,
      timestamp: new Date(),
    };
  }

  // All stops handled - prompt end ride
  return {
    type: "end_ride",
    label: "End Ride",
    description: "Press to complete the ride",
    timestamp: new Date(),
  };
}

/**
 * POST /api/actions/ride/:rideId
 * Process a driver action and create corresponding log
 * Body:
 *   - action: string (start_ride, station_arrived, pickup_arrived, stop_point_arrived, end_ride)
 *   - tripId?: ObjectId (for trip-specific actions)
 *   - stationIndex?: number
 *   - stationName?: string
 *   - boardingCount?: number
 *   - alightingCount?: number
 *   - pickupConfirmation?: 'picked_up' | 'no_show'
 *   - metadata?: object
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ rideId: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    await connectDB();

    const { rideId } = await context.params;
    const body = await request.json();

    // Fetch ride
    const ride = await Ride.findById(rideId).lean();

    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride not found" },
        { status: 404 },
      );
    }

    // Verify driver owns this ride
    if (ride.driverId?.toString() !== session.userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden - not your ride" },
        { status: 403 },
      );
    }

    const {
      action,
      tripId,
      stationIndex,
      stationName,
      boardingCount,
      alightingCount,
      metadata = {},
    } = body;
    const safeMetadata = sanitizePickupPinFields(metadata) as Record<
      string,
      unknown
    >;

    const boardingIntent =
      (action === "boarding_alighting" && Number(boardingCount) > 0) ||
      (action === "station_arrived" &&
        Array.isArray(metadata?.confirmations) &&
        metadata.confirmations.some(
          (confirmation: { status?: unknown }) =>
            confirmation?.status === "arrived",
        ));
    const statusDecision = getRideActionStatusDecision(
      typeof action === "string" ? action : "",
      ride.status,
      ride.hasOpenIncident === true,
      boardingIntent,
    );
    if (statusDecision.kind === "unknown_action") {
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}` },
        { status: 400 },
      );
    }
    if (statusDecision.kind === "idempotent") {
      return NextResponse.json({
        success: true,
        message: action === "start_ride" ? "Ride already started" : "Ride already completed",
        action: action === "start_ride" ? "ride_started" : "ride_completed",
        data: ride,
      });
    }
    if (statusDecision.kind === "incident_open") {
      return NextResponse.json(
        {
          success: false,
          errorCode: "INCIDENT_OPEN",
          error: "Ride actions are paused while the incident is being reviewed.",
        },
        { status: 409 },
      );
    }
    if (statusDecision.kind === "conflict") {
      return NextResponse.json(
        {
          success: false,
          errorCode: "RIDE_ACTION_STATUS_CONFLICT",
          error: `Action ${action} is not allowed when ride status is ${ride.status}.`,
        },
        { status: 409 },
      );
    }

    const actionPassengers = normalizeSharedRidePassengers(
      ride as Record<string, unknown>,
    ) as unknown as RidePassengerLike[];
    const tripIds = actionPassengers
      .map((passenger: RidePassengerLike) =>
        typeof passenger.tripId === "object" &&
        passenger.tripId !== null &&
        "_id" in (passenger.tripId as object)
          ? (passenger.tripId as { _id: unknown })._id
          : passenger.tripId,
      )
      .filter(Boolean) as (string | Types.ObjectId)[];

    if (
      action === "station_arrived" &&
      (stationIndex === undefined ||
        stationIndex === null ||
        typeof stationName !== "string" ||
        !stationName)
    ) {
      return NextResponse.json(
        { success: false, errorCode: "STATION_DETAILS_REQUIRED", error: "Missing stationIndex or stationName." },
        { status: 400 },
      );
    }

    const arrivedConfirmations: Array<{ tripId?: unknown; pin?: unknown }> =
      action === "station_arrived" && Array.isArray(metadata?.confirmations)
        ? metadata.confirmations.filter(
            (confirmation: { status?: unknown }) =>
              confirmation?.status === "arrived",
          )
        : action === "passenger_picked_up"
          ? [{ tripId, pin: body.pin }]
          : [];
    if (action === "station_arrived") {
      const arrivingTripIds = arrivedConfirmations
        .map((confirmation) => String(confirmation.tripId ?? ""))
        .filter((targetTripId) => {
          const passenger = actionPassengers.find(
            (entry) => String(entry.tripId) === targetTripId,
          );
          return Boolean(
            passenger?.status === "waiting" &&
              stationMatchesPassenger(
                passenger,
                Number(stationIndex),
                stationName,
                "pickup",
              ),
          );
        });
      const routeLength = Array.isArray(ride.route) ? ride.route.length : 0;
      const isLastStation =
        routeLength > 0 && Number(stationIndex) === routeLength;
      const releasingTripIds = actionPassengers
        .filter(
          (passenger) =>
            ["boarding", "on_board", "picked_up"].includes(
              getPassengerStatus(passenger),
            ) &&
            ((getPassengerStatus(passenger) === "boarding" ||
              getPassengerStatus(passenger) === "picked_up") &&
              stationMatchesPassenger(
                passenger,
                Number(stationIndex),
                stationName,
                "pickup",
              )
              ? false
              : stationMatchesPassenger(
                  passenger,
                  Number(stationIndex),
                  stationName,
                  "dropoff",
                ) || isLastStation),
        )
        .map((passenger) => String(passenger.tripId));
      const seatPlan = planBoardingSeatAssignments({
        capacity: getSeatCapacity(ride),
        passengers: actionPassengers.map((passenger) => ({
          tripId: String(passenger.tripId),
          status: getPassengerStatus(passenger),
          seatNumbers: passenger.seatNumbers,
          numberOfPassengers: passenger.numberOfPassengers ?? 1,
        })),
        boardingTripIds: arrivingTripIds,
        releasingTripIds,
      });
      if (!seatPlan.ok) {
        return NextResponse.json(
          {
            success: false,
            errorCode: "SEATS_UNAVAILABLE",
            error: "Not enough seats are available for this group.",
          },
          { status: 409 },
        );
      }
    }
    const pinConfirmations = arrivedConfirmations.map((confirmation) => ({
      tripId: confirmation.tripId,
      pin:
        confirmation.pin ??
        (arrivedConfirmations.length === 1 ? body.pin : undefined),
    }));
    const verifiedPinTrips: Array<{
      tripId: Types.ObjectId;
      pinVersion: number;
      trip: PickupPinTrip;
    }> = [];

    for (const confirmation of pinConfirmations) {
      if (
        typeof confirmation.tripId !== "string" ||
        !Types.ObjectId.isValid(confirmation.tripId)
      ) {
        return NextResponse.json(
          { success: false, errorCode: "PICKUP_PIN_TRIP_REQUIRED", error: "A valid trip is required for pickup verification." },
          { status: 400 },
        );
      }
      const targetId = new Types.ObjectId(confirmation.tripId);
      if (
        verifiedPinTrips.some(
          (verifiedTrip) => String(verifiedTrip.tripId) === String(targetId),
        )
      ) {
        continue;
      }
      const passenger = actionPassengers.find(
        (entry) => String(entry.tripId) === String(targetId),
      );
      if (!passenger) {
        return NextResponse.json(
          { success: false, errorCode: "TRIP_NOT_IN_RIDE", error: "Trip is not part of this ride." },
          { status: 403 },
        );
      }
      const passengerAlreadyBoarded = [
        "boarding",
        "on_board",
        "picked_up",
      ].includes(getPassengerStatus(passenger));
      if (
        action === "station_arrived" &&
        !passengerAlreadyBoarded &&
        (passenger.status !== "waiting" ||
          !stationMatchesPassenger(
            passenger,
            Number(stationIndex),
            stationName,
            "pickup",
          ))
      ) {
        return NextResponse.json(
          { success: false, errorCode: "TRIP_NOT_PICKING_UP_HERE", error: "Trip is not boarding at this station." },
          { status: 409 },
        );
      }

      const targetTrip = await Trip.findOne({
        _id: targetId,
        rideId: ride._id,
        status: { $in: ["confirmed", "active"] },
      })
        .select("userId status pinVersion pinFailedAttempts pinLockedUntil")
        .lean<PickupPinTrip | null>();
      if (!targetTrip) {
        return NextResponse.json(
          { success: false, errorCode: "TRIP_NOT_ELIGIBLE", error: "Trip is not eligible for pickup verification." },
          { status: 409 },
        );
      }

      const now = new Date();
      const attemptDecision = decidePickupPinAttempt(
        {
          failedAttempts: targetTrip.pinFailedAttempts ?? 0,
          lockedUntil: targetTrip.pinLockedUntil,
        },
        false,
        now,
      );
      if (attemptDecision.kind === "locked" && !attemptDecision.lockoutStarted) {
        return NextResponse.json(
          { success: false, errorCode: "PICKUP_PIN_LOCKED", error: "Pickup PIN verification is temporarily locked." },
          { status: 429 },
        );
      }
      if (confirmation.pin === undefined || confirmation.pin === null || confirmation.pin === "") {
        return NextResponse.json(
          { success: false, errorCode: "PICKUP_PIN_REQUIRED", error: "Enter the passenger's four-digit pickup PIN." },
          { status: 400 },
        );
      }
      assertPickupPinSecret();
      if (
        !verifyPin(
          confirmation.pin,
          String(targetTrip._id),
          String(ride._id),
          targetTrip.pinVersion ?? 0,
        )
      ) {
        const failure = await recordPickupPinFailure(
          targetId,
          String(ride._id),
          String(ride.driverId),
        );
        if (failure.kind === "trip_changed") {
          return NextResponse.json(
            { success: false, errorCode: "PICKUP_PIN_RETRY", error: "Trip changed during PIN verification. Please retry." },
            { status: 409 },
          );
        }
        return NextResponse.json(
          {
            success: false,
            errorCode:
              failure.kind === "locked"
                ? "PICKUP_PIN_LOCKED"
                : "PICKUP_PIN_INVALID",
            error:
              failure.kind === "locked"
                ? "Pickup PIN verification is temporarily locked."
                : "The pickup PIN is incorrect.",
          },
          { status: failure.kind === "locked" ? 429 : 400 },
        );
      }
      verifiedPinTrips.push({
        tripId: targetId,
        pinVersion: targetTrip.pinVersion ?? 0,
        trip: targetTrip,
      });
    }

    for (const verifiedTrip of verifiedPinTrips) {
      const resetResult = await resetPickupPinAttempts(
        verifiedTrip.trip,
        String(ride._id),
      );
      if (resetResult !== "reset") {
        return NextResponse.json(
          {
            success: false,
            errorCode:
              resetResult === "locked"
                ? "PICKUP_PIN_LOCKED"
                : "PICKUP_PIN_RETRY",
            error:
              resetResult === "locked"
                ? "Pickup PIN verification is temporarily locked."
                : "Trip changed during PIN verification. Please retry.",
          },
          { status: resetResult === "locked" ? 429 : 409 },
        );
      }
      await logPickupPinEvent(
        verifiedTrip.trip,
        String(ride._id),
        String(ride.driverId),
        "pickup_pin_ok",
      );
    }

    const startLocation =
      action === "start_ride" ? safeMetadata?.currentLocation ?? null : null;
    const endLocation =
      action === "end_ride" ? safeMetadata?.currentLocation ?? null : null;
    const rideLog =
      action === "start_ride"
        ? {
            action: "ride_started",
            metadata: { currentLocation: startLocation },
            createdAt: new Date(),
          }
        : action === "end_ride"
          ? {
              action: "ride_completed",
              metadata: { currentLocation: endLocation },
              createdAt: new Date(),
            }
          : null;
    const rideUpdate: Record<string, unknown> = {
      $inc: { __v: 1 },
    };
    if (action === "start_ride") {
      rideUpdate.$set = {
        status: "active",
        ...(startLocation ? { driverOrigin: startLocation } : {}),
      };
    } else if (action === "end_ride") {
      rideUpdate.$set = {
        status: "completed",
        completedAt: new Date(),
        ...(endLocation ? { driverDestination: endLocation } : {}),
      };
    }
    if (rideLog) rideUpdate.$push = { logs: rideLog };

    const versionFilter =
      typeof ride.__v === "number"
        ? { __v: ride.__v }
        : { __v: { $exists: false } };
    const incidentGuard = shouldBlockRideActionForOpenIncident(
      action,
      true,
      boardingIntent,
    )
      ? { hasOpenIncident: { $ne: true } }
      : {};
    const claimedRide = await Ride.findOneAndUpdate(
      {
        _id: rideId,
        driverId: ride.driverId,
        status: statusDecision.expectedStatus,
        ...incidentGuard,
        ...versionFilter,
      },
      rideUpdate,
      { new: true },
    ).lean();

    if (!claimedRide) {
      const currentRide = await Ride.findById(rideId).lean();
      if (!currentRide) {
        return NextResponse.json(
          { success: false, error: "Ride not found" },
          { status: 404 },
        );
      }
      if (currentRide.driverId?.toString() !== session.userId) {
        return NextResponse.json(
          { success: false, error: "Forbidden - not your ride" },
          { status: 403 },
        );
      }
      const currentDecision = getRideActionStatusDecision(
        action,
        currentRide.status,
        currentRide.hasOpenIncident === true,
        boardingIntent,
      );
      if (currentDecision.kind === "idempotent") {
        return NextResponse.json({
          success: true,
          message: action === "start_ride" ? "Ride already started" : "Ride already completed",
          action: action === "start_ride" ? "ride_started" : "ride_completed",
          data: currentRide,
        });
      }
      if (currentDecision.kind === "incident_open") {
        return NextResponse.json(
          {
            success: false,
            errorCode: "INCIDENT_OPEN",
            error: "Ride actions are paused while the incident is being reviewed.",
          },
          { status: 409 },
        );
      }
      return NextResponse.json(
        {
          success: false,
          errorCode: "RIDE_ACTION_STATUS_CONFLICT",
          error: `Ride changed while processing action ${action}; current status is ${currentRide.status}.`,
        },
        { status: 409 },
      );
    }

    const driverId = ride.driverId;
    let result: Record<string, unknown> = { success: false };
    let stationSeatAssignments: Record<string, number[]> = {};

    switch (action) {
      case "start_ride":
        // Log ride start for all trips
        await rideActions.logRideStarted(rideId, tripIds, driverId, safeMetadata);

        const originLoc = startLocation;
        const rideDoc = await Ride.findById(rideId);
        if (rideDoc) {
          materializeSharedRidePassengers(rideDoc);
          rideDoc.status = "active";
          if (originLoc) {
            rideDoc.driverOrigin = originLoc;
          }
          for (const passenger of rideDoc.passengers ?? []) {
            passenger.status = "waiting";
            passenger.seatNumbers = [];
          }
          await rideDoc.save();
        }

        result = {
          success: true,
          message: "Ride started",
          action: "ride_started",
        };
        break;

      case "confirm_no_show_arrival": {
        const parsedTripId = Types.ObjectId.isValid(String(tripId))
          ? new Types.ObjectId(String(tripId))
          : null;
        const parsedStationIndex = Number(stationIndex);
        if (
          !parsedTripId ||
          !Number.isInteger(parsedStationIndex) ||
          parsedStationIndex < 1
        ) {
          return NextResponse.json(
            { success: false, errorCode: "INVALID_ARRIVAL", error: "A valid passenger and pickup stop are required." },
            { status: 400 },
          );
        }

        const passenger = actionPassengers.find(
          (candidate) =>
            candidate.tripId?.toString?.() === parsedTripId.toString(),
        );
        if (
          !passenger ||
          passenger.status !== "waiting" ||
          !stationMatchesPassenger(
            passenger,
            parsedStationIndex,
            stationName,
            "pickup",
          )
        ) {
          return NextResponse.json(
            { success: false, errorCode: "PASSENGER_NOT_WAITING", error: "The passenger is not waiting at this pickup stop." },
            { status: 409 },
          );
        }

        const arrivedAt = new Date();
        const arrivalUpdate = await Ride.updateOne(
          {
            _id: rideId,
            driverId: ride.driverId,
            status: "active",
            passengers: {
              $elemMatch: {
                tripId: parsedTripId,
                status: "waiting",
                arrivedAt: null,
              },
            },
          },
          {
            $set: { "passengers.$.arrivedAt": arrivedAt },
            $push: {
              logs: {
                action: "no_show_wait_started",
                tripId: parsedTripId,
                userId: passenger.userId,
                stationIndex: parsedStationIndex,
                previousStatus: "waiting",
                newStatus: "waiting",
                createdAt: arrivedAt,
              },
            },
          },
        );

        let recordedArrival: Date | string | null | undefined;
        if (arrivalUpdate.modifiedCount > 0) {
          recordedArrival = arrivedAt;
        } else {
          const latestRide = await Ride.findById(rideId)
            .select("passengers")
            .lean();
          const latestPassenger = (
            latestRide?.passengers as unknown as
              | RidePassengerLike[]
              | undefined
          )?.find(
            (candidate) =>
              candidate.tripId?.toString?.() === parsedTripId.toString(),
          );
          if (
            latestPassenger?.status === "waiting" &&
            latestPassenger.arrivedAt
          ) {
            recordedArrival = latestPassenger.arrivedAt;
          }
        }
        if (!recordedArrival) {
          return NextResponse.json(
            { success: false, errorCode: "PASSENGER_NOT_WAITING", error: "The passenger is no longer waiting at this pickup stop." },
            { status: 409 },
          );
        }
        const decision = canMarkNoShow({
          arrivedAt: recordedArrival,
          now: new Date(),
          minWaitMinutes: NO_SHOW_MIN_WAIT_MINUTES,
        });
        result = {
          success: true,
          action: "no_show_wait_started",
          arrivedAt:
            recordedArrival instanceof Date
              ? recordedArrival.toISOString()
              : recordedArrival,
          remainingSeconds: decision.remainingSeconds,
        };
        break;
      }

      case "station_arrived":
        if (
          stationIndex === undefined ||
          stationIndex === null ||
          !stationName
        ) {
          return NextResponse.json(
            { success: false, error: "Missing stationIndex or stationName" },
            { status: 400 },
          );
        }

        const currentRideDoc = await Ride.findById(rideId);
        let remainingStations: Array<{
          stationIndex: number;
          stationName: string;
        }> = [];
        if (currentRideDoc) {
          materializeSharedRidePassengers(currentRideDoc);
          const currentPassengers =
            currentRideDoc.passengers as unknown as RidePassengerLike[];
          const routeLength = Array.isArray(currentRideDoc.route)
            ? currentRideDoc.route.length
            : 0;
          // Ride terminus: anyone still on board must alight here, even if their
          // recorded dropoffOrder doesn't match due to bad import data.
          // stationIndex from the client is 1-based (route index + 1).
          const isLastStation = routeLength > 0 && stationIndex === routeLength;
          const confirmations = Array.isArray(metadata?.confirmations)
            ? metadata.confirmations.filter(
                (entry: { tripId?: unknown; status?: string }) =>
                  Boolean(entry?.tripId) &&
                  (entry.status === "arrived" || entry.status === "no_show"),
              )
            : [];
          const confirmationMap = new Map<string, string>();
          for (const entry of confirmations) {
            const tripId = entry.tripId?.toString?.() ?? "";
            if (tripId) {
              confirmationMap.set(tripId, entry.status);
            }
          }
          for (const [confirmedTripId, confirmationStatus] of confirmationMap) {
            if (confirmationStatus !== "no_show") continue;
            const passenger = currentPassengers.find(
              (candidate) =>
                candidate.tripId?.toString?.() === confirmedTripId,
            );
            if (
              passenger &&
              passenger.status === "waiting" &&
              stationMatchesPassenger(
                passenger,
                stationIndex,
                stationName,
                "pickup",
              )
            ) {
              const decision = canMarkNoShow({
                arrivedAt: passenger.arrivedAt,
                now: new Date(),
                minWaitMinutes: NO_SHOW_MIN_WAIT_MINUTES,
              });
              if (!decision.allowed) {
                return noShowTooEarlyResponse(
                  passenger.arrivedAt,
                  confirmedTripId,
                );
              }
            }
          }

          const arrivingTripIds = currentPassengers
            .filter(
              (passenger) =>
                passenger.status === "waiting" &&
                confirmationMap.get(String(passenger.tripId)) === "arrived" &&
                stationMatchesPassenger(
                  passenger,
                  stationIndex,
                  stationName,
                  "pickup",
                ),
            )
            .map((passenger) => String(passenger.tripId));
          const releasingTripIds = currentPassengers
            .filter(
              (passenger) =>
                ["boarding", "on_board", "picked_up"].includes(
                  getPassengerStatus(passenger),
                ) &&
                ((getPassengerStatus(passenger) === "boarding" ||
                  getPassengerStatus(passenger) === "picked_up") &&
                  stationMatchesPassenger(
                    passenger,
                    stationIndex,
                    stationName,
                    "pickup",
                  )
                  ? false
                  : stationMatchesPassenger(
                      passenger,
                      stationIndex,
                      stationName,
                      "dropoff",
                    ) || isLastStation),
            )
            .map((passenger) => String(passenger.tripId));
          const seatPlan = planBoardingSeatAssignments({
            capacity: getSeatCapacity(currentRideDoc),
            passengers: currentPassengers.map((passenger) => ({
              tripId: String(passenger.tripId),
              status: getPassengerStatus(passenger),
              seatNumbers: passenger.seatNumbers,
              numberOfPassengers: passenger.numberOfPassengers ?? 1,
            })),
            boardingTripIds: arrivingTripIds,
            releasingTripIds,
          });
          if (!seatPlan.ok) {
            return NextResponse.json(
              {
                success: false,
                errorCode: "SEATS_UNAVAILABLE",
                error: "Not enough seats are available for this group.",
              },
              { status: 409 },
            );
          }
          stationSeatAssignments = seatPlan.assignments;

          let updatedPassengers = false;
          const tripsToActivate = new Set<string>();
          const tripsToComplete = new Set<string>();

          // 1. Convert all existing green seats to blue on arrival.
          //    Passengers with boarding/picked_up status who are not boarding here
          //    become fully on board.
          for (const passenger of currentRideDoc.passengers) {
            const isPickup = stationMatchesPassenger(
              passenger,
              stationIndex,
              stationName,
              "pickup",
            );
            const isDropoff = stationMatchesPassenger(
              passenger,
              stationIndex,
              stationName,
              "dropoff",
            );

            if (
              (passenger.status === "boarding" ||
                passenger.status === "picked_up") &&
              !isPickup
            ) {
              passenger.status = "on_board";
              updatedPassengers = true;
            }

            // 2. Convert every existing red seat to grey before processing this station.
            //    Keep current-station dropoffs assigned until after alighting has been
            //    processed so red seats remain visible on the current stop.
            if (
              passenger.status === "dropped_off" &&
              !isDropoff &&
              (passenger.seatNumbers?.length ?? 0) > 0
            ) {
              passenger.seatNumbers = [];
              updatedPassengers = true;
            }
          }

          // 3. Process boarding passengers for the current station.
          for (const passenger of currentRideDoc.passengers) {
            const passengerTripId = passenger.tripId?.toString?.() ?? "";
            const confirmationStatus = confirmationMap.get(passengerTripId);
            const isPickup = stationMatchesPassenger(
              passenger,
              stationIndex,
              stationName,
              "pickup",
            );

            if (!isPickup || passenger.status !== "waiting") {
              continue;
            }

            if (confirmationStatus === "no_show") {
              passenger.status = "no_show";
              passenger.seatNumbers = [];
              passenger.noShowAt = new Date();
              updatedPassengers = true;
              pushRideLog(currentRideDoc, {
                action: "no_show",
                tripId: passenger.tripId,
                userId: passenger.userId,
                stationIndex,
                previousStatus: "waiting",
                newStatus: "no_show",
              });
            } else if (confirmationStatus === "arrived") {
              passenger.status = "boarding";
              const seats = stationSeatAssignments[passengerTripId];
              if (!seats || seats.length !== (passenger.numberOfPassengers ?? 1)) {
                return NextResponse.json(
                  {
                    success: false,
                    errorCode: "SEATS_UNAVAILABLE",
                    error: "Not enough seats are available for this group.",
                  },
                  { status: 409 },
                );
              }
              passenger.seatNumbers = seats;
              updatedPassengers = true;
              tripsToActivate.add(passengerTripId);
              pushRideLog(currentRideDoc, {
                action: "boarding",
                tripId: passenger.tripId,
                userId: passenger.userId,
                stationIndex,
                stationName,
                previousStatus: "waiting",
                newStatus: "boarding",
                metadata: { seats },
              });
            }
          }

          // 4. Now process passengers getting off at the current station.
          for (const passenger of currentRideDoc.passengers) {
            const isDropoff = stationMatchesPassenger(
              passenger,
              stationIndex,
              stationName,
              "dropoff",
            );

            if (
              (isDropoff || isLastStation) &&
              (passenger.status === "on_board" ||
                passenger.status === "picked_up")
            ) {
              const previousStatus = passenger.status;
              passenger.status = "dropped_off";
              updatedPassengers = true;
              pushRideLog(currentRideDoc, {
                action: "dropped_off",
                tripId: passenger.tripId,
                userId: passenger.userId,
                stationIndex,
                stationName,
                previousStatus,
                newStatus: "dropped_off",
              });
              tripsToComplete.add(String(passenger.tripId));
            }
          }

          // 4b. A rider's duplicate trip record should alight alongside the one that just matched.
          const droppedOffUserIds = new Set(
            currentRideDoc.passengers
              .filter(
                (passenger: RidePassengerLike) =>
                  passenger.status === "dropped_off",
              )
              .map((passenger: RidePassengerLike) =>
                passenger.userId?.toString?.(),
              )
              .filter((id: string | undefined): id is string => Boolean(id)),
          );
          for (const passenger of currentRideDoc.passengers) {
            const userId = passenger.userId?.toString?.();
            if (
              userId &&
              droppedOffUserIds.has(userId) &&
              ["on_board", "picked_up", "boarding"].includes(
                passenger.status ?? "",
              )
            ) {
              const previousStatus = passenger.status;
              passenger.status = "dropped_off";
              updatedPassengers = true;
              pushRideLog(currentRideDoc, {
                action: "dropped_off_linked",
                tripId: passenger.tripId,
                userId: passenger.userId,
                stationIndex,
                stationName,
                previousStatus,
                newStatus: "dropped_off",
              });
              tripsToComplete.add(String(passenger.tripId));
            }
          }

          if (updatedPassengers) {
            const persisted = await Ride.updateOne(
              {
                _id: rideId,
                __v: claimedRide.__v,
                ...incidentGuard,
              },
              {
                $set: {
                  passengers: currentRideDoc.passengers,
                  logs: currentRideDoc.logs,
                },
                $inc: { __v: 1 },
              },
            );
            if (persisted.matchedCount !== 1) {
              const latestRide = await Ride.findById(rideId)
                .select("hasOpenIncident")
                .lean();
              if (latestRide?.hasOpenIncident) {
                return NextResponse.json(
                  {
                    success: false,
                    errorCode: "INCIDENT_OPEN",
                    error: "Ride actions are paused while the incident is being reviewed.",
                  },
                  { status: 409 },
                );
              }
              return NextResponse.json(
                {
                  success: false,
                  errorCode: "RIDE_ACTION_STATUS_CONFLICT",
                  error: "Ride changed while processing this station. Please retry.",
                },
                { status: 409 },
              );
            }
          }

          await rideActions.logStationArrived(
            rideId,
            tripIds,
            driverId,
            stationIndex,
            stationName,
            safeMetadata,
          );
          await Promise.all(
            [...tripsToActivate].map((activeTripId) =>
              Trip.findByIdAndUpdate(activeTripId, { status: "active" }),
            ),
          );
          await Promise.all(
            [...tripsToComplete].map((completedTripId) =>
              Trip.findByIdAndUpdate(completedTripId, {
                status: "completed",
              }),
            ),
          );
          await Promise.all(
            [...tripsToComplete].map((completedTripId) =>
              notifyAdminsOfCompletedPaidTrip(completedTripId),
            ),
          );
          for (const completedTripId of tripsToComplete) {
            const completedTrip = await Trip.findById(completedTripId)
              .select("userId")
              .lean<{ userId: string } | null>();
            if (completedTrip) {
              await creditReferralBonusIfEligible(
                String(completedTrip.userId),
                completedTripId,
              );
            }
          }

          remainingStations = getRemainingStations(currentRideDoc.toObject());
        }

        result = {
          success: true,
          message: `Arrived and confirmed passenger rides at ${stationName}`,
          action: "station_arrived",
          seatAssignments: stationSeatAssignments,
          nextAction: "boarding_alighting",
          remainingStations,
        };
        break;

      case "boarding_alighting":
        if (!tripId) {
          return NextResponse.json(
            { success: false, error: "Missing tripId" },
            { status: 400 },
          );
        }

        if (
          boardingCount === undefined ||
          boardingCount === null ||
          alightingCount === undefined ||
          alightingCount === null ||
          stationIndex === undefined ||
          stationIndex === null ||
          !stationName
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Missing boardingCount, alightingCount, stationIndex, or stationName",
            },
            { status: 400 },
          );
        }

        // Log boarding/alighting
        await rideActions.logBoardingAlighting(
          rideId,
          tripId,
          driverId,
          stationIndex,
          stationName,
          boardingCount,
          alightingCount,
          safeMetadata,
        );

        result = {
          success: true,
          message: `${boardingCount} boarded, ${alightingCount} alighted`,
          action: "boarding_alighting_logged",
        };
        break;

      case "pickup_arrived":
        if (!tripId) {
          return NextResponse.json(
            { success: false, error: "Missing tripId" },
            { status: 400 },
          );
        }

        if (!stationName) {
          return NextResponse.json(
            { success: false, error: "Missing stationName (pickup address)" },
            { status: 400 },
          );
        }

        // Log pickup arrival
        await rideActions.logPickupArrived(
          rideId,
          tripId,
          driverId,
          stationName,
          safeMetadata,
        );

        result = {
          success: true,
          message: "Pickup location arrival logged",
          action: "pickup_arrived",
        };
        break;

      case "passenger_picked_up":
        if (!tripId) {
          return NextResponse.json(
            { success: false, error: "Missing tripId" },
            { status: 400 },
          );
        }

        const passengerCount = boardingCount || 1;

        // Log passenger pickup
        await rideActions.logPassengerPickedUp(
          rideId,
          tripId,
          driverId,
          passengerCount,
          safeMetadata,
        );

        result = {
          success: true,
          message: `${passengerCount} passenger(s) picked up`,
          action: "passenger_picked_up",
        };
        break;

      case "no_show":
        if (!tripId) {
          return NextResponse.json(
            { success: false, error: "Missing tripId" },
            { status: 400 },
          );
        }

        const currentRideDocNoShow = await Ride.findById(rideId);
        if (currentRideDocNoShow) {
          const passenger = currentRideDocNoShow.passengers.find(
            (p: RidePassengerLike) =>
              p.tripId?.toString?.() === tripId.toString(),
          );
          if (!passenger || passenger.status !== "waiting") {
            return NextResponse.json(
              { success: false, errorCode: "PASSENGER_NOT_WAITING", error: "The passenger is not waiting at pickup." },
              { status: 409 },
            );
          }
          const waitDecision = canMarkNoShow({
            arrivedAt: passenger.arrivedAt,
            now: new Date(),
            minWaitMinutes: NO_SHOW_MIN_WAIT_MINUTES,
          });
          if (!waitDecision.allowed) {
            return noShowTooEarlyResponse(passenger.arrivedAt, String(tripId));
          }
          {
            const previousStatus = passenger.status;
            passenger.status = "no_show";
            passenger.seatNumbers = [];
            passenger.noShowAt = new Date();
            pushRideLog(currentRideDocNoShow, {
              action: "no_show",
              tripId: passenger.tripId,
              userId: passenger.userId,
              previousStatus,
              newStatus: "no_show",
            });
            await currentRideDocNoShow.save();
          }
        }

        result = {
          success: true,
          message: "No-show logged",
          action: "no_show_logged",
        };
        break;

      case "stop_point_arrived":
        if (!tripId) {
          return NextResponse.json(
            { success: false, error: "Missing tripId" },
            { status: 400 },
          );
        }

        if (
          stationIndex === undefined ||
          stationIndex === null ||
          !stationName
        ) {
          return NextResponse.json(
            { success: false, error: "Missing stationIndex or stationName" },
            { status: 400 },
          );
        }

        // Log stop point arrival
        await rideActions.logStopPointArrived(
          rideId,
          tripId,
          driverId,
          stationIndex,
          stationName,
          safeMetadata,
        );

        result = {
          success: true,
          message: `Arrived at stop point: ${stationName}`,
          action: "stop_point_arrived",
        };
        break;

      case "end_ride":
        const linkedTrips = await Trip.find({ rideId })
          .select("_id userId status")
          .lean<
            {
              _id: Types.ObjectId;
              userId: Types.ObjectId;
              status: string;
            }[]
          >();
        const noShowTripIds = new Set(
          getNoShowTripIds(actionPassengers, linkedTrips),
        );
        const markedNoShowTripIds: string[] = [];
        for (const trip of linkedTrips) {
          if (!noShowTripIds.has(String(trip._id))) continue;
          const passenger = actionPassengers.find(
            (entry) => String(entry.tripId) === String(trip._id),
          );
          const embeddedNoShowAt = passenger?.noShowAt;
          const noShowAt =
            embeddedNoShowAt instanceof Date
              ? embeddedNoShowAt
              : typeof embeddedNoShowAt === "string" &&
                  Number.isFinite(Date.parse(embeddedNoShowAt))
                ? new Date(embeddedNoShowAt)
                : new Date();
          const markedTrip = await Trip.findOneAndUpdate(
            {
              _id: trip._id,
              rideId,
              status: { $in: ["matched", "confirmed"] },
            },
            { $set: { status: "no_show", noShowAt } },
            { new: true },
          )
            .select("_id userId")
            .lean<{ _id: Types.ObjectId; userId: Types.ObjectId } | null>();
          if (markedTrip) {
            markedNoShowTripIds.push(String(markedTrip._id));
            await Log.create({
              tripId: markedTrip._id,
              rideId,
              userId: markedTrip.userId,
              driverId,
              status: "no_show",
              previousStatus: trip.status,
              action: "trip_no_show_marked",
              description: "Trip marked as no-show at ride end.",
              actorType: "driver",
              actorId: driverId,
            });
          }
        }

        const completableTripIds = new Set(
          getCompletableTripIds(actionPassengers, linkedTrips),
        );
        const completedTrips = [];
        for (const trip of linkedTrips) {
          if (!completableTripIds.has(String(trip._id))) continue;
          const completedTrip = await Trip.findOneAndUpdate(
            { _id: trip._id, rideId, status: "active" },
            { $set: { status: "completed" } },
            { new: true },
          )
            .select("_id userId")
            .lean<{ _id: Types.ObjectId; userId: Types.ObjectId } | null>();
          if (completedTrip) completedTrips.push(completedTrip);
        }

        const completedTripIds = completedTrips.map((trip) => trip._id);
        if (completedTripIds.length > 0) {
          await rideActions.logRideCompleted(
            rideId,
            completedTripIds,
            driverId,
            safeMetadata,
          );
        }
        await Promise.all(
          completedTripIds.map((completedTripId: unknown) =>
            notifyAdminsOfCompletedPaidTrip(String(completedTripId)),
          ),
        );
        await Promise.all(
          completedTrips.map((completedTrip) =>
            creditReferralBonusIfEligible(
              String(completedTrip.userId),
              String(completedTrip._id),
            ),
          ),
        );
        await notifyPassengersOfNoShowTrips(markedNoShowTripIds);

        result = {
          success: true,
          message: "Ride completed",
          action: "ride_completed",
        };
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
          },
          { status: 400 },
        );
    }

    return NextResponse.json(sanitizePickupPinFields(result), { status: 200 });
  } catch (error) {
    if (error instanceof PickupPinConfigError) {
      console.error("[POST /api/actions/ride/:rideId]", error.code);
      return NextResponse.json(
        {
          success: false,
          errorCode: error.code,
          error: "Pickup PIN configuration is unavailable.",
        },
        { status: 500 },
      );
    }
    console.error(
      "[POST /api/actions/ride/:rideId]",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process action.",
      },
      { status: 500 },
    );
  }
}
