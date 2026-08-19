import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { cancelRide } from "@/lib/services/rideService";
import "@/models/Availability";
import { Ride } from "@/models/Ride";
import { User } from "@/models/User";

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function requireAdminPassword(rawPassword: string | null | undefined) {
  const expectedPassword = process.env.ADMIN_PASSWORD?.trim();
  const providedPassword = rawPassword?.trim();

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

export async function GET(req: NextRequest) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  await connectDB();

  const { searchParams } = new URL(req.url);
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit =
    Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const skip = (safePage - 1) * safeLimit;
  const query: Record<string, unknown> = {};

  for (const field of [
    "driverId",
    "availabilityId",
    "date",
    "vehicleType",
    "rideType",
    "status",
  ]) {
    const value = searchParams.get(field);
    if (value) query[field] = value;
  }

  const search = searchParams.get("q")?.trim();
  if (search) {
    const empty = NextResponse.json({
      rides: [],
      totalCount: 0,
      page: safePage,
      limit: safeLimit,
    });
    const searchBy = searchParams.get("searchBy") ?? "rideNumber";
    const asNumber = /^\d+$/.test(search) ? Number.parseInt(search, 10) : null;
    if (asNumber === null) return empty;

    if (searchBy === "driverNumber") {
      const driver = await User.findOne({
        userNumber: asNumber,
        role: "driver",
      })
        .select("_id")
        .lean<{ _id: unknown }>();
      if (!driver) return empty;
      query.driverId = driver._id;
    } else {
      query.rideNumber = asNumber;
    }
  }

  const dateFrom = searchParams.get("dateFrom")?.trim();
  const dateTo = searchParams.get("dateTo")?.trim();
  const hasFrom = Boolean(dateFrom && isValidDate(dateFrom));
  const hasTo = Boolean(dateTo && isValidDate(dateTo));
  if (hasFrom || hasTo) {
    const rangeStart = hasFrom ? dateFrom : dateTo;
    const rangeEnd = hasTo ? dateTo : dateFrom;
    query.date = { $gte: rangeStart, $lte: rangeEnd };
  }

  const [rides, totalCount] = await Promise.all([
    Ride.find(query)
      .sort({ date: -1, startTime: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate("driverId", "name phone email")
      .populate(
        "availabilityId",
        "availabilityNumber date startLocation endLocation startTime endTime status",
      )
      .lean(),
    Ride.countDocuments(query),
  ]);

  return NextResponse.json({
    rides: rides.map((ride) => ({
      ...ride,
      availability: ride.availabilityId ?? null,
    })),
    totalCount,
    page: safePage,
    limit: safeLimit,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  const body = (await req.json().catch(() => null)) as {
    password?: unknown;
    ids?: unknown;
  } | null;
  const passwordCheck = requireAdminPassword(
    req.headers.get("x-admin-password") ??
      (typeof body?.password === "string" ? body.password : null),
  );
  if (!passwordCheck.ok) return passwordCheck.response;

  const ids = Array.isArray(body?.ids)
    ? [
        ...new Set(
          body.ids.filter(
            (id): id is string => typeof id === "string" && isValidObjectId(id),
          ),
        ),
      ]
    : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "ids must be a non-empty array of ride ids" },
      { status: 400 },
    );
  }

  await connectDB();
  const rides = await Ride.find({ _id: { $in: ids } })
    .select("_id status")
    .lean<{ _id: unknown; status: string }[]>();
  if (rides.length !== ids.length) {
    return NextResponse.json(
      { error: "One or more rides were not found" },
      { status: 404 },
    );
  }
  if (rides.some((ride) => ride.status === "completed")) {
    return NextResponse.json(
      { error: "Completed rides cannot be deleted" },
      { status: 409 },
    );
  }

  for (const id of ids) {
    await cancelRide(id, "Cancelled by admin in bulk");
  }

  return NextResponse.json({ ok: true, deletedCount: ids.length });
}
