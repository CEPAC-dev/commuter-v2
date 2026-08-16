import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function requireAdminPassword(req: NextRequest) {
  const expectedPassword = process.env.ADMIN_PASSWORD?.trim();
  const providedPassword = req.headers.get("x-admin-password")?.trim();

  if (!expectedPassword) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "ADMIN_PASSWORD is not configured on the server." },
        { status: 500 },
      ),
    };
  }

  if (!providedPassword || providedPassword !== expectedPassword) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid admin password." },
        { status: 401 },
      ),
    };
  }

  return { ok: true };
}

const POPULATE_TRIP_REFERENCES = [
  { path: "requestId" },
  { path: "userId", select: "name email phone role" },
  { path: "driverId", select: "name email phone role" },
  { path: "rideId" },
];

export async function GET(req: NextRequest) {
  await connectDB();

  const { searchParams } = new URL(req.url);
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const skip = (safePage - 1) * safeLimit;
  const query: Record<string, unknown> = {};

  for (const field of ["userId", "driverId", "requestId", "rideId", "date", "vehicleType", "rideType", "paymentStatus", "status"]) {
    const value = searchParams.get(field);
    if (value) query[field] = value;
  }

  const tripNumber = searchParams.get("tripNumber");
  if (tripNumber) {
    const parsedTripNumber = Number.parseInt(tripNumber, 10);
    if (!Number.isFinite(parsedTripNumber)) {
      return NextResponse.json({ error: "tripNumber must be a number" }, { status: 400 });
    }
    query.tripNumber = parsedTripNumber;
  }

  const createdAtFrom = searchParams.get("createdAtFrom");
  const createdAtTo = searchParams.get("createdAtTo");
  if (createdAtFrom || createdAtTo) {
    query.createdAt = {
      ...(createdAtFrom ? { $gte: new Date(createdAtFrom) } : {}),
      ...(createdAtTo ? { $lte: new Date(createdAtTo) } : {}),
    };
  }

  const [trips, totalCount] = await Promise.all([
    Trip.find()
      .find(query)
      .sort({ date: -1, pickupTime: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate(POPULATE_TRIP_REFERENCES)
      .lean(),
    Trip.countDocuments(query),
  ]);

  return NextResponse.json({
    trips,
    totalCount,
    page: safePage,
    limit: safeLimit,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  const passwordCheck = requireAdminPassword(req);
  if (!passwordCheck.ok) return passwordCheck.response;

  await connectDB();

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  let filter: Record<string, unknown>;

  if (action === "by-user") {
    const userId = searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
    filter = { userId };
  } else if (action === "by-trip-number") {
    const tripNumber = Number.parseInt(searchParams.get("tripNumber") ?? "", 10);
    if (!Number.isFinite(tripNumber)) {
      return NextResponse.json({ error: "tripNumber must be a number" }, { status: 400 });
    }
    filter = { tripNumber };
  } else if (action === "by-date") {
    const date = searchParams.get("date")?.trim();
    if (!date || !isValidDate(date)) {
      return NextResponse.json({ error: "date must be a valid YYYY-MM-DD string." }, { status: 400 });
    }
    filter = { date };
  } else if (action === "all") {
    filter = {};
  } else if (action === "today" || action === "not-today") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const todayFilter = { $gte: todayStart, $lt: tomorrowStart };
    filter = action === "today"
      ? { createdAt: todayFilter }
      : { $or: [{ createdAt: { $lt: todayStart } }, { createdAt: { $gte: tomorrowStart } }] };
  } else {
    return NextResponse.json(
      { error: "action must be by-user, by-trip-number, by-date, all, today, or not-today" },
      { status: 400 },
    );
  }

  const result = await Trip.deleteMany(filter);
  return NextResponse.json({ ok: true, deletedCount: result.deletedCount ?? 0, scope: action ?? "all" });
}
