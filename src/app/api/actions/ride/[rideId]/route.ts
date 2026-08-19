import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { VEHICLES } from "@/lib/config/vehicles";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { getSession } from "@/lib/auth/session";
import * as rideActions from "@/lib/services/rideActionHelpers";
import { creditReferralBonusIfEligible } from "@/lib/referral";
import { normalizeSharedRidePassengers } from "@/lib/services/sharedRideManifest";

interface RideRouteStop {
  address?: string;
  point: { address: string; lat: number; lng: number };
  alighting: number;
  boarding: number;
  waitingMinutes: number;
}

interface RidePassengerLike {
  tripId?: string | { toString(): string } | null;
  status?: string | null;
  pickupOrder?: number | null;
  dropoffOrder?: number | null;
  pickupStation?: { id?: number | null; name?: string | null; address?: string | null } | null;
  dropoffStation?: { id?: number | null; name?: string | null; address?: string | null } | null;
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

function getPassengerStatus(passenger: RidePassengerLike | null | undefined): string {
  return String(passenger?.status ?? "waiting").toLowerCase();
}

function normalizeStationValue(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
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
    direction === "pickup" ? passenger?.pickupStation : passenger?.dropoffStation;

  if (typeof station?.id === "number" && Number.isFinite(station.id) && station.id > 0) {
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
  const normalizedPassengerStation = normalizeStationValue(stationReference.value);

  return Boolean(normalizedStationName) && normalizedStationName === normalizedPassengerStation;
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
            normalizeStationValue(stationName) === normalizeStationValue(pickupKey.value))
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
            normalizeStationValue(stationName) === normalizeStationValue(dropoffKey.value))
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

function assignSeat(ride: RideDocLike | null | undefined): number {
  const occupied = new Set<number>();

  for (const passenger of ride?.passengers ?? []) {
    if (!["picked_up", "boarding", "on_board"].includes(getPassengerStatus(passenger))) {
      continue;
    }

    const seatNumbers = Array.isArray(passenger?.seatNumbers)
      ? passenger.seatNumbers
      : [];

    for (const seat of seatNumbers) {
      if (typeof seat === "number" && Number.isFinite(seat)) {
        occupied.add(seat);
      }
    }
  }

  const vehicleType = ride?.vehicleType as keyof typeof VEHICLES | undefined;
  const capacity = Number(
    ride?.vehicleCapacity ??
      (vehicleType && VEHICLES[vehicleType]?.capacity
        ? VEHICLES[vehicleType].capacity
        : 4),
  );

  for (let seat = 1; seat <= capacity; seat += 1) {
    if (!occupied.has(seat)) {
      return seat;
    }
  }

  throw new Error("No seats available");
}

/**
 * GET /api/actions/ride/:rideId/next
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
    console.error("[GET /api/actions/ride/:rideId/next]", error);
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

    const driverId = ride.driverId;
    const actionPassengers = normalizeSharedRidePassengers(
      ride as Record<string, unknown>,
    ) as unknown as RidePassengerLike[];
    const tripIds = actionPassengers
      .map((passenger: RidePassengerLike) =>
        typeof passenger.tripId === "object" && passenger.tripId !== null && "_id" in (passenger.tripId as object)
          ? (passenger.tripId as { _id: unknown })._id
          : passenger.tripId,
      )
      .filter(Boolean) as (string | Types.ObjectId)[];

    let result: Record<string, unknown> = { success: false };

    switch (action) {
      case "start_ride":
        // Log ride start for all trips
        await rideActions.logRideStarted(rideId, tripIds, driverId, metadata);

        const originLoc = metadata?.currentLocation ?? null;
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

        // Log station arrival for all trips
        await rideActions.logStationArrived(
          rideId,
          tripIds,
          driverId,
          stationIndex,
          stationName,
          metadata,
        );

        const currentRideDoc = await Ride.findById(rideId);
        let remainingStations: Array<{ stationIndex: number; stationName: string }> = [];
        if (currentRideDoc) {
          materializeSharedRidePassengers(currentRideDoc);
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
                  Boolean(entry?.tripId) && (entry.status === "arrived" || entry.status === "no_show"),
              )
            : [];
          const confirmationMap = new Map<string, string>();
          for (const entry of confirmations) {
            const tripId = entry.tripId?.toString?.() ?? "";
            if (tripId) {
              confirmationMap.set(tripId, entry.status);
            }
          }

          let updatedPassengers = false;

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
              (passenger.status === "boarding" || passenger.status === "picked_up") &&
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
              updatedPassengers = true;
            } else if (confirmationStatus === "arrived") {
              passenger.status = "boarding";
              let seat = 1;
              try {
                seat = assignSeat(currentRideDoc);
              } catch (seatErr) {
                console.warn("[station_arrived] Seat assignment fallback:", seatErr);
              }
              passenger.seatNumbers = [seat];
              updatedPassengers = true;
              await Trip.findByIdAndUpdate(passenger.tripId, { status: "active" });
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
              (passenger.status === "on_board" || passenger.status === "picked_up")
            ) {
              passenger.status = "dropped_off";
              updatedPassengers = true;
              await Trip.findByIdAndUpdate(passenger.tripId, { status: "completed" });
              const completedTrip = await Trip.findById(passenger.tripId)
                .select("userId")
                .lean<{ userId: string } | null>();
              if (completedTrip) {
                await creditReferralBonusIfEligible(
                  String(completedTrip.userId),
                  String(passenger.tripId),
                );
              }
            }
          }

          if (updatedPassengers) {
            await currentRideDoc.save();
          }

          remainingStations = getRemainingStations(currentRideDoc.toObject());
        }

        result = {
          success: true,
          message: `Arrived and confirmed passenger rides at ${stationName}`,
          action: "station_arrived",
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
          metadata,
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
          metadata,
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
          metadata,
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

        await rideActions.logNoShow(
          rideId,
          tripId,
          driverId,
          metadata.reason,
          metadata,
        );

        const currentRideDocNoShow = await Ride.findById(rideId);
        if (currentRideDocNoShow) {
          const passenger = currentRideDocNoShow.passengers.find(
            (p: RidePassengerLike) => p.tripId?.toString?.() === tripId.toString(),
          );
          if (passenger) {
            passenger.status = "no_show";
            passenger.seatNumbers = [];
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
          metadata,
        );

        result = {
          success: true,
          message: `Arrived at stop point: ${stationName}`,
          action: "stop_point_arrived",
        };
        break;

      case "end_ride":
        // Log ride completion for all trips
        await rideActions.logRideCompleted(rideId, tripIds, driverId, metadata);

        // Update ride status and driverDestination
        const destLoc = metadata?.currentLocation ?? null;
        await Ride.findByIdAndUpdate(rideId, {
          status: "completed",
          ...(destLoc ? { driverDestination: destLoc } : {}),
        });

        // Update all trip statuses to completed
        await Trip.updateMany({ rideId }, { status: "completed" });
        await Promise.all(
          tripIds.map(async (completedTripId: unknown) => {
            const completedTrip = await Trip.findById(completedTripId)
              .select("userId")
              .lean<{ userId: string } | null>();
            return completedTrip
              ? creditReferralBonusIfEligible(
                  String(completedTrip.userId),
                  String(completedTripId),
                )
              : false;
          }),
        );

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

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[POST /api/actions/ride/:rideId]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process action",
      },
      { status: 500 },
    );
  }
}
