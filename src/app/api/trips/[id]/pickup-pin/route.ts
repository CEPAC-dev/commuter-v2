import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { derivePin, PickupPinConfigError } from "@/lib/pickupPin";
import { ensureRidePassengerNumbers } from "@/lib/services/rideService";
import { normalizeSharedRidePassengers } from "@/lib/services/sharedRideManifest";
import { Trip } from "@/models/Trip";

export const dynamic = "force-dynamic";

function json(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return json(
        { errorCode: "AUTH_REQUIRED", error: "Authentication required." },
        401,
      );
    }

    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return json({ errorCode: "TRIP_NOT_FOUND", error: "Trip not found." }, 404);
    }

    await connectDB();
    const trip = await Trip.findById(id)
      .select("userId rideId status pinVersion")
      .lean<{
        _id: Types.ObjectId;
        userId: Types.ObjectId;
        rideId?: Types.ObjectId | null;
        status: string;
        pinVersion?: number;
      } | null>();
    if (!trip) {
      return json({ errorCode: "TRIP_NOT_FOUND", error: "Trip not found." }, 404);
    }
    if (String(trip.userId) !== session.userId) {
      return json(
        { errorCode: "NOT_TRIP_OWNER", error: "You do not own this trip." },
        403,
      );
    }
    if (!["confirmed", "active"].includes(trip.status)) {
      return json(
        {
          errorCode: "TRIP_NOT_ELIGIBLE",
          error: "The pickup code is not available for this trip.",
        },
        409,
      );
    }
    if (!trip.rideId) {
      return json({ errorCode: "RIDE_NOT_FOUND", error: "Ride not found." }, 404);
    }

    const ride = await ensureRidePassengerNumbers(trip.rideId);
    if (!ride) {
      return json({ errorCode: "RIDE_NOT_FOUND", error: "Ride not found." }, 404);
    }
    if (!["confirmed", "active"].includes(String(ride.status))) {
      return json(
        {
          errorCode: "RIDE_NOT_ELIGIBLE",
          error: "The pickup code is not available for this ride.",
        },
        409,
      );
    }

    const passenger = normalizeSharedRidePassengers(ride).find(
      (entry) => String(entry.tripId) === String(trip._id),
    );
    if (!passenger || typeof passenger.passengerNumber !== "number") {
      return json(
        {
          errorCode: "TRIP_NOT_IN_RIDE",
          error: "This trip is not listed on its assigned ride.",
        },
        409,
      );
    }

    const pin = derivePin(
      String(trip._id),
      String(trip.rideId),
      trip.pinVersion ?? 0,
    );
    return json({ pin, passengerNumber: passenger.passengerNumber });
  } catch (error) {
    if (error instanceof PickupPinConfigError) {
      console.error("[GET /api/trips/:id/pickup-pin]", error.code);
      return json(
        {
          errorCode: error.code,
          error: "Pickup PIN configuration is unavailable.",
        },
        500,
      );
    }
    console.error(
      "[GET /api/trips/:id/pickup-pin]",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json(
      { errorCode: "PICKUP_PIN_UNAVAILABLE", error: "Pickup code unavailable." },
      500,
    );
  }
}
