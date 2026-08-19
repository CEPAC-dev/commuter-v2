import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { cancelRide } from "@/lib/services/rideService";
import "@/models/Availability";
import { Ride } from "@/models/Ride";
import { User } from "@/models/User";

type RoutePassenger = {
  userId?: unknown;
  tripId?: unknown;
  pickupOrder?: number;
  dropoffOrder?: number;
  numberOfPassengers?: number;
};

function toObjectIdString(value: unknown) {
  const id = String(value ?? "");
  return isValidObjectId(id) ? id : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  await connectDB();

  const ride = await Ride.findById(id)
    .populate("driverId", "name phone email userNumber")
    .populate(
      "availabilityId",
      "availabilityNumber date startLocation endLocation startTime endTime status",
    )
    .lean();

  if (!ride) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  const passengerByUserId = new Map<
    string,
    {
      userId: string;
      tripId?: string;
      pickupOrder?: number;
      dropoffOrder?: number;
      numberOfPassengers: number;
    }
  >();
  const addPassenger = (
    passenger: RoutePassenger,
    type: "boarding" | "alighting",
    stopOrder?: number,
  ) => {
    const userId = toObjectIdString(passenger.userId);
    if (!userId) return;
    const existing = passengerByUserId.get(userId) ?? {
      userId,
      numberOfPassengers: passenger.numberOfPassengers ?? 1,
    };
    const tripId = toObjectIdString(passenger.tripId);
    if (tripId) existing.tripId ??= tripId;
    if (type === "boarding") {
      existing.pickupOrder ??= passenger.pickupOrder ?? stopOrder;
    } else {
      existing.dropoffOrder ??= passenger.dropoffOrder ?? stopOrder;
    }
    passengerByUserId.set(userId, existing);
  };

  const rideRecord = ride as unknown as {
    passengers?: RoutePassenger[];
    route?: Array<{
      boarding?: RoutePassenger[];
      alighting?: RoutePassenger[];
    }>;
  };
  for (const passenger of rideRecord.passengers ?? []) {
    addPassenger(passenger, "boarding");
    addPassenger(passenger, "alighting");
  }
  for (const [index, stop] of (rideRecord.route ?? []).entries()) {
    for (const passenger of stop.boarding ?? []) {
      addPassenger(passenger, "boarding", index + 1);
    }
    for (const passenger of stop.alighting ?? []) {
      addPassenger(passenger, "alighting", index + 1);
    }
  }

  const passengerIds = [...passengerByUserId.keys()];
  const users = passengerIds.length
    ? await User.find({ _id: { $in: passengerIds } })
        .select("userNumber name phone profilePic")
        .lean<
          {
            _id: unknown;
            userNumber?: number;
            name?: string;
            phone?: string;
            profilePic?: string | null;
          }[]
        >()
    : [];
  const usersById = new Map(users.map((user) => [String(user._id), user]));
  const passengerDetails = [...passengerByUserId.values()]
    .map((passenger) => ({
      ...passenger,
      user: usersById.get(passenger.userId) ?? null,
    }))
    .sort(
      (first, second) =>
        (first.pickupOrder ?? Number.MAX_SAFE_INTEGER) -
        (second.pickupOrder ?? Number.MAX_SAFE_INTEGER),
    );

  return NextResponse.json({
    ride: {
      ...ride,
      availability: ride.availabilityId ?? null,
      passengerDetails,
    },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  try {
    const deleted = await cancelRide(id, "Cancelled by admin");
    if (!deleted) {
      return NextResponse.json({ error: "Ride not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to cancel ride" },
      { status: 500 },
    );
  }
}
