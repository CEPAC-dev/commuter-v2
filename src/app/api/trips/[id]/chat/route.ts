import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Message } from "@/models/Message";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type MessageRow = {
  _id: unknown;
  senderId: unknown;
  senderRole: string;
  text: string;
  createdAt: Date | string;
};

function shape(m: MessageRow, currentUserId: string) {
  return {
    id: String(m._id),
    message: m.text,
    is_mine: String(m.senderId) === currentUserId,
    sender: { name: m.senderRole === "driver" ? "Driver" : "You" },
    created_at:
      m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
  };
}

async function assertOwnedTrip(tripId: string, userId: string) {
  if (!Types.ObjectId.isValid(tripId)) return null;
  return Trip.findOne({ _id: tripId, userId }).select("_id").lean();
}

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const trip = await assertOwnedTrip(id, session.userId);
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const messages = await Message.find({ tripId: id })
    .sort({ createdAt: 1 })
    .lean<MessageRow[]>();

  return NextResponse.json({
    data: messages.map((m) => shape(m, session.userId)),
  });
}

export async function POST(req: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  await connectDB();

  const trip = await assertOwnedTrip(id, session.userId);
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const created = await Message.create({
    tripId: id,
    senderId: session.userId,
    senderRole: "user",
    text,
  });

  return NextResponse.json(
    {
      data: shape(
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
