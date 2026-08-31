import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { RefundRequest } from "@/models/RefundRequest";
import { Ride } from "@/models/Ride";
import { Log } from "@/models/Log";
import { evaluateTripCancellation } from "@/lib/passengerCancellationPolicy";

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

    const trip = await Trip.findOne({
      _id: id,
      userId: session.userId,
    }).lean();

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

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
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
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

    const trip = await Trip.findOne({
      _id: id,
      userId: session.userId,
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

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

    const evaluation = await evaluateTripCancellation(
      trip.date,
      trip.priceEgp,
    );

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

    const refundAmount = evaluation.refundAmount;
    const retainedAmount = evaluation.retainedAmount;
    const refundStatus = refundAmount > 0 ? "pending" : "none";

    trip.status = "cancelled";
    trip.cancellation = {
      cancelledAt: new Date(),
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
        requestedAt: new Date(),
        refundAmount,
        retainedAmount,
        tier: evaluation.tierLabel,
        status: "pending",
      });
    }

    // Unassign from Ride if matched
    if (trip.rideId) {
      try {
        const ride = await Ride.findById(trip.rideId);
        if (ride) {
          if (Array.isArray(ride.passengers)) {
            ride.passengers = ride.passengers.filter(
              (p: any) =>
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

    await trip.save();

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
  } catch (error: any) {
    console.error("Error processing trip cancellation:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to cancel trip" },
      { status: 500 },
    );
  }
}
