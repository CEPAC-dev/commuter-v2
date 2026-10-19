import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { getSession } from "@/lib/auth/session";
import {
  createRide,
  getRidesByDriver,
  getRideById,
  getRideByPassengerIncluded,
} from "@/lib/services/rideService";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { TripClaimConflictError } from "@/lib/matchingEndpointGuards";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { getRideReadAccess, projectPassengerRide } from "@/lib/rideReadAccess";

function getResponse(
  data: unknown,
  status = 200,
  isError = false,
): NextResponse {
  return NextResponse.json(
    isError ? { error: data } : data,
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  try {
    await connectDB();
    const body = await req.json();
    const ride = await createRide(body);
    return NextResponse.json({ data: ride }, { status: 201 });
  } catch (err: unknown) {
    const claimConflict = err instanceof TripClaimConflictError;
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to create ride",
        ...(claimConflict ? { skippedCount: err.skippedCount } : {}),
      },
      { status: claimConflict ? 409 : 400 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return getResponse("Unauthorized", 401, true);

    await connectDB();
    const { searchParams } = new URL(req.url);
    const driverId = searchParams.get("driverId");
    const passengerId = searchParams.get("passengerId");
    const date = searchParams.get("date") ?? undefined;

    if (session.role === "admin") {
      if (passengerId) {
        const rides = await getRideByPassengerIncluded(passengerId);
        return getResponse({ data: rides });
      }
      if (!driverId) {
        return getResponse("driverId is required", 400, true);
      }
      const rides = await getRidesByDriver(driverId, date);
      return getResponse({ data: rides });
    }

    if (session.role === "driver") {
      const rides = await getRidesByDriver(session.userId, date);
      return getResponse({ data: rides });
    }

    if (session.role !== "passenger") {
      return getResponse("Forbidden", 403, true);
    }

    const passengerTrips = await Trip.find({
      userId: session.userId,
      status: { $ne: "cancelled" },
      rideId: { $ne: null },
      ...(date ? { date } : {}),
    })
      .select("_id rideId")
      .lean<{ _id: unknown; rideId: unknown }[]>();
    const tripIdsByRide = new Map<string, string[]>();
    for (const trip of passengerTrips) {
      const rideId = String(trip.rideId);
      const tripIds = tripIdsByRide.get(rideId) ?? [];
      tripIds.push(String(trip._id));
      tripIdsByRide.set(rideId, tripIds);
    }

    const rideIds = [...tripIdsByRide.keys()];
    if (rideIds.length === 0) return getResponse({ data: [] });
    const rides = await Ride.find({ _id: { $in: rideIds } })
      .select("_id")
      .lean<{ _id: unknown }[]>();
    const results = [];
    for (const rideRecord of rides) {
      const rideId = String(rideRecord._id);
      const tripIds = tripIdsByRide.get(rideId) ?? [];
      const access = getRideReadAccess({
        session,
        rideDriverId: null,
        hasNonCancelledPassengerTrip: tripIds.length > 0,
      });
      if (access !== "passenger") continue;

      const ride = await getRideById(rideId);
      if (!ride) continue;
      const safeRide = projectPassengerRide(
        ride,
        tripIds,
      );
      if (safeRide) results.push(safeRide);
    }
    return getResponse({ data: results });
  } catch (err: unknown) {
    return getResponse(
      err instanceof Error ? err.message : "Failed to fetch rides",
      500,
      true,
    );
  }
}
