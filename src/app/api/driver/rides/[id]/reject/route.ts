import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { getSession } from "@/lib/auth/session";
import { Ride } from "@/models/Ride";
import { logDriverRejected } from "@/lib/services/logActionHelpers";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "driver") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await connectDB();

  const ride = await Ride.findOneAndUpdate(
    { _id: id, status: "matched", driverId: null, offeredToDriverIds: session.userId },
    { $pull: { offeredToDriverIds: session.userId }, $addToSet: { rejectedByDriverIds: session.userId } },
    { new: true },
  );
  if (!ride) return NextResponse.json({ error: "This ride offer is no longer available." }, { status: 409 });

  if (ride.offeredToDriverIds.length === 0) {
    ride.needsManualAssignment = true;
    await ride.save();
  }
  const passengers = ride.passengers as unknown as Array<{
    tripId: string;
    userId?: string;
  }>;
  await Promise.all(
    passengers
      .filter((passenger) => passenger.userId)
      .map((passenger) => logDriverRejected(passenger.tripId, passenger.userId!, session.userId, undefined, { rideId: String(ride._id) })),
  );

  return NextResponse.json({ ok: true, ride });
}
