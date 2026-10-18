import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { getTripChatAccess } from "@/lib/tripChatAccess";
import { enforceRateLimitByIdentity } from "@/lib/security/rateLimit";
import { ChatReadState } from "@/models/ChatReadState";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { errorCode: "UNAUTHENTICATED", error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { errorCode: "TRIP_NOT_FOUND", error: "Trip not found." },
      { status: 404 },
    );
  }

  await connectDB();
  const trip = await Trip.findById(id).lean();
  if (!trip) {
    return NextResponse.json(
      { errorCode: "TRIP_NOT_FOUND", error: "Trip not found." },
      { status: 404 },
    );
  }
  const ride = trip.rideId
    ? await Ride.findById(trip.rideId)
        .select("_id driverId status completedAt passengers.tripId passengers.status")
        .lean()
    : null;
  const access = getTripChatAccess({ session, trip, ride });
  if (access.role === "admin" || !access.allowed) {
    const closed = access.reason === "chat_closed";
    return NextResponse.json(
      {
        errorCode: closed ? "CHAT_CLOSED" : "CHAT_FORBIDDEN",
        error: closed
          ? "This trip chat is closed."
          : "You are not a participant in this trip chat.",
      },
      { status: closed ? 409 : 403 },
    );
  }

  const limited = await enforceRateLimitByIdentity(
    "trip-chat-read-state",
    session.userId,
    { limit: 120, windowMs: 5 * 60_000 },
    "CHAT_READ_RATE_LIMITED",
  );
  if (limited) return limited;

  const now = new Date();
  const state = await ChatReadState.findOneAndUpdate(
    { tripId: id, userId: session.userId },
    { $set: { lastReadAt: now } },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  )
    .select("lastReadAt")
    .lean();

  return NextResponse.json(
    { lastReadAt: state?.lastReadAt?.toISOString?.() ?? now.toISOString() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
