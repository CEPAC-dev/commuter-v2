import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import {
  buildChatReportSnapshot,
  isAlreadyReported,
  validateChatReportInput,
} from "@/lib/chatReports";
import { getTripChatAccess } from "@/lib/tripChatAccess";
import { enforceRateLimitByIdentity } from "@/lib/security/rateLimit";
import { notifyAdmins } from "@/lib/notifications/adminActivity";
import { ChatReport } from "@/models/ChatReport";
import { Message } from "@/models/Message";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === 11000,
  );
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
  if (access.role !== "passenger" && access.role !== "driver") {
    return NextResponse.json(
      { errorCode: "CHAT_FORBIDDEN", error: "You cannot report this chat." },
      { status: 403 },
    );
  }

  const limited = await enforceRateLimitByIdentity(
    "trip-chat-report",
    session.userId,
    { limit: 5, windowMs: 60 * 60_000 },
    "CHAT_REPORT_RATE_LIMITED",
  );
  if (limited) return limited;

  let body: { reason?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { errorCode: "INVALID_BODY", error: "Invalid request body." },
      { status: 400 },
    );
  }
  const validated = validateChatReportInput(body);
  if (!validated.ok) {
    const messages: Record<string, string> = {
      INVALID_REPORT_REASON: "Choose a valid report reason.",
      INVALID_REPORT_NOTE: "The report note is invalid.",
      REPORT_NOTE_TOO_LONG: "The note must be 300 characters or fewer.",
    };
    return NextResponse.json(
      {
        errorCode: validated.errorCode,
        error: messages[validated.errorCode],
      },
      { status: 400 },
    );
  }

  const existing = await ChatReport.exists({
    reporterId: session.userId,
    tripId: id,
    status: "open",
  });
  if (isAlreadyReported(Boolean(existing))) {
    return NextResponse.json(
      { errorCode: "ALREADY_REPORTED", error: "You already have an open report for this trip." },
      { status: 409 },
    );
  }

  const recentMessages = await Message.find({ tripId: id })
    .select("senderRole kind presetKey text createdAt -_id")
    .sort({ createdAt: -1, _id: -1 })
    .limit(30)
    .lean();
  const snapshot = buildChatReportSnapshot(recentMessages);

  let report;
  try {
    report = await ChatReport.create({
      tripId: id,
      rideId: ride?._id,
      reporterId: session.userId,
      reporterRole: access.role,
      reason: validated.reason,
      ...(validated.note ? { note: validated.note } : {}),
      snapshot,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { errorCode: "ALREADY_REPORTED", error: "You already have an open report for this trip." },
        { status: 409 },
      );
    }
    throw error;
  }

  await notifyAdmins({
    eventType: "trip_chat_reported",
    dedupeKey: `chat-report:${String(report._id)}`,
    title: "New trip chat report",
    body: "A participant submitted a trip chat report for review.",
    data: {
      href: "/admin/chat-reports",
      reportId: String(report._id),
      tripId: id,
      rideId: ride?._id ? String(ride._id) : null,
    },
  });

  return NextResponse.json(
    { reportId: String(report._id), status: report.status },
    { status: 201 },
  );
}
