import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { getSession } from "@/lib/auth/session";
import { notifyRideIncidentWithdrawn } from "@/lib/notifications/rideIncident";
import { getRideIncidentWithdrawalDecision } from "@/lib/rideIncidentGuards";
import { Ride } from "@/models/Ride";
import { RideIncident } from "@/models/RideIncident";

interface RouteContext {
  params: Promise<{ rideId: string }>;
}

interface IncidentRecord {
  _id: Types.ObjectId;
  rideId: Types.ObjectId;
  driverId: Types.ObjectId;
  affectedTripIds: Types.ObjectId[];
  status: string;
  resolution?: string | null;
}

class WithdrawConflictError extends Error {}

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { errorCode: "UNAUTHENTICATED", error: "Sign in to continue." },
      { status: 401 },
    );
  }
  if (session.role !== "driver") {
    return NextResponse.json(
      { errorCode: "FORBIDDEN", error: "Only the assigned driver can withdraw this report." },
      { status: 403 },
    );
  }

  const { rideId } = await params;
  if (!Types.ObjectId.isValid(rideId)) {
    return NextResponse.json(
      { errorCode: "RIDE_NOT_FOUND", error: "Ride not found." },
      { status: 404 },
    );
  }

  await connectDB();
  const ride = await Ride.findById(rideId)
    .select("driverId rideNumber hasOpenIncident __v")
    .lean();
  if (!ride) {
    return NextResponse.json(
      { errorCode: "RIDE_NOT_FOUND", error: "Ride not found." },
      { status: 404 },
    );
  }

  const isAssignedDriver = String(ride.driverId) === session.userId;
  const openIncident = await RideIncident.findOne({
    rideId,
    status: "open",
  })
    .select("_id rideId driverId affectedTripIds status resolution")
    .lean<IncidentRecord | null>();
  if (!openIncident) {
    const previous = await RideIncident.findOne({
      rideId,
      driverId: session.userId,
      status: "resolved",
      resolution: "withdrawn_by_driver",
    })
      .select("_id status resolution")
      .sort({ resolvedAt: -1 })
      .lean<{ _id: Types.ObjectId; status: string; resolution: string } | null>();
    const decision = getRideIncidentWithdrawalDecision({
      isAssignedDriver,
      incidentStatus: previous?.status ?? null,
      resolution: previous?.resolution,
    });
    if (decision.kind === "forbidden") {
      return NextResponse.json(
        { errorCode: "FORBIDDEN", error: "Only the assigned driver can withdraw this report." },
        { status: 403 },
      );
    }
    if (decision.kind === "already_withdrawn") {
      return NextResponse.json({
        success: true,
        resolution: "withdrawn_by_driver",
        idempotent: true,
      });
    }
    return NextResponse.json(
      { errorCode: "NO_OPEN_INCIDENT", error: "There is no open report to withdraw." },
      { status: 409 },
    );
  }

  const decision = getRideIncidentWithdrawalDecision({
    isAssignedDriver,
    incidentStatus: openIncident.status,
    resolution: openIncident.resolution,
  });
  if (decision.kind === "forbidden") {
    return NextResponse.json(
      { errorCode: "FORBIDDEN", error: "Only the assigned driver can withdraw this report." },
      { status: 403 },
    );
  }

  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      const currentIncident = await RideIncident.findOneAndUpdate(
        {
          _id: openIncident._id,
          rideId,
          driverId: session.userId,
          status: "open",
        },
        {
          $set: {
            status: "resolved",
            resolution: "withdrawn_by_driver",
            resolvedBy: new Types.ObjectId(session.userId),
            resolvedAt: new Date(),
            needsFollowUpTripIds: [],
          },
        },
        { new: true, session: dbSession },
      )
        .lean<IncidentRecord | null>();
      if (!currentIncident) throw new WithdrawConflictError();

      const rideVersionFilter =
        typeof ride.__v === "number"
          ? { __v: ride.__v }
          : { __v: { $exists: false } };
      const updatedRide = await Ride.updateOne(
        {
          _id: rideId,
          driverId: session.userId,
          hasOpenIncident: true,
          ...rideVersionFilter,
        },
        { $set: { hasOpenIncident: false }, $inc: { __v: 1 } },
        { session: dbSession },
      );
      if (updatedRide.matchedCount !== 1) throw new WithdrawConflictError();
    });
  } catch (error) {
    if (error instanceof WithdrawConflictError) {
      const latest = await RideIncident.findById(openIncident._id)
        .select("status resolution")
        .lean<{ status: string; resolution?: string | null } | null>();
      if (
        getRideIncidentWithdrawalDecision({
          isAssignedDriver,
          incidentStatus: latest?.status ?? null,
          resolution: latest?.resolution,
        }).kind === "already_withdrawn"
      ) {
        return NextResponse.json({
          success: true,
          resolution: "withdrawn_by_driver",
          idempotent: true,
        });
      }
      return NextResponse.json(
        { errorCode: "NO_OPEN_INCIDENT", error: "There is no open report to withdraw." },
        { status: 409 },
      );
    }
    console.error("[ride-incident] Driver withdrawal failed");
    return NextResponse.json(
      { errorCode: "WITHDRAW_FAILED", error: "Could not withdraw this report." },
      { status: 500 },
    );
  } finally {
    await dbSession.endSession();
  }

  await notifyRideIncidentWithdrawn({
    incidentId: String(openIncident._id),
    rideId,
    rideNumber: Number(ride.rideNumber ?? 0),
    driverId: session.userId,
    tripIds: openIncident.affectedTripIds.map(String),
  });
  return NextResponse.json({
    success: true,
    resolution: "withdrawn_by_driver",
    idempotent: false,
  });
}
