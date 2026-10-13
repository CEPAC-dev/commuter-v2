import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Payment } from "@/models/Payment";
import { WalletTransaction } from "@/models/WalletTransaction";
import { Request } from "@/models/Request";
import { RefundRequest } from "@/models/RefundRequest";
import { Ride } from "@/models/Ride";
import { Log } from "@/models/Log";
import { evaluateTripCancellation } from "@/lib/passengerCancellationPolicy";
import { wasMoneyTaken } from "@/lib/requestPaymentState";
import {
  buildPassengerTripCancellationFilter,
  getStandaloneTripCancellationMode,
  isStandaloneTripForCancellation,
  runStandaloneTripCancellation,
} from "@/lib/standaloneTripCancellation";
import { cancelStandaloneTripPayments } from "@/lib/services/standaloneTripExpiry";
import {
  releasePromoCodeUsageForTrip,
  releasePromoForRequest,
} from "@/lib/promoCode";
import { releaseReservation } from "@/lib/wallet/wallet";
import {
  cancelRequestDay,
  RequestGroupCancellationError,
} from "@/lib/requestGroupCancellation";
import { logMultiDayEvent } from "@/lib/logging/multiday";

const REQUEST_NOT_CANCELLABLE = "REQUEST_NOT_CANCELLABLE";

