import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { nextSequence } from "@/models/Counter";
import { StationSuggestion } from "@/models/StationSuggestion";
import { User } from "@/models/User";
import { resolveActiveRegion } from "@/lib/regions/resolveActiveRegion";
import { createNotification } from "@/lib/notifications/createNotification";
import { notifyAdmins } from "@/lib/notifications/adminActivity";
import { getMapSettings } from "@/lib/maps/settings";
import { findZoneAtPoint, getZoneName } from "@/lib/geo/zones";
import { loadServiceZones } from "@/lib/geo/zones.server";

function validPoint(value: unknown): value is { lat: number; lng: number } {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    typeof point.lng === "number" &&
    Number.isFinite(point.lng) &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const locationType = body.locationType;
  const targetLocation = body.targetLocation;
  const targetLocationRecord =
    targetLocation && typeof targetLocation === "object"
      ? (targetLocation as Record<string, unknown>)
      : null;
  const suggestedPoint = body.suggestedPoint;
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (
    (locationType !== "pickup" && locationType !== "dropoff") ||
    !targetLocationRecord ||
    !validPoint(targetLocation) ||
    typeof targetLocationRecord.address !== "string" ||
    !targetLocationRecord.address.trim() ||
    targetLocationRecord.address.length > 300 ||
    !validPoint(suggestedPoint) ||
    description.length < 3 ||
    description.length > 500
  ) {
    return NextResponse.json(
      { error: "Provide a valid location, station point, and description." },
      { status: 400 },
    );
  }

  await connectDB();
  const region = await resolveActiveRegion({ userId: session.userId });
  const mapSettings = await getMapSettings(region.code);
  if (region.code !== "EG-CAIRO" || !mapSettings.showZones) {
    return NextResponse.json(
      { error: "Station suggestions require an active service zone." },
      { status: 400 },
    );
  }
  const zones = await loadServiceZones();
  const containingZone = findZoneAtPoint(
    [suggestedPoint.lng, suggestedPoint.lat],
    zones,
  );
  const zoneName = getZoneName(containingZone);
  if (!containingZone || !zoneName) {
    return NextResponse.json(
      { error: "Choose a station point inside an active service zone." },
      { status: 400 },
    );
  }
  const requester = await User.findById(session.userId)
    .select("userNumber name email phone")
    .lean();
  if (!requester) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const requestNumber = await nextSequence("station-suggestion-request");
  const request = await StationSuggestion.create({
    requestNumber,
    requesterId: requester._id,
    requester: {
      userNumber: requester.userNumber,
      name: requester.name,
      email: requester.email ?? "",
      phone: requester.phone,
    },
    regionCode: region.code,
    locationType,
    targetLocation: {
      address: targetLocationRecord.address.trim(),
      lat: targetLocation.lat,
      lng: targetLocation.lng,
    },
    suggestedPoint,
    zoneName,
    description,
  });

  await Promise.all([
    createNotification({
      userId: session.userId,
      type: "station_suggestion_submitted",
      title: "Station suggestion submitted",
      body: `Your station suggestion request #${requestNumber} was submitted for operations review.`,
      titleAr: "تم إرسال اقتراح المحطة",
      bodyAr: `تم إرسال طلب اقتراح المحطة رقم ${requestNumber} لمراجعته من فريق العمليات.`,
      data: {
        requestNumber,
        linkUrl: "/create",
      },
    }),
    notifyAdmins({
      eventType: "station_suggestion_requested",
      dedupeKey: `station-suggestion:${request._id}`,
      title: `New station suggestion request #${requestNumber}`,
      body: `Requester user code ${request.requester.userNumber}; ${request.requester.name}; ${request.requester.email || "No email"}; ${request.requester.phone}. Go to stations center.`,
      data: {
        href: "/admin/stations-suggestion",
        requestId: String(request._id),
        requestNumber,
        requester: request.requester,
        regionCode: region.code,
      },
    }),
  ]);

  return NextResponse.json(
    { requestNumber, message: "Station suggestion submitted for review." },
    { status: 201 },
  );
}
