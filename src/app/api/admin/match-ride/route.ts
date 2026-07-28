import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";

export async function GET() {
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
      Trip.find({ status: { $in: ["submitted", "pending_payment", "matched"] }, paymentStatus: "paid" })
        .select("_id tripNumber date pickupTime arrivalTime pickup dropoff vehicleType rideType priceEgp numberOfPassengers userId")
        .sort({ date: 1, pickupTime: 1 })
        .lean(),
    ]);

    return NextResponse.json({ data: { availabilities, drivers, trips } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load matching options" }, { status: 500 });
  }
}
