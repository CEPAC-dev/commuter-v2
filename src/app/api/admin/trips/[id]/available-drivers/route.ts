import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Availability } from "@/models/Availability";
import { User } from "@/models/User";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  await connectDB();

  const trip = await Trip.findById(id).lean<{ date?: string; pickupTime?: string }>();
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const availability = await Availability.find({
    date: trip.date,
  })
    .select("driverId startTime endTime")
    .lean<Array<{ driverId: unknown; startTime: string; endTime: string }>>();

  const driverIds = availability.map((item) => String(item.driverId));
  const drivers = await User.find({ _id: { $in: driverIds }, role: "driver" })
    .select("name phone")
    .lean<Array<{ _id: unknown; name?: string; phone?: string }>>();

  const driverMap = new Map(drivers.map((driver) => [String(driver._id), driver]));

  const matches = availability
    .map((item) => ({
      ...item,
      driver: driverMap.get(String(item.driverId)),
    }))
    .filter((item) => item.driver)
    .map((item) => ({
      _id: item.driver?._id,
      name: item.driver?.name,
      phone: item.driver?.phone,
      startTime: item.startTime,
      endTime: item.endTime,
    }));

  return NextResponse.json({ drivers: matches });
}
