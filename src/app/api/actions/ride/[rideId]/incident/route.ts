import mongoose, { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { getSession } from "@/lib/auth/session";
import { enforceRateLimitByIdentity } from "@/lib/security/rateLimit";
import {
  getRideIncidentReportDecision,
  type RideIncidentType,
} from "@/lib/rideIncidentGuards";
import { Ride } from "@/models/Ride";
import { RideIncident } from "@/models/RideIncident";
import { Trip } from "@/models/Trip";
import { notifyRideIncidentCreated } from "@/lib/notifications/rideIncident";

class IncidentConflictError extends Error {
  constructor() {
    super("Incident report conflicts with the current ride state.");
  }
}

async function existingIncidentResponse(rideId: string) {
  const incident = await RideIncident.findOne({ rideId, status: "open" })
    .select("_id")
    .lean();
  return NextResponse.json(
    {
      success: false,
      errorCode: "ALREADY_REPORTED",
      error: "An incident is already open for this ride.",
      incidentId: incident?._id?.toString() ?? null,
    },
    { status: 409 },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ rideId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  if (session.role !== "driver") {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const { rideId } = await context.params;
  if (!Types.ObjectId.isValid(rideId)) {
    return NextResponse.json(
      { success: false, error: "Ride not found" },
      { status: 404 },
    );
  }

  let body: { type?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, errorCode: "INVALID_BODY", error: "Invalid request body." },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const ride = await Ride.findById(rideId)
      .select("driverId status hasOpenIncident __v")
      .lean();
    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Ride not found" },
        { status: 404 },
      );
    }

    const decision = getRideIncidentReportDecision({
      isAssignedDriver: ride.driverId?.toString() === session.userId,
      rideStatus: ride.status,
      hasOpenIncident: ride.hasOpenIncident === true,
      type: body.type,
      note: body.note,
    });
    if (decision.kind === "forbidden") {
      return NextResponse.json(
        { success: false, error: "Forbidden - not your ride" },
        { status: 403 },
      );
    }
    if (decision.kind === "invalid_type") {
      return NextResponse.json(
        { success: false, errorCode: "INVALID_INCIDENT_TYPE", error: "Invalid incident type." },
        { status: 400 },
      );
    }
    if (decision.kind === "invalid_note") {
      return NextResponse.json(
        { success: false, errorCode: "INVALID_NOTE", error: "Note must be text." },
        { status: 400 },
      );
    }
    if (decision.kind === "note_too_long") {
      return NextResponse.json(
        { success: false, errorCode: "NOTE_TOO_LONG", error: "Note must be 300 characters or fewer." },
        { status: 400 },
      );
    }
    if (decision.kind === "status_conflict") {
      return NextResponse.json(
        { success: false, errorCode: "RIDE_STATUS_CONFLICT", error: "Only confirmed or active rides can report an incident." },
        { status: 409 },
      );
    }
    if (decision.kind === "already_reported") {
      return existingIncidentResponse(rideId);
    }

    const limited = await enforceRateLimitByIdentity(
      "ride-incident-report",
      session.userId,
      { limit: 5, windowMs: 60 * 60 * 1000 },
      "INCIDENT_RATE_LIMITED",
    );
    if (limited) return limited;

    const dbSession = await mongoose.startSession();
    let incidentId = "";
    try {
      await dbSession.withTransaction(async () => {
        const currentRide = await Ride.findById(rideId)
          .select("driverId status hasOpenIncident __v")
          .session(dbSession)
          .lean();
        const currentDecision = currentRide
          ? getRideIncidentReportDecision({
              isAssignedDriver:
                currentRide.driverId?.toString() === session.userId,
              rideStatus: currentRide.status,
              hasOpenIncident: currentRide.hasOpenIncident === true,
              type: body.type,
              note: body.note,
            })
          : { kind: "status_conflict" as const };
        if (currentDecision.kind === "already_reported") {
          throw new IncidentConflictError();
        }
        if (currentDecision.kind !== "allowed" || !currentRide) {
          throw new IncidentConflictError();
        }

        const affectedTrips = await Trip.find({
          rideId,
          status: { $ne: "cancelled" },
        })
          .select("_id userId")
          .session(dbSession)
          .lean<{ _id: Types.ObjectId; userId: Types.ObjectId }[]>();
        const versionFilter =
          typeof currentRide.__v === "number"
            ? { __v: currentRide.__v }
            : { __v: { $exists: false } };
        const updatedRide = await Ride.findOneAndUpdate(
          {
            _id: rideId,
            driverId: session.userId,
            status: { $in: ["confirmed", "active"] },
            hasOpenIncident: { $ne: true },
            ...versionFilter,
          },
          { $set: { hasOpenIncident: true }, $inc: { __v: 1 } },
          { new: true, session: dbSession },
        ).lean();
        if (!updatedRide) throw new IncidentConflictError();

        const [created] = await RideIncident.create(
          [
            {
              rideId: new Types.ObjectId(rideId),
              driverId: new Types.ObjectId(session.userId),
              type: body.type as RideIncidentType,
              ...(currentDecision.note ? { note: currentDecision.note } : {}),
              rideStatusAtReport: currentRide.status,
              affectedTripIds: affectedTrips.map((trip) => trip._id),
            },
          ],
          { session: dbSession },
        );
        incidentId = created._id.toString();
      });
    } finally {
      await dbSession.endSession();
    }

    await notifyRideIncidentCreated(incidentId);
    return NextResponse.json(
      { success: true, incidentId, status: "open" },
      { status: 201 },
    );
  } catch (error) {
    const duplicateKey =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000;
    if (duplicateKey) {
      return existingIncidentResponse(rideId);
    }
    if (error instanceof IncidentConflictError) {
      const currentRide = await Ride.findById(rideId)
        .select("driverId status hasOpenIncident")
        .lean();
      if (currentRide?.hasOpenIncident) {
        return existingIncidentResponse(rideId);
      }
      if (!currentRide) {
        return NextResponse.json(
          { success: false, error: "Ride not found" },
          { status: 404 },
        );
      }
      if (currentRide.driverId?.toString() !== session.userId) {
        return NextResponse.json(
          { success: false, error: "Forbidden - not your ride" },
          { status: 403 },
        );
      }
      if (!["confirmed", "active"].includes(currentRide.status)) {
        return NextResponse.json(
          { success: false, errorCode: "RIDE_STATUS_CONFLICT", error: "Only confirmed or active rides can report an incident." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { success: false, errorCode: "RIDE_CHANGED", error: "Ride changed while reporting. Please retry." },
        { status: 409 },
      );
    }
    console.error("[ride-incident] Report creation failed");
    return NextResponse.json(
      { success: false, error: "Unable to report this problem." },
      { status: 500 },
    );
  }
}
