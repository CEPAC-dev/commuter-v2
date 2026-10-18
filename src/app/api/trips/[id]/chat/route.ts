import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Message } from "@/models/Message";
import { Log } from "@/models/Log";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { getTripChatAccess } from "@/lib/tripChatAccess";
import {
  isChatFreeTextEnabled,
  isChatPreset,
  type ChatPresetKey,
} from "@/lib/chatPresets";
import {
  enforceRateLimitByIdentity,
  getRateLimitCounterByIdentity,
  incrementRateLimitCounterByIdentity,
} from "@/lib/security/rateLimit";
import { checkChatText } from "@/lib/chatTextFilter";
import { buildChatNotificationPlan } from "@/lib/chatNotification";
import { createNotification } from "@/lib/notifications/createNotification";
import {
  CHAT_FREE_TEXT_STRIKE_WINDOW_MS,
  isChatFreeTextAllowed,
  isChatFreeTextSuspended,
} from "@/lib/chatFreeTextStrikes";

const CHAT_STRIKE_SCOPE = "trip-chat-contact-block";

function chatStrikeIdentity(userId: string, tripId: string) {
  return `${userId}:${tripId}`;
}

async function logChatStrike(
  input: {
    tripId: string;
    rideId?: unknown;
    userId: string;
    status: string;
    role: "passenger" | "driver";
    count: number;
    suspended: boolean;
  },
) {
  const base = {
    tripId: input.tripId,
    rideId: input.rideId ?? null,
    userId: input.userId,
    status: input.status,
    metadata: { count: input.count },
    actorType: input.role === "driver" ? "driver" : "user",
    actorId: input.userId,
  };
  await Log.create([
    {
      ...base,
      action: "chat_contact_blocked",
      description: "Contact information was blocked in trip chat.",
    },
    ...(input.suspended
      ? [
          {
            ...base,
            action: "chat_free_text_suspended",
            description:
              "Free-text chat suspended after repeated contact-information blocks.",
          },
        ]
      : []),
  ]);
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

type MessageRow = {
  _id: unknown;
  senderId: unknown;
  senderRole: "user" | "driver";
  kind: "text" | "preset";
  presetKey?: string;
  text?: string;
  createdAt: Date | string;
};

function shape(message: MessageRow, currentUserId: string) {
  return {
    id: String(message._id),
    kind: message.kind ?? "text",
    presetKey: message.presetKey,
    text: message.text ?? "",
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

  const limited = await enforceRateLimitByIdentity(
    "trip-chat-read",
    session.userId,
    { limit: 600, windowMs: 5 * 60_000 },
    "CHAT_RATE_LIMITED",
  );
  if (limited) return limited;

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
  const blockedCount = await getRateLimitCounterByIdentity(
    CHAT_STRIKE_SCOPE,
    chatStrikeIdentity(session.userId, id),
    CHAT_FREE_TEXT_STRIKE_WINDOW_MS,
  );

  return NextResponse.json({
    open: loaded.access.reason === "allowed",
    canWrite: loaded.access.canWrite,
    freeTextAllowed: isChatFreeTextAllowed({
      enabled: isChatFreeTextEnabled(),
      canWrite: loaded.access.canWrite,
      blockedCount,
    }),
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
  const limited = await enforceRateLimitByIdentity(
    "trip-chat-write",
    `${session.userId}:${id}`,
    { limit: 30, windowMs: 5 * 60_000 },
    "CHAT_RATE_LIMITED",
  );
  if (limited) return limited;

  let body: { kind?: unknown; presetKey?: unknown; text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { errorCode: "INVALID_BODY", error: "Invalid request body." },
      { status: 400 },
    );
  }
  const kind = body.kind ?? "text";
  const senderRole = loaded.access.role === "driver" ? "driver" : "passenger";
  let text: string | undefined;
  let presetKey: ChatPresetKey | undefined;
  if (kind === "preset") {
    if (!isChatPreset(senderRole, body.presetKey)) {
      return NextResponse.json(
        { errorCode: "INVALID_PRESET", error: "This preset is not available to you." },
        { status: 400 },
      );
    }
    presetKey = body.presetKey;
  } else if (kind === "text") {
    if (!isChatFreeTextEnabled()) {
      return NextResponse.json(
        { errorCode: "FREE_TEXT_DISABLED", error: "Free-text chat is disabled." },
        { status: 403 },
      );
    }
    const identity = chatStrikeIdentity(session.userId, id);
    const currentBlockedCount = await getRateLimitCounterByIdentity(
      CHAT_STRIKE_SCOPE,
      identity,
      CHAT_FREE_TEXT_STRIKE_WINDOW_MS,
    );
    if (isChatFreeTextSuspended(currentBlockedCount)) {
      return NextResponse.json(
        {
          errorCode: "FREE_TEXT_SUSPENDED",
          error: "Free-text chat is suspended for this trip.",
        },
        { status: 403 },
      );
    }
    text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json(
        { errorCode: "MESSAGE_EMPTY", error: "Message is empty." },
        { status: 400 },
      );
    }
    if (text.length > 500) {
      return NextResponse.json(
        { errorCode: "MESSAGE_TOO_LONG", error: "Message is too long." },
        { status: 400 },
      );
    }
    if (!checkChatText(text).ok) {
      const blockedCount = await incrementRateLimitCounterByIdentity(
        CHAT_STRIKE_SCOPE,
        identity,
        CHAT_FREE_TEXT_STRIKE_WINDOW_MS,
      );
      const suspended = isChatFreeTextSuspended(blockedCount);
      await logChatStrike({
        tripId: id,
        rideId: loaded.trip.rideId,
        userId: session.userId,
        status: loaded.trip.status,
        role: senderRole,
        count: blockedCount,
        suspended,
      });
      return NextResponse.json(
        {
          errorCode: suspended
            ? "FREE_TEXT_SUSPENDED"
            : "CONTACT_INFO_BLOCKED",
          error: suspended
            ? "Free-text chat is suspended for this trip."
            : "This message may contain contact information. Please keep chat in the app.",
        },
        { status: suspended ? 403 : 422 },
      );
    }
  } else {
    return NextResponse.json(
      { errorCode: "INVALID_MESSAGE_KIND", error: "Unsupported message kind." },
      { status: 400 },
    );
  }

  const created = await Message.create({
    tripId: id,
    senderId: session.userId,
    senderRole: senderRole === "driver" ? "driver" : "user",
    kind,
    ...(presetKey ? { presetKey } : {}),
    text,
  });

  const ride = loaded.ride;
  const passengerManifest = (ride?.passengers ?? []) as Array<{
    tripId: unknown;
    passengerNumber?: number;
  }>;
  const passengerIndex =
    passengerManifest.findIndex((passenger) => String(passenger.tripId) === id);
  const passengerNumber =
    passengerIndex >= 0
      ? passengerManifest[passengerIndex]?.passengerNumber ?? passengerIndex + 1
      : 1;
  const recipientId =
    senderRole === "driver"
      ? String(loaded.trip.userId)
      : ride?.driverId
        ? String(ride.driverId)
        : null;
  if (ride && recipientId) {
    const notification = buildChatNotificationPlan({
      senderRole: senderRole === "driver" ? "driver" : "user",
      recipientId,
      tripId: id,
      rideId: String(ride._id),
      kind,
      presetKey,
      passengerNumber,
    });
    if (notification) {
      try {
        const limited = await enforceRateLimitByIdentity(
          "trip-chat-notification",
          `${notification.recipientId}:${id}:${notification.throttleKey}`,
          { limit: 1, windowMs: notification.windowMs },
          "CHAT_NOTIFICATION_THROTTLED",
        );
        if (!limited) await createNotification(notification.payload);
      } catch {
        console.error("Trip chat notification delivery failed.");
      }
    }
  }

  return NextResponse.json(
    {
      message: shape(
        {
          _id: created._id,
          senderId: created.senderId,
          senderRole: created.senderRole,
          kind: created.kind,
          presetKey: created.presetKey,
          text: created.text,
          createdAt: created.createdAt,
        },
        session.userId,
      ),
    },
    { status: 201 },
  );
}
