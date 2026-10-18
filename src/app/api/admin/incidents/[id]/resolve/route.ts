import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { getAdminSettings } from "@/lib/cancellationPolicy";
import {
  getIncidentResolutionDecision,
  needsIncidentFollowUp,
  shouldResetTripForIncidentCancellation,
} from "@/lib/rideIncidentAdminGuards";
import { notifyRideIncidentOutcome } from "@/lib/notifications/rideIncident";
import { Log } from "@/models/Log";
import { Ride } from "@/models/Ride";
import { RideIncident } from "@/models/RideIncident";
import { Trip } from "@/models/Trip";
import { Wallet } from "@/models/Wallet";
import { WalletTransaction } from "@/models/WalletTransaction";
import { buildPenaltyWalletUpdate, computePenaltyApplication } from "@/lib/walletPenalty";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface IncidentForResolution {
  _id: Types.ObjectId;
  rideId: Types.ObjectId;
  driverId: Types.ObjectId;
  affectedTripIds: Types.ObjectId[];
  status: string;
}

interface RideForResolution {
  _id: Types.ObjectId;
  driverId?: Types.ObjectId;
  status: string;
  totalCost: number;
  rideNumber?: number;
  __v?: number;
  passengers?: { tripId: Types.ObjectId; status: string }[];
}

interface TripForResolution {
  _id: Types.ObjectId;
  status: string;
  paymentStatus: string;
  userId: Types.ObjectId;
}

class ResolutionError extends Error {
  constructor(
    readonly errorCode: string,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function decisionError(kind: string): ResolutionError {
  if (kind === "already_resolved") {
    return new ResolutionError(
      "ALREADY_RESOLVED",
      409,
      "This incident has already been resolved.",
    );
  }
  if (kind === "invalid_action") {
    return new ResolutionError(
      "INVALID_ACTION",
      400,
      "Choose a valid incident resolution action.",
    );
  }
  if (kind === "note_required") {
    return new ResolutionError(
      "ADMIN_NOTE_REQUIRED",
      400,
      "An admin note is required.",
    );
  }
  if (kind === "note_too_long") {
    return new ResolutionError(
      "ADMIN_NOTE_TOO_LONG",
      400,
      "The admin note must be 500 characters or fewer.",
    );
  }
  if (kind === "invalid_penalty") {
    return new ResolutionError(
      "INVALID_PENALTY",
      400,
      "Penalty must be a finite non-negative amount.",
    );
  }
  if (kind === "penalty_too_large") {
    return new ResolutionError(
      "PENALTY_TOO_LARGE",
      400,
      "Penalty exceeds the configured maximum.",
    );
  }
  return new ResolutionError(
    "RIDE_STATUS_CONFLICT",
    409,
    "This action is not available for the current ride status.",
  );
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await adminAuth();
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { errorCode: "INCIDENT_NOT_FOUND", error: "Incident not found." },
      { status: 404 },
    );
  }

