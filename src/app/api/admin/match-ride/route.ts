import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { buildEligibleMatchTripFilter } from "@/lib/matchingEndpointGuards";

export async function GET(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  try {
    await connectDB();

    const [availabilities, drivers, trips] = await Promise.all([
      Availability.find({ status: { $in: ["open", "matched"] } })
        .select("_id date startTime endTime")
        .sort({ date: 1, startTime: 1 })
        .lean(),
      User.find({ role: "driver" })
        .select("_id name phone email")
        .sort({ name: 1 })
        .lean(),
      Trip.find(buildEligibleMatchTripFilter())
        .select(
          "_id tripNumber date pickupTime arrivalTime pickup dropoff vehicleType rideType priceEgp numberOfPassengers extraPassengers userId",
        )
        .sort({ date: 1, pickupTime: 1 })
        .lean(),
    ]);

    return NextResponse.json(
      { data: { availabilities, drivers, trips } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load matching options";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
