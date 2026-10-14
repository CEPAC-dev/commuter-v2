import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Message } from "@/models/Message";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { getTripChatAccess } from "@/lib/tripChatAccess";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type MessageRow = {
  _id: unknown;
  senderId: unknown;
  senderRole: "user" | "driver";
  text: string;
  createdAt: Date | string;
};

function shape(message: MessageRow, currentUserId: string) {
  return {
    id: String(message._id),
    text: message.text,
    senderRole: message.senderRole,
    isMine: String(message.senderId) === currentUserId,
    createdAt:
      message.createdAt instanceof Date
        ? message.createdAt.toISOString()
        : String(message.createdAt),
  };
}

async function loadAccess(tripId: string, session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  if (!Types.ObjectId.isValid(tripId)) return null;
  await connectDB();
  const trip = await Trip.findById(tripId).lean();
  if (!trip) return null;
  const ride = trip.rideId
    ? await Ride.findById(trip.rideId).select(
        "_id driverId status completedAt passengers.tripId passengers.status",
      ).lean()
    : null;
  return {
    trip,
    ride,
    access: getTripChatAccess({ session, trip, ride }),
  };
}

function accessError(reason: string) {
  if (reason === "chat_closed") {
    return NextResponse.json(
      { errorCode: "CHAT_CLOSED", error: "This trip chat is closed." },
      { status: 409 },
    );
  }
  return NextResponse.json(
    { errorCode: "CHAT_FORBIDDEN", error: "You are not a participant in this trip chat." },
    { status: 403 },
  );
}

function afterFilter(value: string | null) {
  if (!value) return {};
  if (Types.ObjectId.isValid(value)) {
    return { _id: { $gt: new Types.ObjectId(value) } };
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return { createdAt: { $gt: date } };
}

export async function GET(req: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { errorCode: "UNAUTHENTICATED", error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;
  const loaded = await loadAccess(id, session);
  if (!loaded) {
    return NextResponse.json(
      { errorCode: "TRIP_NOT_FOUND", error: "Trip not found." },
      { status: 404 },
    );
  }
  if (!loaded.access.allowed) return accessError(loaded.access.reason);

  const after = afterFilter(new URL(req.url).searchParams.get("after"));
  if (after === null) {
    return NextResponse.json(
      { errorCode: "INVALID_AFTER", error: "The after cursor is invalid." },
      { status: 400 },
    );
  }
  const query = { tripId: id, ...after };
  const messages = await Message.find(query)
    .sort({ createdAt: 1, _id: 1 })
    .lean<MessageRow[]>();

  return NextResponse.json({
    open: loaded.access.reason === "allowed",
    canWrite: loaded.access.canWrite,
    messages: messages.map((message) => shape(message, session.userId)),
  });
}

export async function POST(req: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { errorCode: "UNAUTHENTICATED", error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;
  const loaded = await loadAccess(id, session);
  if (!loaded) {
    return NextResponse.json(
      { errorCode: "TRIP_NOT_FOUND", error: "Trip not found." },
      { status: 404 },
    );
  }
  if (!loaded.access.allowed) return accessError(loaded.access.reason);
  if (!loaded.access.canWrite) {
    return NextResponse.json(
      { errorCode: "CHAT_READ_ONLY", error: "This chat is read-only." },
      { status: 403 },
    );
  }

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { errorCode: "INVALID_BODY", error: "Invalid request body." },
      { status: 400 },
    );
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json(
      { errorCode: "MESSAGE_EMPTY", error: "Message is empty." },
      { status: 400 },
    );
  }
  if (text.length > 2000) {
    return NextResponse.json(
      { errorCode: "MESSAGE_TOO_LONG", error: "Message is too long." },
      { status: 400 },
    );
  }

  const created = await Message.create({
    tripId: id,
    senderId: session.userId,
    senderRole: loaded.access.role === "driver" ? "driver" : "user",
    text,
  });

  return NextResponse.json(
    {
      message: shape(
        {
          _id: created._id,
          senderId: created.senderId,
          senderRole: created.senderRole,
          text: created.text,
          createdAt: created.createdAt,
        },
        session.userId,
      ),
    },
    { status: 201 },
  );
}
