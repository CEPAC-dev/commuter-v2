import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { settleTripEarning } from "@/lib/services/tripEarnings";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "driver") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: tripId } = await params;
  if (!Types.ObjectId.isValid(tripId)) {
    return NextResponse.json({ error: "Invalid trip id." }, { status: 400 });
  }

  await connectDB();

  const trip = await Trip.findOne({
    _id: tripId,
    driverId: session.userId,
  });

  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  if (trip.status === "completed") {
    const balance = await settleTripEarning(tripId);
    return NextResponse.json({
      status: "completed",
      balanceEgp: balance,
      message: "Trip already completed.",
    });
  }

  if (!["active", "confirmed"].includes(trip.status)) {
    return NextResponse.json(
      { error: "Trip cannot be completed in its current state." },
      { status: 400 },
    );
  }

  trip.status = "completed";
  await trip.save();

  const balance = await settleTripEarning(tripId);

  return NextResponse.json({
    status: "completed",
    balanceEgp: balance,
    message: "Trip completed. Earnings added to your wallet.",
  });
}
