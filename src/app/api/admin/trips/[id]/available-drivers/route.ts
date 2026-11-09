import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Availability } from "@/models/Availability";
import { User } from "@/models/User";
import { getEligibleDriverIds } from "@/lib/services/rideMatching";
import { availabilityDayOfWeek } from "@/lib/time/availabilityWindow";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  await connectDB();

  const trip = await Trip.findById(id)
    .select(
      "date pickupTime arrivalTime vehicleType pickupStation dropoffStation status paymentStatus rideId",
    )
    .lean<{
      date?: string;
      pickupTime?: string;
      arrivalTime?: string;
      vehicleType?: string;
      pickupStation?: { lat: number; lng: number };
      dropoffStation?: { lat: number; lng: number };
      status?: string;
      paymentStatus?: string;
      rideId?: unknown;
    }>();
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }
  if (
    trip.status !== "submitted" ||
    trip.paymentStatus !== "paid" ||
    trip.rideId
  ) {
    return NextResponse.json({ drivers: [] });
  }

  const dayOfWeek = trip.date ? availabilityDayOfWeek(trip.date) : null;
  if (
    !dayOfWeek ||
    !trip.pickupTime ||
    !trip.arrivalTime ||
    !trip.vehicleType
  ) {
    return NextResponse.json({ drivers: [] });
  }

  const eligibleDriverIds = await getEligibleDriverIds({
    _id: id,
    date: trip.date!,
    startTime: trip.pickupTime,
    endTime: trip.arrivalTime,
    vehicleType: trip.vehicleType,
    pickupStation: trip.pickupStation,
    dropoffStation: trip.dropoffStation,
  });
  if (eligibleDriverIds.length === 0) {
    return NextResponse.json({ drivers: [] });
  }

  const availability = await Availability.find({
    dayOfWeek,
    active: true,
    driverId: { $in: eligibleDriverIds },
    startTime: { $lte: trip.pickupTime },
    endTime: { $gte: trip.arrivalTime },
  })
    .select("driverId startTime endTime")
    .lean<Array<{ driverId: unknown; startTime: string; endTime: string }>>();

  const driverIds = [
    ...new Set(availability.map((item) => String(item.driverId))),
  ];
  const drivers = await User.find({ _id: { $in: driverIds }, role: "driver" })
    .select("name phone")
    .lean<Array<{ _id: unknown; name?: string; phone?: string }>>();

  const driverMap = new Map(
    drivers.map((driver) => [String(driver._id), driver]),
  );

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

  return NextResponse.json(
    { drivers: matches },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
