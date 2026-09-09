import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { getSession } from "@/lib/auth/session";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { buildAssignedDriver } from "@/lib/services/trips";
import { logDriverAccepted } from "@/lib/services/logActionHelpers";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "driver") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await connectDB();

  const assignedDriver = await buildAssignedDriver(session.userId);
  const ride = await Ride.findOneAndUpdate(
    { _id: id, driverId: null, status: "matched", offeredToDriverIds: session.userId, rejectedByDriverIds: { $ne: session.userId } },
    { $set: { driverId: session.userId, assignedDriver, status: "confirmed", offeredToDriverIds: [] } },
    { new: true },
  );
  if (!ride) return NextResponse.json({ error: "This ride is no longer available." }, { status: 409 });

  const passengers = ride.passengers as unknown as Array<{
    tripId: string;
    userId?: string;
  }>;
  const tripIds = passengers.map((passenger) => passenger.tripId);
  await Trip.updateMany({ _id: { $in: tripIds }, rideId: ride._id }, { $set: { driverId: session.userId, assignedDriver, status: "confirmed" } });
  await Promise.all(
    passengers
      .filter((passenger) => passenger.userId)
      .map((passenger) =>
        logDriverAccepted(
          passenger.tripId,
          passenger.userId!,
          session.userId,
          { rideId: String(ride._id) },
        ),
      ),
  );

  return NextResponse.json({ ok: true, ride });
}
