import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { createNotification } from "@/lib/notifications/createNotification";
import { getEligibleDriverIds } from "@/lib/services/rideMatching";
import { VEHICLES } from "@/lib/config/vehicles";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { Availability } from "@/models/Availability";
import { availabilityDayOfWeek } from "@/lib/time/availabilityWindow";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid ride id." }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as {
    rideType?: unknown;
    vehicleType?: unknown;
  } | null;
  const rideType = String(body?.rideType ?? "");
  const vehicleType = String(body?.vehicleType ?? "");

  if (!["private", "shared"].includes(rideType)) {
    return NextResponse.json({ error: "Invalid ride type." }, { status: 400 });
  }
  if (!VEHICLES[vehicleType]) {
    return NextResponse.json({ error: "Invalid vehicle type." }, { status: 400 });
  }

  await connectDB();
  const ride = await Ride.findById(id);
  if (!ride) {
    return NextResponse.json({ error: "Ride not found." }, { status: 404 });
  }
  if (ride.status !== "matched") {
    return NextResponse.json(
      { error: "Only matched rides can be reoffered." },
      { status: 409 },
    );
  }
  if (ride.driverId) {
    return NextResponse.json(
      { error: "A ride with an assigned driver cannot be reoffered." },
      { status: 409 },
    );
  }

  ride.rideType = rideType;
  ride.vehicleType = vehicleType;

  if (!ride.regionCode || !ride.cityCode) {
    const passengerTripIds = (
      ride.passengers as unknown as Array<{ tripId?: unknown }>
    )
      .map((passenger) => passenger.tripId)
      .filter(Boolean);
    const trips = passengerTripIds.length
      ? await Trip.find({ _id: { $in: passengerTripIds } })
          .select("regionCode cityCode pickupStation dropoffStation")
          .lean<
            Array<{
              regionCode?: string | null;
              cityCode?: string | null;
              pickupStation?: unknown;
              dropoffStation?: unknown;
            }>
          >()
      : [];
    const tripFallback = trips.find(
      (trip) => trip.regionCode && trip.cityCode,
    );
    ride.regionCode =
      ride.regionCode ?? tripFallback?.regionCode ?? undefined;
    ride.cityCode = ride.cityCode ?? tripFallback?.cityCode ?? undefined;
    if (!ride.pickupStation) {
      ride.pickupStation =
        tripFallback?.pickupStation as typeof ride.pickupStation;
    }
    if (!ride.dropoffStation) {
      ride.dropoffStation =
        tripFallback?.dropoffStation as typeof ride.dropoffStation;
    }
  }

  if (!ride.regionCode || !ride.cityCode) {
    const availability = ride.availabilityId
      ? await Availability.findById(ride.availabilityId)
          .select("regionCode cityCode")
          .lean<{ regionCode?: string | null; cityCode?: string | null }>()
      : null;
    ride.regionCode = ride.regionCode ?? availability?.regionCode ?? undefined;
    ride.cityCode = ride.cityCode ?? availability?.cityCode ?? undefined;
  }

  ride.rejectedByDriverIds = [];
  const eligibleDriverIds = await getEligibleDriverIds(ride);
  ride.offeredToDriverIds = eligibleDriverIds;
  ride.needsManualAssignment = eligibleDriverIds.length === 0;
  await ride.save();

  const dayOfWeek = availabilityDayOfWeek(ride.date);
  const availabilityCount =
    ride.regionCode && ride.cityCode && dayOfWeek
      ? await Availability.countDocuments({
          dayOfWeek,
          active: true,
          regionCode: ride.regionCode,
          cityCode: ride.cityCode,
        })
      : 0;

  await Promise.allSettled(
    eligibleDriverIds.map((driverId) =>
      createNotification({
        userId: String(driverId),
        type: "ride_offer",
        title: "New ride available",
        body: `${ride.date} at ${ride.startTime} · ${ride.totalCost} EGP`,
        data: { rideId: String(ride._id) },
      }),
    ),
  );

  return NextResponse.json({
    ok: true,
    offeredToDriverIds: eligibleDriverIds.map(String),
    needsManualAssignment: ride.needsManualAssignment,
    diagnostics: {
      regionCode: ride.regionCode ?? null,
      cityCode: ride.cityCode ?? null,
      dayOfWeek,
      startTime: ride.startTime,
      endTime: ride.endTime,
      vehicleType,
      rideType,
      availabilityCount,
    },
  });
}
