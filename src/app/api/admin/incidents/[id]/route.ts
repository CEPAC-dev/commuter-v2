import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { getAdminSettings, getCancellationTier } from "@/lib/cancellationPolicy";
import { Ride } from "@/models/Ride";
import { RideIncident } from "@/models/RideIncident";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";
import { Wallet } from "@/models/Wallet";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface IncidentRecord {
  _id: Types.ObjectId;
  rideId: Types.ObjectId;
  driverId: Types.ObjectId;
  type: string;
  note?: string;
  rideStatusAtReport: string;
  status: string;
  resolution?: string | null;
  adminNote?: string | null;
  affectedTripIds: Types.ObjectId[];
  needsFollowUpTripIds?: Types.ObjectId[];
  createdAt: Date;
  resolvedAt?: Date | null;
}

interface RideRecord {
  driverId?: Types.ObjectId;
  rideNumber?: number;
  status: string;
  date: string;
  startTime: string;
  endTime: string;
  route?: unknown[];
  vehicleType: string;
  totalCost: number;
  passengers?: {
    tripId: Types.ObjectId;
    passengerNumber?: number;
    status?: string;
  }[];
}

interface TripRecord {
  _id: Types.ObjectId;
  status: string;
  paymentStatus: string;
  priceEgp: number;
  pickup?: { address?: string };
  dropoff?: { address?: string };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await adminAuth();
  if (!authorization.authorized) return authorization.response;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { errorCode: "INCIDENT_NOT_FOUND", error: "Incident not found." },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  await connectDB();
  const incident = await RideIncident.findById(id)
    .lean<IncidentRecord | null>();
  if (!incident) {
    return NextResponse.json(
      { errorCode: "INCIDENT_NOT_FOUND", error: "Incident not found." },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const [ride, trips] = await Promise.all([
    Ride.findById(incident.rideId)
      .select(
        "driverId rideNumber status date startTime endTime route vehicleType totalCost passengers",
      )
      .lean<RideRecord | null>(),
    Trip.find({ _id: { $in: incident.affectedTripIds } })
      .select("_id status paymentStatus priceEgp userId pickup dropoff")
      .lean<TripRecord[]>(),
  ]);

  const [driver, wallet] = ride?.driverId
    ? await Promise.all([
        User.findById(ride.driverId).select("_id name phone").lean(),
        Wallet.findOne({ userId: ride.driverId })
          .select("balanceEgp owedEgp")
          .lean(),
      ])
    : [null, null];

  const settings = await getAdminSettings();
  const tier = ride
    ? getCancellationTier(
        ride.date,
        new Date(),
        settings.availabilityLockTime,
        settings.cancellationTiers,
      )
    : null;
  const suggestedPenaltyEgp =
    ride && tier && tier.action !== "free"
      ? Math.round((ride.totalCost * tier.penaltyPercent) / 100)
      : null;
  const passengerByTripId = new Map(
    (ride?.passengers ?? []).map((passenger, index) => [
      String(passenger.tripId),
      {
        passengerNumber: passenger.passengerNumber ?? index + 1,
        pickupStatus: passenger.status ?? "waiting",
      },
    ]),
  );
  const tripById = new Map(trips.map((trip) => [String(trip._id), trip]));
  const affectedTrips = incident.affectedTripIds.map((tripId: Types.ObjectId) => {
    const trip = tripById.get(String(tripId));
    const passenger = passengerByTripId.get(String(tripId));
    return {
      id: String(tripId),
      status: trip?.status ?? "missing",
      passengerNumber: passenger?.passengerNumber ?? null,
      passengerLabel: passenger
        ? `Passenger ${passenger.passengerNumber}`
        : "Passenger",
      pickupStatus: passenger?.pickupStatus ?? "unknown",
      paymentStatus: trip?.paymentStatus ?? "unknown",
      priceEgp: trip?.priceEgp ?? null,
      pickup: trip?.pickup?.address ?? null,
      dropoff: trip?.dropoff?.address ?? null,
    };
  });

  return NextResponse.json(
    {
      incident: {
        id: String(incident._id),
        rideId: String(incident.rideId),
        driverId: String(incident.driverId),
        type: incident.type,
        note: incident.note ?? "",
        rideStatusAtReport: incident.rideStatusAtReport,
        status: incident.status,
        resolution: incident.resolution,
        adminNote: incident.adminNote ?? "",
        affectedTripIds: incident.affectedTripIds.map(String),
        needsFollowUpTripIds:
          incident.needsFollowUpTripIds?.map(String) ?? [],
        createdAt: incident.createdAt,
        resolvedAt: incident.resolvedAt,
      },
      ride: ride
        ? {
            id: String(incident.rideId),
            rideNumber: ride.rideNumber,
            status: ride.status,
            date: ride.date,
            startTime: ride.startTime,
            endTime: ride.endTime,
            route: ride.route ?? [],
            vehicleType: ride.vehicleType,
            priceEgp: ride.totalCost,
          }
        : null,
      driver: driver
        ? {
            id: String(driver._id),
            name: driver.name ?? "",
            phone: driver.phone ?? "",
            balanceEgp: wallet?.balanceEgp ?? 0,
            owedEgp: wallet?.owedEgp ?? 0,
          }
        : null,
      affectedTrips,
      suggestedPenaltyEgp,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
