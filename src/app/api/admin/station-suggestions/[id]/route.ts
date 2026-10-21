import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { connectDB } from "@/lib/db/mongoose";
import { createNotification } from "@/lib/notifications/createNotification";
import { nextSequence, Counter } from "@/models/Counter";
import { Station } from "@/models/Station";
import { StationAuditLog } from "@/models/StationAuditLog";
import { StationSuggestion } from "@/models/StationSuggestion";
import { findZoneAtPoint, getZoneName } from "@/lib/geo/zones";
import { loadServiceZones } from "@/lib/geo/zones.server";

type RouteContext = { params: Promise<{ id: string }> };

const STATION_TEXT_FIELDS = [
  "name",
  "direction",
  "zones",
  "landmark",
  "stationType",
] as const;

function validCoordinate(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await adminAuth(
    PERMISSIONS.STATIONS_MANAGE,
    req.nextUrl.searchParams.get("region"),
  );
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid request id." }, { status: 400 });
  }
  await connectDB();
  const request = await StationSuggestion.findOne({
    _id: id,
    regionCode: auth.region.code,
  }).lean();
  if (!request) {
    return NextResponse.json(
      { error: "Station suggestion request not found." },
      { status: 404 },
    );
  }
  return NextResponse.json({ request });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await adminAuth(
    PERMISSIONS.STATIONS_MANAGE,
    req.nextUrl.searchParams.get("region"),
  );
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid request id." }, { status: 400 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "Choose approve or reject." },
      { status: 400 },
    );
  }

  await connectDB();
  const suggestion = await StationSuggestion.findOne({
    _id: id,
    regionCode: auth.region.code,
  });
  if (!suggestion) {
    return NextResponse.json(
      { error: "Station suggestion request not found." },
      { status: 404 },
    );
  }
  if (suggestion.status !== "pending") {
    return NextResponse.json(
      {
        error: "This request has already been reviewed or is being processed.",
      },
      { status: 409 },
    );
  }

  const reviewedAt = new Date();
  if (action === "reject") {
    const rejectionReason =
      typeof body.rejectionReason === "string"
        ? body.rejectionReason.trim().slice(0, 400)
        : "";
    const rejected = await StationSuggestion.findOneAndUpdate(
      { _id: id, status: "pending" },
      {
        $set: {
          status: "rejected",
          reviewedBy: auth.userId,
          reviewedAt,
          rejectionReason,
        },
      },
      { returnDocument: "after" },
    );
    if (!rejected) {
      return NextResponse.json(
        { error: "This request was already reviewed." },
        { status: 409 },
      );
    }
    await createNotification({
      userId: String(rejected.requesterId),
      type: "station_suggestion_reviewed",
      title: `Station suggestion #${rejected.requestNumber} was not approved`,
      body: rejectionReason
        ? `Operations reviewed your suggestion and declined it: ${rejectionReason}`
        : "Operations reviewed your station suggestion and did not approve it.",
      titleAr: `لم تتم الموافقة على اقتراح المحطة رقم ${rejected.requestNumber}`,
      bodyAr: rejectionReason
        ? `راجع فريق العمليات اقتراحك ولم يوافق عليه: ${rejectionReason}`
        : "راجع فريق العمليات اقتراح المحطة ولم يوافق عليه.",
      data: { requestNumber: rejected.requestNumber, status: "rejected" },
    });
    return NextResponse.json({ request: rejected });
  }

  const stationInput =
    body.station && typeof body.station === "object"
      ? (body.station as Record<string, unknown>)
      : null;
  const lat = stationInput?.lat;
  const lng = stationInput?.lng;
  const stationType = stationInput?.stationType;
  const zones = await loadServiceZones(auth.region.code);
  const finalZoneName =
    validCoordinate(lat, -90, 90) && validCoordinate(lng, -180, 180)
      ? getZoneName(findZoneAtPoint([lng, lat], zones))
      : "";
  if (
    !stationInput ||
    !validCoordinate(lat, -90, 90) ||
    !validCoordinate(lng, -180, 180) ||
    !finalZoneName ||
    stationInput.zones !== finalZoneName ||
    typeof stationType !== "string" ||
    !["1", "2", "3"].includes(stationType) ||
    STATION_TEXT_FIELDS.some(
      (field) =>
        stationInput[field] != null &&
        (typeof stationInput[field] !== "string" ||
          stationInput[field].length > 300),
    )
  ) {
    return NextResponse.json(
      { error: "Provide valid station details at the suggested point." },
      { status: 400 },
    );
  }

  const locked = await StationSuggestion.findOneAndUpdate(
    { _id: id, status: "pending" },
    {
      $set: {
        status: "processing",
        reviewedBy: auth.userId,
        reviewedAt,
      },
    },
    { returnDocument: "after" },
  );
  if (!locked) {
    return NextResponse.json(
      { error: "This request was already reviewed." },
      { status: 409 },
    );
  }

  const maximumStation = await Station.findOne()
    .sort({ objectId: -1 })
    .select("objectId")
    .lean<{ objectId?: number } | null>();
  await Counter.updateOne(
    { _id: "station-object-id" },
    { $max: { value: maximumStation?.objectId ?? 0 } },
    { upsert: true },
  );
  const objectId = await nextSequence("station-object-id");
  let stationId: Types.ObjectId | null = null;
  let stationName = "";
  let auditLogId: Types.ObjectId | null = null;
  let approved: typeof suggestion | null = null;
  try {
    const station = await Station.create({
      objectId,
      sourceObjectId: objectId,
      sourceKind: "manual",
      name: String(stationInput.name ?? "").trim(),
      direction: String(stationInput.direction ?? "").trim(),
      zones: finalZoneName,
      description: suggestion.description,
      landmark: String(stationInput.landmark ?? "").trim(),
      stationType,
      lat,
      lng,
      active: true,
      regionCode: suggestion.regionCode,
    });
    stationId = station._id;
    stationName = station.name;
    const auditLog = await StationAuditLog.create({
      action: "manual_create",
      regionCode: suggestion.regionCode,
      actorId: auth.userId,
      stationId: station._id,
      metadata: { objectId, after: station.toObject() },
    });
    auditLogId = auditLog._id;
    approved = await StationSuggestion.findOneAndUpdate(
      { _id: id, status: "processing", reviewedBy: auth.userId },
      {
        $set: {
          status: "approved",
          stationId: station._id,
          reviewedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );
    if (!approved) {
      throw new Error("Could not complete the station suggestion approval.");
    }
  } catch (error) {
    if (stationId) await Station.deleteOne({ _id: stationId });
    if (auditLogId) {
      await StationAuditLog.deleteOne({ _id: auditLogId });
    }
    await StationSuggestion.updateOne(
      { _id: id, status: "processing", reviewedBy: auth.userId },
      {
        $set: { status: "pending" },
        $unset: { reviewedBy: 1, reviewedAt: 1 },
      },
    );
    throw error;
  }

  await createNotification({
    userId: String(approved.requesterId),
    type: "station_suggestion_reviewed",
    title: `Station suggestion #${approved.requestNumber} approved`,
    body: `Operations approved your suggestion and added ${stationName || "the new station"}.`,
    titleAr: `تمت الموافقة على اقتراح المحطة رقم ${approved.requestNumber}`,
    bodyAr: `وافق فريق العمليات على اقتراحك وأضاف ${stationName || "المحطة الجديدة"}.`,
    data: {
      requestNumber: approved.requestNumber,
      status: "approved",
      stationId: String(stationId),
    },
  });
  return NextResponse.json({ request: approved });
}
