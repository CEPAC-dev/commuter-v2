import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { connectDB } from "@/lib/db/mongoose";
import { StationSuggestion } from "@/models/StationSuggestion";
import { findZoneAtPoint, getZoneName } from "@/lib/geo/zones";
import { loadServiceZones } from "@/lib/geo/zones.server";

const PAGE_SIZE = 20;
const STATUSES = new Set(["pending", "processing", "approved", "rejected"]);

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  const auth = await adminAuth(
    PERMISSIONS.STATIONS_MANAGE,
    req.nextUrl.searchParams.get("region"),
  );
  if (!auth.authorized) return auth.response;

  await connectDB();
  await StationSuggestion.updateMany(
    {
      status: "processing",
      regionCode: auth.region.code,
      updatedAt: { $lt: new Date(Date.now() - 15 * 60 * 1000) },
    },
    {
      $set: { status: "pending" },
      $unset: { reviewedBy: 1, reviewedAt: 1 },
    },
  );

  const requestedPage = Number(req.nextUrl.searchParams.get("page") ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  if (status !== "all" && !STATUSES.has(status)) {
    return NextResponse.json(
      { error: "Invalid status filter." },
      { status: 400 },
    );
  }

  const search = (req.nextUrl.searchParams.get("search") ?? "")
    .trim()
    .slice(0, 100);
  const filter: Record<string, unknown> = {
    regionCode: auth.region.code,
    ...(status !== "all" && { status }),
  };
  if (search) {
    const safeSearch = new RegExp(escapeRegex(search), "i");
    const requestNumber = Number(search);
    filter.$or = [
      { "requester.name": safeSearch },
      { "requester.email": safeSearch },
      { "requester.phone": safeSearch },
      {
        "requester.userNumber": Number.isFinite(requestNumber)
          ? requestNumber
          : -1,
      },
      { description: safeSearch },
      { "targetLocation.address": safeSearch },
      ...(Number.isSafeInteger(requestNumber) ? [{ requestNumber }] : []),
    ];
  }

  const [requests, total] = await Promise.all([
    StationSuggestion.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    StationSuggestion.countDocuments(filter),
  ]);
  const zones = requests.some((request) => !request.zoneName)
    ? await loadServiceZones(auth.region.code)
    : [];

  return NextResponse.json({
    requests: requests.map((request) => ({
      ...request,
      zoneName:
        request.zoneName ||
        getZoneName(
          findZoneAtPoint(
            [request.suggestedPoint.lng, request.suggestedPoint.lat],
            zones,
          ),
        ),
    })),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}
