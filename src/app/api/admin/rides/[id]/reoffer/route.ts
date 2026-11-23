import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { createNotification } from "@/lib/notifications/createNotification";
import { getEligibleDriverIds } from "@/lib/services/rideMatching";
import { VEHICLES } from "@/lib/config/vehicles";
import { Ride } from "@/models/Ride";

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
  ride.rejectedByDriverIds = [];
  const eligibleDriverIds = await getEligibleDriverIds(ride);
  ride.offeredToDriverIds = eligibleDriverIds;
  ride.needsManualAssignment = eligibleDriverIds.length === 0;
  await ride.save();

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
  });
}
