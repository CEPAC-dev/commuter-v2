import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Station } from "@/models/Station";
import { StationDataset } from "@/models/StationDataset";
import { StationAuditLog } from "@/models/StationAuditLog";
import { diffStationDatasetDetailed } from "@/lib/stations/diffDataset";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(
    undefined,
    req.nextUrl.searchParams.get("region"),
  );
  if (!auth.authorized) return auth.response;
  if (!auth.region)
    return NextResponse.json(
      { error: "Region context is required." },
      { status: 500 },
    );
  const region = auth.region;
  const { id } = await params;
  if (!Types.ObjectId.isValid(id))
    return NextResponse.json({ error: "Invalid dataset id." }, { status: 400 });
  await connectDB();
  const dataset = await StationDataset.findOne({
    _id: id,
    regionCode: region.code,
  })
    .select("+normalizedStations")
    .lean();
  if (!dataset)
    return NextResponse.json({ error: "Dataset not found." }, { status: 404 });
  if (!["VALID", "PUBLISHED", "ARCHIVED"].includes(dataset.status)) {
    return NextResponse.json(
      { error: "Dataset must be valid before preview." },
      { status: 409 },
    );
  }
  const active = await Station.find({
    regionCode: region.code,
    active: true,
  })
    .select(
      "objectId name direction zones description landmark stationType lat lng",
    )
    .lean();
  const diff = diffStationDatasetDetailed(dataset.normalizedStations, active);
  await StationDataset.updateOne({ _id: dataset._id }, { $set: diff });
  await StationAuditLog.create({
    action: "preview",
    regionCode: region.code,
    datasetVersionId: dataset._id,
    actorId: auth.userId,
    metadata: diff,
  });
  return NextResponse.json({
    datasetId: String(dataset._id),
    regionCode: dataset.regionCode,
    version: dataset.version,
    status: dataset.status,
    file: dataset.file,
    stationCount: dataset.stationCount,
    validCount: dataset.validCount,
    invalidCount: dataset.invalidCount,
    errors: dataset.errors,
    warnings: dataset.warnings,
    ...diff,
  });
}
