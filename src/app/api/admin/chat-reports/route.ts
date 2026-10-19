import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { ChatReport } from "@/models/ChatReport";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";

const REPORT_STATUSES = ["open", "reviewed", "dismissed"] as const;

function identityOf(user: {
  _id: unknown;
  name?: string;
  email?: string;
  phone?: string;
  userNumber?: number;
} | undefined) {
  return user
    ? {
        id: String(user._id),
        name: user.name ?? "",
        email: user.email ?? "",
        phone: user.phone ?? "",
        userNumber: user.userNumber ?? null,
      }
    : null;
}

export async function GET(req: Request) {
  const authorization = await adminAuth();
  if (!authorization.authorized) return authorization.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "open";
  if (status !== "all" && !REPORT_STATUSES.includes(status as (typeof REPORT_STATUSES)[number])) {
    return NextResponse.json(
      { errorCode: "INVALID_STATUS", error: "Invalid report status filter." },
      { status: 400 },
    );
  }
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "20", 10) || 20;
  const limit = Math.min(50, Math.max(1, requestedLimit));
  const query = status === "all" ? {} : { status };

  await connectDB();
  const [reports, total] = await Promise.all([
    ChatReport.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ChatReport.countDocuments(query),
  ]);
  const tripIds = [...new Set(reports.map((report) => String(report.tripId)))];
  const rideIds = [...new Set(reports.map((report) => String(report.rideId)))];
  const [trips, rides] = await Promise.all([
    Trip.find({ _id: { $in: tripIds } }).select("_id tripNumber date userId").lean(),
    Ride.find({ _id: { $in: rideIds } }).select("_id rideNumber driverId").lean(),
  ]);
  const userIds = [
    ...new Set([
      ...reports.map((report) => String(report.reporterId)),
      ...trips.map((trip) => String(trip.userId)),
      ...rides.map((ride) => String(ride.driverId)),
    ]),
  ].filter(Types.ObjectId.isValid);
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id name email phone userNumber")
    .lean();
  const tripById = new Map(trips.map((trip) => [String(trip._id), trip]));
  const rideById = new Map(rides.map((ride) => [String(ride._id), ride]));
  const userById = new Map(users.map((user) => [String(user._id), user]));

  return NextResponse.json(
    {
      reports: reports.map((report) => {
      const tripId = String(report.tripId);
      const rideId = String(report.rideId);
      const trip = tripById.get(tripId);
      const ride = rideById.get(rideId);
      return {
        id: String(report._id),
        tripId,
        rideId,
        reporterRole: report.reporterRole,
        reporter: identityOf(userById.get(String(report.reporterId))),
        passenger: identityOf(
          trip ? userById.get(String(trip.userId)) : undefined,
        ),
        driver: identityOf(
          ride?.driverId
            ? userById.get(String(ride.driverId))
            : undefined,
        ),
        tripNumber: trip?.tripNumber ?? null,
        tripDate: trip?.date ?? null,
        rideNumber: ride?.rideNumber ?? null,
        reason: report.reason,
        note: report.note ?? "",
        status: report.status,
        adminNote: report.adminNote ?? "",
        snapshot: report.snapshot,
        createdAt: report.createdAt,
        reviewedAt: report.reviewedAt ?? null,
      };
      }),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
