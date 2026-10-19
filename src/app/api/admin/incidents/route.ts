import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Ride } from "@/models/Ride";
import { RideIncident } from "@/models/RideIncident";

const INCIDENT_STATUSES = ["open", "resolved"] as const;

export async function GET(request: Request) {
  const authorization = await adminAuth();
  if (!authorization.authorized) return authorization.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "open";
  if (!INCIDENT_STATUSES.includes(status as (typeof INCIDENT_STATUSES)[number])) {
    return NextResponse.json(
      { errorCode: "INVALID_STATUS", error: "Status must be open or resolved." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
  );
  const requestedLimit =
    Number.parseInt(searchParams.get("limit") ?? "20", 10) || 20;
  const limit = Math.min(50, Math.max(1, requestedLimit));

  await connectDB();
  const filter = { status };
  const [incidents, total, openCount] = await Promise.all([
    RideIncident.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        "_id rideId driverId type rideStatusAtReport status createdAt resolution resolvedAt",
      )
      .lean(),
    RideIncident.countDocuments(filter),
    RideIncident.countDocuments({ status: "open" }),
  ]);
  const rides = incidents.length
    ? await Ride.find({
        _id: { $in: incidents.map((incident) => incident.rideId) },
      })
        .select("_id rideNumber")
        .lean<{ _id: import("mongoose").Types.ObjectId; rideNumber?: number }[]>()
    : [];
  const rideNumbers = new Map(
    rides.map((ride) => [String(ride._id), ride.rideNumber ?? null]),
  );

  return NextResponse.json(
    {
      incidents: incidents.map((incident) => ({
        id: String(incident._id),
        rideId: String(incident.rideId),
        rideNumber: rideNumbers.get(String(incident.rideId)) ?? null,
        driverId: String(incident.driverId),
        type: incident.type,
        rideStatusAtReport: incident.rideStatusAtReport,
        status: incident.status,
        createdAt: incident.createdAt,
        resolution: incident.resolution,
        resolvedAt: incident.resolvedAt,
      })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      openCount,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