async function getParentCancellationConflict(requestId: unknown) {
  const request = await Request.findById(requestId)
    .select("status paymentStatus")
    .lean<{ status?: string; paymentStatus?: string }>();
  if (request?.status === "waiting_list" || request?.status === "rejected") {
    return NextResponse.json(
      {
        errorCode: REQUEST_NOT_CANCELLABLE,
        error: "Trips in waiting or rejected requests cannot be cancelled individually.",
      },
      { status: 409 },
    );
  }
  if (!wasMoneyTaken(request?.paymentStatus)) {
    return NextResponse.json(
      {
        errorCode: "TRIP_NOT_PAID",
        error: "This trip has not been paid for, so it cannot be cancelled.",
      },
      { status: 409 },
    );
  }
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const trip = await Trip.findOne(
      buildPassengerTripCancellationFilter(id, session.userId),
    ).lean();

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (isStandaloneTripForCancellation(trip)) {
      const mode = getStandaloneTripCancellationMode({
        id: String(trip._id),
        status: trip.status,
        paymentStatus: trip.paymentStatus,
      });
      if (mode.kind === "blocked") {
        return NextResponse.json(
          { errorCode: mode.errorCode, error: mode.error },
          { status: mode.httpStatus },
        );
      }

      const policyEvaluation = await evaluateTripCancellation(
        trip.date,
        trip.priceEgp,
      );
      const evaluation = mode.kind === "unpaid"
        ? {
            ...policyEvaluation,
            allowed: true,
            refundPercent: 0,
            penaltyPercent: 0,
            refundAmount: 0,
            retainedAmount: 0,
          }
        : policyEvaluation;

      return NextResponse.json({
        success: true,
        tripId: trip._id,
        tripNumber: trip.tripNumber,
        date: trip.date,
        priceEgp: trip.priceEgp,
        status: trip.status,
        evaluation,
      });
    }

    const parentConflict = await getParentCancellationConflict(trip.requestId);
    if (parentConflict) return parentConflict;

    const evaluation = await evaluateTripCancellation(
      trip.date,
      trip.priceEgp,
    );

    return NextResponse.json({
      success: true,
      tripId: trip._id,
      tripNumber: trip.tripNumber,
      date: trip.date,
      priceEgp: trip.priceEgp,
      status: trip.status,
      evaluation,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = body.reason || "Passenger requested cancellation";

    await connectDB();

    const trip = await Trip.findOne(
      buildPassengerTripCancellationFilter(id, session.userId),
    );

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (trip.requestId) {
      const parent = await Request.findById(trip.requestId)
        .select("paymentStatus")
        .lean<{ paymentStatus?: string }>();
      if (parent?.paymentStatus === "pending") {
        try {
          const result = await cancelRequestDay({
            requestId: String(trip.requestId),
            tripId: String(trip._id),
            userId: session.userId,
            reason,
          });
          logMultiDayEvent({
            event: "day_cancelled",
            requestId: String(trip.requestId),
            userId: session.userId,
            counts: {
              cancelledTrips: 1,
              remainingTrips: result.remainingTrips.length,
            },
          });
          return NextResponse.json({ success: true, ...result });
        } catch (error) {
          if (error instanceof RequestGroupCancellationError) {
            logMultiDayEvent({
              event: "cancel_blocked",
              requestId: String(trip.requestId),
              userId: session.userId,
              counts: { trips: 1 },
              reason: error.code,
            });
            return NextResponse.json(
              { errorCode: error.code, error: error.message },
              { status: error.code === "REQUEST_NOT_FOUND" ? 404 : 409 },
            );
          }
          throw error;
        }
      }
    }

    let evaluation: Awaited<ReturnType<typeof evaluateTripCancellation>>;
    let refundAmount: number;
    let retainedAmount: number;
    let refundStatus: "pending" | "none";
    const cancelledAt = new Date();
    const standaloneCancellation = isStandaloneTripForCancellation(trip);

    if (standaloneCancellation) {
      const standaloneTrip = {
        id: String(trip._id),
        status: trip.status,
        paymentStatus: trip.paymentStatus,
      };
      const mode = getStandaloneTripCancellationMode(standaloneTrip);
      if (mode.kind === "blocked") {
        return NextResponse.json(
          { errorCode: mode.errorCode, error: mode.error },
          { status: mode.httpStatus },
        );
      }

      const policyEvaluation = await evaluateTripCancellation(
        trip.date,
        trip.priceEgp,
      );
      if (mode.kind === "paid" && !policyEvaluation.allowed) {
        return NextResponse.json(
          {
            error:
              policyEvaluation.message ||
              "Cancellation is not allowed for this trip at the current time",
            evaluation: policyEvaluation,
          },
          { status: 400 },
        );
      }
      evaluation = mode.kind === "unpaid"
        ? {
            ...policyEvaluation,
            allowed: true,
            refundPercent: 0,
            penaltyPercent: 0,
            refundAmount: 0,
            retainedAmount: 0,
          }
        : policyEvaluation;
      refundAmount = evaluation.refundAmount;
      retainedAmount = evaluation.retainedAmount;
      refundStatus = refundAmount > 0 ? "pending" : "none";
      const cancellation = {
        cancelledAt,
        tierLabel: evaluation.tierLabel,
        refundPercent: evaluation.refundPercent,
        penaltyPercent: evaluation.penaltyPercent,
        refundAmount,
        retainedAmount,
        refundStatus,
        reason,
      };

      const cancellationResult = await runStandaloneTripCancellation({
        trip: standaloneTrip,
        reason,
        evaluation,
        store: {
          async cancelUnpaidTrip(expectedTrip) {
            const dbSession = await mongoose.startSession();
            let updatedTrip: typeof trip | null = null;
            try {
              await dbSession.withTransaction(async () => {
                updatedTrip = await Trip.findOneAndUpdate(
                  {
                    _id: trip._id,
                    userId: session.userId,
                    requestId: null,
                    status: expectedTrip.status,
                    paymentStatus: expectedTrip.paymentStatus,
                  },
                  {
                    $set: {
                      status: "cancelled",
                      cancelledBy: "passenger",
                      cancelReason: reason,
                      cancellation,
                    },
                  },
                  { new: true, session: dbSession },
                );
                if (updatedTrip) {
                  const activePayments = await Payment.find({
                    bookingId: trip._id,
                    overallStatus: {
                      $in: ["created", "wallet_reserved", "kashier_pending"],
                    },
                  })
                    .select("_id walletStatus walletReservationTxId gatewayStatus")
                    .session(dbSession)
                    .lean<
                      {
                        _id: Types.ObjectId;
                        walletStatus: string;
                        walletReservationTxId?: Types.ObjectId | null;
                        gatewayStatus: string;
                      }[]
                    >();
                  for (const payment of activePayments) {
                    let walletStatus = payment.walletStatus;
                    if (walletStatus === "reserved") {
                      const reservation = payment.walletReservationTxId
                        ? { _id: payment.walletReservationTxId }
                        : await WalletTransaction.findOne({
                            paymentId: payment._id,
                            type: "payment_reserved",
                            status: "pending",
                          })
                            .select("_id")
                            .session(dbSession)
                            .lean<{ _id: Types.ObjectId } | null>();
                      if (reservation) {
                        await releaseReservation(String(reservation._id), {
                          description: `Released — trip ${String(trip._id)} cancelled before payment.`,
                          paymentId: String(payment._id),
                          bookingId: String(trip._id),
                          session: dbSession,
                        });
                        walletStatus = "released";
                      } else {
                        walletStatus = "none";
                      }
                    }
                    await Payment.updateOne(
                      {
                        _id: payment._id,
                        overallStatus: {
                          $in: ["created", "wallet_reserved", "kashier_pending"],
                        },
                      },
                      {
                        $set: {
                          overallStatus: "cancelled",
                          walletStatus,
                          ...(payment.gatewayStatus === "pending"
                            ? { gatewayStatus: "cancelled" }
                            : {}),
                        },
                        $push: {
                          timeline: {
                            event: "trip_cancelled",
                            detail:
                              "Standalone trip cancelled before payment completed.",
                            actor: "system",
                          },
                        },
                      },
                      { session: dbSession },
                    );
                  }
                  await releasePromoCodeUsageForTrip(
                    String(trip._id),
                    dbSession,
                  );
                }
              });
              return updatedTrip;
            } finally {
              await dbSession.endSession();
            }
          },
          async cancelPaidTrip(expectedTrip, _reason, paidEvaluation) {
            const dbSession = await mongoose.startSession();
            let updatedTrip: typeof trip | null = null;
            try {
              await dbSession.withTransaction(async () => {
                updatedTrip = await Trip.findOneAndUpdate(
                  {
                    _id: trip._id,
                    userId: session.userId,
                    requestId: null,
                    status: expectedTrip.status,
                    paymentStatus: "paid",
                  },
                  {
                    $set: {
                      status: "cancelled",
                      cancelledBy: "passenger",
                      cancelReason: reason,
                      cancellation,
                    },
                  },
                  { new: true, session: dbSession },
                );
                if (!updatedTrip) return;
                if (paidEvaluation.refundAmount > 0) {
                  await RefundRequest.create(
                    [
                      {
                        tripId: trip._id,
                        passengerId: session.userId,
                        requestedAt: cancelledAt,
                        refundAmount: paidEvaluation.refundAmount,
                        retainedAmount: paidEvaluation.retainedAmount,
                        tier: paidEvaluation.tierLabel,
                        status: "pending",
                      },
                    ],
                    { session: dbSession },
                  );
                }
              });
              return updatedTrip;
            } finally {
              await dbSession.endSession();
            }
          },
        },
        async cancelPayments(tripId) {
          await cancelStandaloneTripPayments(tripId);
        },
      });
      if (!cancellationResult.ok) {
        return NextResponse.json(
          {
            errorCode: cancellationResult.errorCode,
            error: cancellationResult.error,
          },
          { status: cancellationResult.httpStatus },
        );
      }

      trip.status = "cancelled";
      trip.cancelledBy = "passenger";
      trip.cancelReason = reason;
      trip.cancellation = cancellation;
    } else {
      const parentConflict = await getParentCancellationConflict(trip.requestId);
      if (parentConflict) return parentConflict;

      if (trip.status === "cancelled") {
        return NextResponse.json(
          { error: "This trip is already cancelled" },
          { status: 400 },
        );
      }

      if (trip.status === "completed") {
        return NextResponse.json(
          { error: "Completed trips cannot be cancelled" },
          { status: 400 },
        );
      }

      evaluation = await evaluateTripCancellation(trip.date, trip.priceEgp);
      if (!evaluation.allowed) {
        return NextResponse.json(
          {
            error:
              evaluation.message ||
              "Cancellation is not allowed for this trip at the current time",
            evaluation,
          },
          { status: 400 },
        );
      }

      refundAmount = evaluation.refundAmount;
      retainedAmount = evaluation.retainedAmount;
      refundStatus = refundAmount > 0 ? "pending" : "none";
      trip.status = "cancelled";
      trip.cancelledBy = "passenger";
      trip.cancelReason = reason;
      trip.cancellation = {
        cancelledAt,
        tierLabel: evaluation.tierLabel,
        refundPercent: evaluation.refundPercent,
        penaltyPercent: evaluation.penaltyPercent,
        refundAmount,
        retainedAmount,
        refundStatus,
        reason,
      };

      if (refundAmount > 0) {
        await RefundRequest.create({
          tripId: trip._id,
          passengerId: session.userId,
          requestedAt: cancelledAt,
          refundAmount,
          retainedAmount,
          tier: evaluation.tierLabel,
          status: "pending",
        });
      }

    }

    // Unassign from Ride if matched.
    if (trip.rideId) {
      try {
        const ride = await Ride.findById(trip.rideId);
        if (ride) {
          if (Array.isArray(ride.passengers)) {
            ride.passengers = ride.passengers.filter(
              (p: {
                tripId?: { toString(): string } | string;
                userId?: { toString(): string } | string;
              }) =>
                p.tripId?.toString() !== trip._id.toString() &&
                p.userId?.toString() !== session.userId,
            );
          }
          if (ride.passengersCount && ride.passengersCount > 0) {
            ride.passengersCount = Math.max(0, ride.passengersCount - 1);
          }
          await ride.save();
        }
      } catch (rideErr) {
        console.error("Error updating ride after passenger cancellation:", rideErr);
      }
    }

    if (!standaloneCancellation) {
      if (trip.requestId) {
        const dbSession = await mongoose.startSession();
        try {
          await dbSession.withTransaction(async () => {
            await trip.save({ session: dbSession });
            await releasePromoForRequest(trip.requestId, {
              session: dbSession,
            });
          });
        } finally {
          await dbSession.endSession();
        }
      } else {
        await trip.save();
      }
    }

    // Log cancellation event
    try {
      await Log.create({
        actor: session.userId,
        actorType: "user",
        action: "trip_cancelled",
        target: trip._id.toString(),
        targetType: "trip",
        details: {
          tripNumber: trip.tripNumber,
          date: trip.date,
          refundPercent: evaluation.refundPercent,
          penaltyPercent: evaluation.penaltyPercent,
          refundAmount,
          retainedAmount,
          refundStatus,
          tierLabel: evaluation.tierLabel,
          reason,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message:
        refundAmount > 0
          ? `Trip cancelled. Your refund of ${refundAmount} EGP (${evaluation.refundPercent}%) has been submitted for admin approval.`
          : `Trip cancelled.`,
      cancellation: trip.cancellation,
      trip,
    });
  } catch (error: unknown) {
    console.error("Error processing trip cancellation:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to cancel trip",
      },
      { status: 500 },
    );
  }
}
