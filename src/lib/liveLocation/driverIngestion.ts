import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { validateLocationInput } from "@/lib/liveShare/logic";
import { validateMutationRequest } from "@/lib/security/request";
import { enforceRateLimitByIdentity } from "@/lib/security/rateLimit";
import { logLiveShareFailure } from "@/lib/liveShare/errors";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { DriverLocation } from "@/models/DriverLocation";
import {
  publishTripDriverLocation,
  publishTripDriverLocationStopped,
} from "./ably";
import { saveDriverLocation, type DriverLocationSubject } from "./store";

type ResourceType = "ride" | "trip";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function ingestDriverLocation(
  request: NextRequest,
  resourceType: ResourceType,
  resourceId: string,
) {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (session.role !== "driver") return jsonError("Forbidden", 403);
  if (!Types.ObjectId.isValid(resourceId)) {
    return jsonError("Trip not found.", 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid location body.", 400);
  }

  const now = new Date();
  const validation = validateLocationInput(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.reason, ...(validation.errorCode ? { errorCode: validation.errorCode } : {}) },
      { status: 400 },
    );
  }

  try {
    await connectDB();

    let subjectType: DriverLocationSubject;
    let subjectId: string;
    let tripIds: string[];

    if (resourceType === "ride") {
      const ride = await Ride.findOne({
        _id: resourceId,
        driverId: session.userId,
        status: "active",
      })
        .select("_id")
        .lean();
      if (!ride) return jsonError("Active ride not found.", 404);

      subjectType = "ride";
      subjectId = String(ride._id);
      const trips = await Trip.find({
        rideId: ride._id,
        driverId: session.userId,
        status: "active",
      })
        .select("_id")
        .lean();
      tripIds = trips.map((trip) => String(trip._id));
    } else {
      const trip = await Trip.findOne({
        _id: resourceId,
        driverId: session.userId,
        status: "active",
      })
        .select("_id rideId")
        .lean<{ _id: unknown; rideId?: unknown | null }>();
      if (!trip) return jsonError("Active trip not found.", 404);

      if (trip.rideId) {
        const ride = await Ride.findOne({
          _id: trip.rideId,
          driverId: session.userId,
          status: "active",
        })
          .select("_id")
          .lean();
        if (!ride) return jsonError("Active ride not found.", 409);

        subjectType = "ride";
        subjectId = String(ride._id);
        const trips = await Trip.find({
          rideId: ride._id,
          driverId: session.userId,
          status: "active",
        })
          .select("_id")
          .lean();
        tripIds = trips.map((item) => String(item._id));
      } else {
        subjectType = "trip";
        subjectId = String(trip._id);
        tripIds = [subjectId];
      }
    }

    const limited = await enforceRateLimitByIdentity(
      "driver-location",
      `${session.userId}:${subjectType}:${subjectId}`,
      { limit: 25, windowMs: 60_000 },
      "DRIVER_LOCATION_RATE_LIMIT",
    );
    if (limited) return limited;

    const location = {
      ...validation.value,
      receivedAt: now,
    };
    await saveDriverLocation({
      subjectType,
      subjectId,
      driverId: session.userId,
      location,
      now,
    });
    let realtimeAvailable = true;
    try {
      await publishTripDriverLocation(tripIds, {
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
        heading: location.heading,
        speed: location.speed,
        recordedAt: location.recordedAt.toISOString(),
        receivedAt: now.toISOString(),
      });
    } catch (error) {
      realtimeAvailable = false;
      logLiveShareFailure("[driver location realtime publish]", error);
    }

    return NextResponse.json({
      ok: true,
      realtimeAvailable,
      receivedAt: now.toISOString(),
    });
  } catch (error) {
    logLiveShareFailure("[driver location ingestion]", error);
    return jsonError("Live location updates are temporarily unavailable.", 503);
  }
}

export async function stopDriverLocation(
  request: NextRequest,
  resourceType: ResourceType,
  resourceId: string,
) {
  const invalidRequest = validateMutationRequest(request, {
    requireJson: false,
  });
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (session.role !== "driver") return jsonError("Forbidden", 403);
  if (!Types.ObjectId.isValid(resourceId)) {
    return jsonError("Trip not found.", 404);
  }

  try {
    await connectDB();
    let subjectType: DriverLocationSubject;
    let subjectId: string;
    let tripIds: string[];

    if (resourceType === "ride") {
      const ride = await Ride.findOne({
        _id: resourceId,
        driverId: session.userId,
        status: "active",
      })
        .select("_id")
        .lean();
      if (!ride) return jsonError("Active ride not found.", 404);
      subjectType = "ride";
      subjectId = String(ride._id);
      const trips = await Trip.find({
        rideId: ride._id,
        driverId: session.userId,
        status: "active",
      })
        .select("_id")
        .lean();
      tripIds = trips.map((trip) => String(trip._id));
    } else {
      const trip = await Trip.findOne({
        _id: resourceId,
        driverId: session.userId,
        status: "active",
      })
        .select("_id rideId")
        .lean<{ _id: unknown; rideId?: unknown | null }>();
      if (!trip) return jsonError("Active trip not found.", 404);
      if (trip.rideId) {
        const ride = await Ride.findOne({
          _id: trip.rideId,
          driverId: session.userId,
          status: "active",
        })
          .select("_id")
          .lean();
        if (!ride) return jsonError("Active ride not found.", 409);
        subjectType = "ride";
        subjectId = String(ride._id);
        const trips = await Trip.find({
          rideId: ride._id,
          driverId: session.userId,
          status: "active",
        })
          .select("_id")
          .lean();
        tripIds = trips.map((item) => String(item._id));
      } else {
        subjectType = "trip";
        subjectId = String(trip._id);
        tripIds = [subjectId];
      }
    }

    const limited = await enforceRateLimitByIdentity(
      "driver-location-stop",
      `${session.userId}:${subjectType}:${subjectId}`,
      { limit: 5, windowMs: 60_000 },
      "DRIVER_LOCATION_RATE_LIMIT",
    );
    if (limited) return limited;

    await DriverLocation.deleteOne({ subjectType, subjectId });
    let realtimeAvailable = true;
    try {
      await publishTripDriverLocationStopped(
        tripIds,
        new Date().toISOString(),
      );
    } catch (error) {
      realtimeAvailable = false;
      logLiveShareFailure("[driver location stop realtime publish]", error);
    }
    return NextResponse.json({ ok: true, realtimeAvailable });
  } catch (error) {
    logLiveShareFailure("[driver location stop]", error);
    return jsonError("Unable to stop live location sharing.", 503);
  }
}
