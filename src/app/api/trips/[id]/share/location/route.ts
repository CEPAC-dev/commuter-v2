import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { updateShareLocation, validateLocationInput } from "@/lib/liveShare/logic";
import { buildLocationUpdateFilter } from "@/lib/liveShare/locationFilter";
import { validateMutationRequest } from "@/lib/security/request";
import { logLiveShareFailure } from "@/lib/liveShare/errors";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { TripShare } from "@/models/TripShare";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (session.role !== "passenger") return jsonError("Forbidden", 403);

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return jsonError("Trip not found", 404);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid location body.", 400);
  }

  const now = new Date();
  const validation = validateLocationInput(body, now);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.reason, ...(validation.errorCode ? { errorCode: validation.errorCode } : {}) },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const trip = await Trip.findOne({ _id: id, userId: session.userId })
      .select("_id")
      .lean();
    if (!trip) return jsonError("Trip not found", 404);
    const share = await TripShare.findOne({
      tripId: trip._id,
      userId: session.userId,
      active: true,
    })
      .select("_id")
      .lean();
    if (!share) return jsonError("Live share not found.", 404);

    const result = await updateShareLocation(
      {
        shareId: String(share._id),
        ownerId: session.userId,
        location: validation.value,
        now,
      },
      {
        async load(shareId) {
          const share = await TripShare.findOne({
            _id: shareId,
            tripId: trip._id,
            userId: session.userId,
          })
            .select("active revokedAt endedAt expiresAt lastLocation")
            .lean();
          if (!share) return null;
          const currentTrip = await Trip.findById(trip._id)
            .select("userId driverId status rideId updatedAt")
            .lean();
          if (!currentTrip) return null;
          const ride = currentTrip.rideId
            ? await Ride.findById(currentTrip.rideId)
                .select("status updatedAt")
                .lean()
            : null;
          return {
            share: {
              id: String(share._id),
              active: share.active,
              revokedAt: share.revokedAt,
              endedAt: share.endedAt,
              expiresAt: share.expiresAt,
              lastLocation: share.lastLocation,
            },
            trip: currentTrip,
            ride,
          };
        },
        async markEnded(shareId, endedAt) {
          await TripShare.updateOne(
            {
              _id: shareId,
              tripId: trip._id,
              userId: session.userId,
              endedAt: null,
            },
            { $set: { endedAt }, $unset: { lastLocation: 1 } },
          );
        },
        async updateLocationIfDue(input) {
          const update = await TripShare.updateOne(
            buildLocationUpdateFilter({
              shareId: input.shareId,
              tripId: trip._id,
              userId: session.userId,
              now: input.now,
              earliestReceivedAt: input.earliestReceivedAt,
            }),
            {
              $set: {
                lastLocation: {
                  ...input.location,
                  receivedAt: input.now,
                },
              },
            },
          );
          return update.modifiedCount === 1;
        },
      },
    );

    if (result.kind === "updated") {
      return NextResponse.json({ ok: true, nextAfterMs: result.nextAfterMs });
    }
    if (result.kind === "too_soon") {
      return NextResponse.json(
        { ok: false, nextAfterMs: result.nextAfterMs },
        { status: 429 },
      );
    }
    if (result.kind === "ended") {
      return jsonError("Trip has ended.", 409);
    }
    if (result.kind === "ineligible") {
      return jsonError("Trip is not eligible for live sharing.", 409);
    }
    return jsonError("Live share not found.", 404);
  } catch (error) {
    logLiveShareFailure("[POST /api/trips/[id]/share/location]", error);
    return jsonError("Unable to update live location.", 500);
  }
}
