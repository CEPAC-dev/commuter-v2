import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { createRide } from "@/lib/services/rideService";
import { getEligibleDriverIds } from "@/lib/services/rideMatching";
import { getTripPassengerCount } from "@/lib/rideCapacity";
import { createNotification } from "@/lib/notifications/createNotification";
import { Types } from "mongoose";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const driverId = body && typeof body === "object" ? body.driverId : null;

  if (typeof driverId !== "string" || !Types.ObjectId.isValid(driverId)) {
    return NextResponse.json(
      { error: "driverId is required" },
      { status: 400 },
    );
  }

  await connectDB();

  const trip = await Trip.findById(id).lean();
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }
  if (
    trip.status !== "submitted" ||
    trip.paymentStatus !== "paid" ||
    trip.rideId
  ) {
    return NextResponse.json(
      { error: "Only paid, unmatched submitted trips can be assigned." },
      { status: 409 },
    );
  }

  const eligibleDriverIds = await getEligibleDriverIds({
    _id: trip._id,
    date: trip.date,
    startTime: trip.pickupTime,
    endTime: trip.arrivalTime,
    vehicleType: trip.vehicleType,
    pickupStation: trip.pickupStation,
    dropoffStation: trip.dropoffStation,
  });
  if (
    !eligibleDriverIds.some((eligibleId) => String(eligibleId) === driverId)
  ) {
    return NextResponse.json(
      { error: "Driver is not eligible for this trip's date and time." },
      { status: 409 },
    );
  }

  const passengerCount = getTripPassengerCount(
    trip.vehicleType,
    trip.numberOfPassengers,
    trip.extraPassengers,
  );
  const route =
    Array.isArray(trip.stops) && trip.stops.length > 0
      ? [
          {
            point: trip.pickup,
            boardingNumber: passengerCount,
            alightingNumber: 0,
            boarding: [],
            alighting: [],
            waitingMinutes: 0,
          },
          ...trip.stops.map((stop) => ({
            point: stop.point,
            boardingNumber: stop.boarding,
            alightingNumber: stop.alighting,
            boarding: [],
            alighting: [],
            waitingMinutes: stop.waitingMinutes,
          })),
          {
            point: trip.dropoff,
            boardingNumber: 0,
            alightingNumber: passengerCount,
            boarding: [],
            alighting: [],
            waitingMinutes: 0,
          },
        ]
      : undefined;
  let ride;
  try {
    ride = await createRide({
      driverId,
      date: trip.date,
      vehicleType: trip.vehicleType,
      rideType: trip.rideType,
      startTime: trip.pickupTime,
      endTime: trip.arrivalTime,
      status: "confirmed",
      route,
      passengers: [
        {
          tripId: trip._id,
          userId: trip.userId,
          pickup: trip.pickup,
          dropoff: trip.dropoff,
          pickupOrder: 1,
          dropoffOrder: 2,
          numberOfPassengers: passengerCount,
          tripCost: trip.priceEgp,
          priceEgp: trip.priceEgp,
        },
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not assign this trip.",
      },
      { status: 409 },
    );
  }

  await Promise.all([
    createNotification({
      userId: String(trip.userId),
      type: "driver_assigned",
      title: "Driver assigned",
      body: "A driver has been assigned to your trip.",
      data: { tripId: String(trip._id), rideId: String(ride._id), driverId },
    }),
    createNotification({
      userId: driverId,
      type: "ride_assigned",
      title: "A ride has been assigned to you",
      body: `${trip.date} at ${trip.pickupTime}`,
      data: { tripId: String(trip._id), rideId: String(ride._id) },
    }),
  ]);

  return NextResponse.json({ ok: true, ride });
}
