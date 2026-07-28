import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { WalletTransaction } from "@/models/WalletTransaction";
import { driverEarningFromTrip } from "@/lib/config/earnings";
import { creditDriverEarning } from "@/lib/wallet/wallet";

/**
 * Credit the assigned driver when a trip is marked completed.
 * Idempotent — safe to call multiple times for the same trip.
 */
export async function settleTripEarning(tripId: string): Promise<number | null> {
  if (!Types.ObjectId.isValid(tripId)) return null;

  await connectDB();

  const trip = await Trip.findById(tripId)
    .select("driverId priceEgp status tripNumber")
    .lean<{
      driverId?: Types.ObjectId;
      priceEgp: number;
      status: string;
      tripNumber?: number;
    }>();
  if (!trip || trip.status !== "completed" || !trip.driverId) return null;

  const earning = driverEarningFromTrip(trip.priceEgp);
  if (earning <= 0) return null;

  const label = trip.tripNumber
    ? `Trip #${trip.tripNumber} earnings`
    : "Trip earnings";

  return creditDriverEarning(String(trip.driverId), earning, {
    description: label,
    tripId,
  });
}

/** Batch-settle any completed trips that somehow missed driver credit. */
export async function reconcileDriverEarnings(driverId: string): Promise<number> {
  await connectDB();
  const uid = new Types.ObjectId(driverId);

  const completed = await Trip.find({
    driverId: uid,
    status: "completed",
    paymentStatus: "paid",
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId }[]>();

  const creditedTripIds = new Set(
    (
      await WalletTransaction.find({
        userId: uid,
        type: "earning",
        status: "completed",
        tripId: { $exists: true },
      })
        .select("tripId")
        .lean<{ tripId: Types.ObjectId }[]>()
    ).map((t) => String(t.tripId)),
  );

  let credited = 0;
  for (const trip of completed) {
    const id = String(trip._id);
    if (creditedTripIds.has(id)) continue;
    const balance = await settleTripEarning(id);
    if (balance !== null) credited += 1;
  }
  return credited;
}
