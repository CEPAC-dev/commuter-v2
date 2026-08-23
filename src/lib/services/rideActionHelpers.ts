/**
 * Ride Action Helpers
 * For shared and private ride flows with station/stop management
 */

import { createLog } from "@/lib/services/logService";
import type { Types } from "mongoose";

/**
 * Log when ride starts
 */
export async function logRideStarted(
  rideId: Types.ObjectId | string,
  tripIds: (Types.ObjectId | string)[],
  driverId: Types.ObjectId | string,
  metadata?: Record<string, unknown>,
) {
  // Log for each trip in the ride
  const promises = tripIds.map((tripId) =>
    createLog({
      tripId,
      userId: null,
      driverId,
      status: "active",
      previousStatus: "confirmed",
      action: "ride_started",
      description: "Ride started - driver en route",
      metadata,
      actorType: "driver",
      actorId: driverId,
    }),
  );

  return Promise.all(promises);
}

/**
 * Log when arriving at a station (shared rides)
 */
export async function logStationArrived(
  rideId: Types.ObjectId | string,
  tripIds: (Types.ObjectId | string)[],
  driverId: Types.ObjectId | string,
  stationIndex: number,
  stationName: string,
  metadata?: Record<string, unknown>,
) {
  // Log for each trip in the ride
  const promises = tripIds.map((tripId) =>
    createLog({
      tripId,
      userId: null,
      driverId,
      status: "active",
      previousStatus: "active",
      action: "station_arrived",
      description: `Arrived at ${stationName}`,
      stationIndex,
      stationName,
      metadata,
      actorType: "driver",
      actorId: driverId,
    }),
  );

  return Promise.all(promises);
}

/**
 * Log boarding and alighting at a station (shared rides)
 */
export async function logBoardingAlighting(
  rideId: Types.ObjectId | string,
  tripId: Types.ObjectId | string,
  driverId: Types.ObjectId | string,
  stationIndex: number,
  stationName: string,
  boardingCount: number,
  alightingCount: number,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId: null,
    driverId,
    status: "active",
    previousStatus: "active",
    action: "boarding_alighting",
    description: `${boardingCount} boarded, ${alightingCount} alighted at ${stationName}`,
    stationIndex,
    stationName,
    boardingCount,
    alightingCount,
    metadata,
    actorType: "driver",
    actorId: driverId,
  });
}

/**
 * Log when pickup location is arrived (private rides)
 */
export async function logPickupArrived(
  rideId: Types.ObjectId | string,
  tripId: Types.ObjectId | string,
  driverId: Types.ObjectId | string,
  pickupAddress: string,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId: null,
    driverId,
    status: "active",
    previousStatus: "confirmed",
    action: "pickup_arrived",
    description: `Arrived at pickup location: ${pickupAddress}`,
    stationName: pickupAddress,
    metadata,
    actorType: "driver",
    actorId: driverId,
  });
}

/**
 * Log when passenger is picked up (private rides)
 */
export async function logPassengerPickedUp(
  rideId: Types.ObjectId | string,
  tripId: Types.ObjectId | string,
  driverId: Types.ObjectId | string,
  passengerCount: number,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId: null,
    driverId,
    status: "active",
    previousStatus: "active",
    action: "passenger_picked_up",
    description: `${passengerCount} passenger(s) picked up`,
    boardingCount: passengerCount,
    metadata,
    actorType: "driver",
    actorId: driverId,
  });
}

/**
 * Log when passenger is no-show (private rides)
 */
export async function logNoShow(
  rideId: Types.ObjectId | string,
  tripId: Types.ObjectId | string,
  driverId: Types.ObjectId | string,
  reason?: string,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId: null,
    driverId,
    status: "cancelled",
    previousStatus: "active",
    action: "no_show",
    description: `Passenger no-show${reason ? `: ${reason}` : ""}`,
    metadata,
    actorType: "driver",
    actorId: driverId,
  });
}

/**
 * Log when arriving at a stop point (private rides with stops)
 */
export async function logStopPointArrived(
  rideId: Types.ObjectId | string,
  tripId: Types.ObjectId | string,
  driverId: Types.ObjectId | string,
  stationIndex: number,
  stationName: string,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId: null,
    driverId,
    status: "active",
    previousStatus: "active",
    action: "stop_point_arrived",
    description: `Arrived at stop point: ${stationName}`,
    stationIndex,
    stationName,
    metadata,
    actorType: "driver",
    actorId: driverId,
  });
}

/**
 * Log when ride is completed
 */
export async function logRideCompleted(
  rideId: Types.ObjectId | string,
  tripIds: (Types.ObjectId | string)[],
  driverId: Types.ObjectId | string,
  metadata?: Record<string, unknown>,
) {
  // Log for each trip in the ride
  const promises = tripIds.map((tripId) =>
    createLog({
      tripId,
      userId: null,
      driverId,
      status: "completed",
      previousStatus: "active",
      action: "ride_completed",
      description: "Ride completed successfully",
      metadata,
      actorType: "driver",
      actorId: driverId,
    }),
  );

  return Promise.all(promises);
}
