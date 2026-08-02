import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { getSession } from "@/lib/auth/session";
import * as rideActions from "@/lib/services/rideActionHelpers";

interface RideRouteStop {
  point: { address: string; lat: number; lng: number };
  alighting: number;
  boarding: number;
  waitingMinutes: number;
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
      .lean();

    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride not found" },
        { status: 404 },
      );
    }

    // Verify driver owns this ride
    if (ride.driverId.toString() !== session.userId) {
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
    let nextAction: any = {};

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
function getNextSharedRideAction(ride: any, logs: any[], lastLog: any) {
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
function getNextPrivateRideAction(ride: any, logs: any[], lastLog: any) {
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
    if (ride.driverId.toString() !== session.userId) {
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
      pickupConfirmation,
      metadata = {},
    } = body;

    const driverId = ride.driverId;
    const tripIds = ride.passengers.map((p: any) => p.tripId);

    let result: any = { success: false };

    switch (action) {
      case "start_ride":
        // Log ride start for all trips
        await rideActions.logRideStarted(rideId, tripIds, driverId, metadata);

        // Update ride status and driverOrigin
        const originLoc = metadata?.currentLocation ?? null;
        await Ride.findByIdAndUpdate(rideId, {
          status: "active",
          ...(originLoc ? { driverOrigin: originLoc } : {}),
        });
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

        // Update statuses for passengers boarding or alighting at this station
        const currentRideDoc = await Ride.findById(rideId);
        if (currentRideDoc && currentRideDoc.passengers) {
          let updatedPassengers = false;
          for (const p of currentRideDoc.passengers) {
            const pPickupIdx = p.pickupOrder ?? 0;
            const pDropoffIdx = p.dropoffOrder ?? 0;
            const pPickupName = (p.pickupStation as any)?.name;
            const pDropoffName = (p.dropoffStation as any)?.name;

            const isPickup =
              pPickupIdx === stationIndex || pPickupName === stationName;
            const isDropoff =
              pDropoffIdx === stationIndex || pDropoffName === stationName;

            if (isPickup) {
              p.status = "picked_up";
              updatedPassengers = true;
              await Trip.findByIdAndUpdate(p.tripId, { status: "active" });
            } else if (isDropoff) {
              p.status = "dropped_off";
              updatedPassengers = true;
              await Trip.findByIdAndUpdate(p.tripId, { status: "completed" });
            }
          }
          if (updatedPassengers) {
            await currentRideDoc.save();
          }
        }

        result = {
          success: true,
          message: `Arrived and confirmed passenger rides at ${stationName}`,
          action: "station_arrived",
          nextAction: "boarding_alighting",
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

        // Log no-show and cancel trip
        await rideActions.logNoShow(
          rideId,
          tripId,
          driverId,
          metadata.reason,
          metadata,
        );

        // Update trip status to cancelled
        await Trip.findByIdAndUpdate(tripId, { status: "cancelled" });

        result = {
          success: true,
          message: "No-show logged and trip cancelled",
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
      { success: false, error: "Failed to process action" },
      { status: 500 },
    );
  }
}
