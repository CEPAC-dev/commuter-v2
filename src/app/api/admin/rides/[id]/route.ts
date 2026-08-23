import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { cancelRide } from "@/lib/services/rideService";
import { normalizeSharedRidePassengers } from "@/lib/services/sharedRideManifest";
import "@/models/Availability";
import { Ride } from "@/models/Ride";
import { User } from "@/models/User";

function toObjectIdString(value: unknown) {
  const id = String(value ?? "");
  return isValidObjectId(id) ? id : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
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

  // Derives station-relative order (not raw import order) and preserves live status.
  const manifestPassengers = normalizeSharedRidePassengers(
    ride as unknown as Record<string, unknown>,
  );

  const passengerByUserId = new Map<
    string,
    {
      userId: string;
      tripId?: string;
      pickupOrder?: number;
      dropoffOrder?: number;
      numberOfPassengers: number;
      status: string;
    }
  >();
  for (const passenger of manifestPassengers) {
    const userId = toObjectIdString(passenger.userId);
    if (!userId) continue;
    passengerByUserId.set(userId, {
      userId,
      tripId: toObjectIdString(passenger.tripId) ?? undefined,
      pickupOrder:
        typeof passenger.pickupOrder === "number"
          ? passenger.pickupOrder
          : undefined,
      dropoffOrder:
        typeof passenger.dropoffOrder === "number"
          ? passenger.dropoffOrder
          : undefined,
      numberOfPassengers: Number(passenger.numberOfPassengers ?? 1),
      status:
        typeof passenger.status === "string" ? passenger.status : "waiting",
    });
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

/**
 * PATCH /api/admin/rides/:id
 * Body: { tripId: string, status: "no_show" | "waiting" }
 * Lets an admin mark a shared-ride passenger as a no-show (or restore them),
 * recomputing the shared manifest first so the update lands on the right record.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  await connectDB();

  const body = (await req.json().catch(() => null)) as {
    tripId?: string;
    status?: string;
  } | null;
  const tripId = body?.tripId;
  const nextStatus = body?.status;

  if (!tripId || !["no_show", "waiting"].includes(nextStatus ?? "")) {
    return NextResponse.json(
      {
        error:
          "tripId and a valid status ('no_show' or 'waiting') are required",
      },
      { status: 400 },
    );
  }

  const rideDoc = await Ride.findById(id);
  if (!rideDoc) {
    return NextResponse.json({ error: "Ride not found" }, { status: 404 });
  }

  if (rideDoc.rideType === "shared") {
    rideDoc.set(
      "passengers",
      normalizeSharedRidePassengers(
        rideDoc.toObject() as Record<string, unknown>,
      ),
    );
  }

  const passenger = (rideDoc.passengers ?? []).find(
    (p: { tripId?: unknown }) => String(p.tripId) === String(tripId),
  );
  if (!passenger) {
    return NextResponse.json(
      { error: "Passenger not found on this ride" },
      { status: 404 },
    );
  }

  const previousStatus = passenger.status;
  passenger.status = nextStatus as string;
  if (nextStatus === "no_show") {
    passenger.seatNumbers = [];
  }
  rideDoc.logs?.push({
    action: nextStatus === "no_show" ? "no_show" : "restored",
    tripId: passenger.tripId,
    userId: passenger.userId,
    previousStatus,
    newStatus: nextStatus,
    metadata: { source: "admin" },
    createdAt: new Date(),
  });

  await rideDoc.save();

  return NextResponse.json({ ok: true, status: passenger.status });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
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
