import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import {
  buildUnreadMessageMatch,
  getUnreadParticipants,
  parseChatTripIds,
} from "@/lib/chatUnread";
import { enforceRateLimitByIdentity } from "@/lib/security/rateLimit";
import { ChatReadState } from "@/models/ChatReadState";
import { Message } from "@/models/Message";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { errorCode: "UNAUTHENTICATED", error: "Unauthorized" },
      { status: 401 },
    );
  }
  const limited = await enforceRateLimitByIdentity(
    "trip-chat-unread",
    session.userId,
    { limit: 120, windowMs: 5 * 60_000 },
    "CHAT_UNREAD_RATE_LIMITED",
  );
  if (limited) return limited;

  const parsed = parseChatTripIds(
    new URL(req.url).searchParams.get("tripIds"),
  );
  if (parsed.tooMany) {
    return NextResponse.json(
      { errorCode: "TOO_MANY_TRIPS", error: "At most 10 Trip IDs may be requested." },
      { status: 400 },
    );
  }
  const ids = parsed.ids;
  if (ids.length === 0) {
    return NextResponse.json(
      {},
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  await connectDB();
  const trips = await Trip.find({ _id: { $in: ids } })
    .select("_id userId rideId status")
    .lean();
  const rideIds = [
    ...new Set(
      trips
        .map((trip) => trip.rideId)
        .filter((rideId): rideId is Types.ObjectId => Boolean(rideId))
        .map(String),
    ),
  ];
  const rides = await Ride.find({ _id: { $in: rideIds } })
    .select("_id driverId status completedAt passengers.tripId passengers.status")
    .lean();
  const ridesById = new Map(rides.map((ride) => [String(ride._id), ride]));
  const readStates = await ChatReadState.find({
    tripId: { $in: trips.map((trip) => trip._id) },
    userId: session.userId,
  })
    .select("tripId lastReadAt")
    .lean();
  const readAtByTrip = new Map(
    readStates.map((state) => [String(state.tripId), state.lastReadAt]),
  );
  const candidates = trips.map((trip) => ({
    trip,
    ride: trip.rideId ? (ridesById.get(String(trip.rideId)) ?? null) : null,
    lastReadAt: readAtByTrip.get(String(trip._id)) ?? null,
  }));
  const participants = getUnreadParticipants({
    session,
    candidates,
  });
  const counts: Record<string, number> = Object.fromEntries(
    participants.map(({ tripId }) => [tripId, 0]),
  );
  if (participants.length > 0) {
    const unreadMatch = buildUnreadMessageMatch(participants).map(
      ({ tripId, ...criteria }) => ({
        tripId: new Types.ObjectId(tripId),
        ...criteria,
      }),
    );
    const aggregation = await Message.aggregate<{
      _id: Types.ObjectId;
      count: number;
    }>([
      { $match: { $or: unreadMatch } },
      { $group: { _id: "$tripId", count: { $sum: 1 } } },
    ]);
    for (const row of aggregation) counts[String(row._id)] = row.count;
  }

  return NextResponse.json(counts, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