  let body: {
    action?: unknown;
    adminNote?: unknown;
    penaltyEgp?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { errorCode: "INVALID_BODY", error: "Invalid request body." },
      { status: 400 },
    );
  }

  await connectDB();
  const settings = await getAdminSettings();
  const highestTierPercent = Math.max(
    0,
    ...settings.cancellationTiers
      .filter((tier) => tier.action === "ride_only")
      .map((tier) => Number(tier.penaltyPercent))
      .filter(Number.isFinite),
  );
  const dbSession = await mongoose.startSession();
  let result:
    | {
        action: "continue" | "cancel_no_penalty" | "cancel_with_penalty";
        needsFollowUpTripIds: string[];
        rideNumber: number;
        driverId: string;
        affectedTripIds: string[];
        penaltyEgp: number;
        addedDebtEgp: number;
      }
    | undefined;

  try {
    await dbSession.withTransaction(async () => {
      const incident = await RideIncident.findById(id)
        .session(dbSession)
        .lean<IncidentForResolution | null>();
      if (!incident) {
        throw new ResolutionError(
          "INCIDENT_NOT_FOUND",
          404,
          "Incident not found.",
        );
      }
      const ride = await Ride.findById(incident.rideId)
        .select("driverId status totalCost rideNumber __v passengers")
        .session(dbSession)
        .lean<RideForResolution | null>();
      if (!ride) {
        throw new ResolutionError("RIDE_NOT_FOUND", 404, "Ride not found.");
      }

      const maxPenaltyEgp = Math.round(
        (ride.totalCost * highestTierPercent + Number.EPSILON) / 100,
      );
      const decision = getIncidentResolutionDecision({
        incidentStatus: incident.status,
        rideStatus: ride.status,
        action: body.action,
        adminNote: body.adminNote,
        penaltyEgp: body.penaltyEgp,
        maxPenaltyEgp,
      });
      if (decision.kind !== "allowed") throw decisionError(decision.kind);

      const rideVersionFilter =
        typeof ride.__v === "number"
          ? { __v: ride.__v }
          : { __v: { $exists: false } };
      const isCancellation = decision.action !== "continue";
      const rideUpdate = isCancellation
        ? {
            $set: {
              status: "cancelled",
              hasOpenIncident: false,
              cancellation: {
                cancelledAt: new Date(),
                tier: "admin_incident",
                penaltyPercent:
                  ride.totalCost > 0
                    ? (decision.penaltyEgp / ride.totalCost) * 100
                    : 0,
                penaltyAmount: decision.penaltyEgp,
                availabilityRemoved: false,
                reason: "Cancelled by admin after incident review",
              },
            },
            $inc: { __v: 1 },
          }
        : {
            $set: { hasOpenIncident: false },
            $inc: { __v: 1 },
          };
      const updatedRide = await Ride.updateOne(
        {
          _id: ride._id,
          status: ride.status,
          hasOpenIncident: true,
          ...rideVersionFilter,
        },
        rideUpdate,
        { session: dbSession },
      );
      if (updatedRide.matchedCount !== 1) {
        throw new ResolutionError(
          "RIDE_CHANGED",
          409,
          "Ride changed while resolving the incident.",
        );
      }

      let needsFollowUpTripIds: Types.ObjectId[] = [];
      let addedDebtEgp = 0;
      if (isCancellation) {
        const trips = await Trip.find({
          _id: { $in: incident.affectedTripIds },
          rideId: ride._id,
        })
          .select("_id status paymentStatus userId")
          .session(dbSession)
          .lean<TripForResolution[]>();
        const passengerStatusByTripId = new Map(
          (ride.passengers ?? []).map((passenger) => [
            String(passenger.tripId),
            passenger.status,
          ]),
        );
        const followUpTrips = trips.filter((trip) => {
          if (trip.status === "cancelled") return false;
          return needsIncidentFollowUp(
            trip.status,
            passengerStatusByTripId.get(String(trip._id)) ?? "unknown",
          );
        });
        needsFollowUpTripIds = followUpTrips.map((trip) => trip._id);
        const resettableTripIds = trips
          .filter(
            (trip) =>
              trip.status !== "cancelled" &&
              shouldResetTripForIncidentCancellation(
                trip.status,
                passengerStatusByTripId.get(String(trip._id)) ?? "unknown",
              ),
          )
          .map((trip) => trip._id);

        if (resettableTripIds.length > 0) {
          await Trip.updateMany(
            {
              _id: { $in: resettableTripIds },
              rideId: ride._id,
              status: { $in: ["matched", "confirmed", "active"] },
            },
            {
              $set: {
                rideId: null,
                status: "submitted",
                driverId: null,
                assignedDriver: null,
                seatNumbers: [],
              },
            },
            { session: dbSession },
          );
        }

        if (
          decision.action === "cancel_with_penalty" &&
          decision.penaltyEgp > 0
        ) {
          if (!ride.driverId) {
            throw new ResolutionError(
              "DRIVER_NOT_FOUND",
              409,
              "A driver wallet cannot be identified for this ride.",
            );
          }
          const userId = new Types.ObjectId(String(ride.driverId));
          const appliedAt = new Date();
          const walletBefore = await Wallet.findOneAndUpdate(
            { userId },
            buildPenaltyWalletUpdate(userId, decision.penaltyEgp, appliedAt),
            { returnDocument: "before", upsert: true, session: dbSession },
          );
          const application = computePenaltyApplication({
            balanceEgp: walletBefore?.balanceEgp ?? 0,
            owedEgp: walletBefore?.owedEgp ?? 0,
            penaltyEgp: decision.penaltyEgp,
          });
          addedDebtEgp = application.addedDebtEgp;
          if (application.deductedEgp > 0) {
            await WalletTransaction.create(
              [
                {
                  userId,
                  type: "cancellation_penalty",
                  amountEgp: application.deductedEgp,
                  status: "completed",
                  description: `Admin incident penalty for ride #${ride.rideNumber ?? ride._id}`,
                  balanceAfterEgp: application.newBalanceEgp,
                  rideId: ride._id,
                },
              ],
              { session: dbSession },
            );
          }
          await Log.create(
            [
              {
                userId,
                driverId: userId,
                rideId: ride._id,
                status: "cancelled",
                action: "custom_action",
                description: "Admin applied a penalty after ride incident review.",
                actorType: "admin",
                actorId: new Types.ObjectId(authorization.userId),
                actionTimestamp: appliedAt,
                metadata: {
                  eventType: "admin_incident_penalty_applied",
                  incidentId: String(incident._id),
                  penaltyEgp: decision.penaltyEgp,
                  deductedEgp: application.deductedEgp,
                  addedDebtEgp: application.addedDebtEgp,
                },
              },
            ],
            { session: dbSession },
          );
        }
      }

      const resolvedAt = new Date();
      const updatedIncident = await RideIncident.findOneAndUpdate(
        { _id: incident._id, status: "open" },
        {
          $set: {
            status: "resolved",
            resolution: decision.action,
            adminNote: decision.adminNote,
            resolvedBy: new Types.ObjectId(authorization.userId),
            resolvedAt,
            needsFollowUpTripIds,
          },
        },
        { new: true, session: dbSession },
      );
      if (!updatedIncident) throw decisionError("already_resolved");

      result = {
        action: decision.action,
        needsFollowUpTripIds: needsFollowUpTripIds.map(String),
        rideNumber: ride.rideNumber ?? 0,
        driverId: String(ride.driverId ?? incident.driverId),
        affectedTripIds: incident.affectedTripIds.map(String),
        penaltyEgp: decision.penaltyEgp,
        addedDebtEgp,
      };
    });
  } catch (error) {
    if (error instanceof ResolutionError) {
      return NextResponse.json(
        { errorCode: error.errorCode, error: error.message },
        { status: error.statusCode },
      );
    }
    console.error("[ride-incident] Resolution failed");
    return NextResponse.json(
      { errorCode: "RESOLUTION_FAILED", error: "Could not resolve this incident." },
      { status: 500 },
    );
  } finally {
    await dbSession.endSession();
  }

  if (!result) {
    return NextResponse.json(
      { errorCode: "RESOLUTION_FAILED", error: "Could not resolve this incident." },
      { status: 500 },
    );
  }
  await notifyRideIncidentOutcome({
    incidentId: id,
    outcome: result.action === "continue" ? "continue" : "cancelled",
    driverId: result.driverId,
    tripIds: result.affectedTripIds,
  });

  return NextResponse.json({
    success: true,
    action: result.action,
    needsFollowUpTripIds: result.needsFollowUpTripIds,
    penaltyEgp: result.penaltyEgp,
    addedDebtEgp: result.addedDebtEgp,
  });
}
