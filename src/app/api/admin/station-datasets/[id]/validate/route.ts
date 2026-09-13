import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Station } from "@/models/Station";
import { StationDataset } from "@/models/StationDataset";
import { StationAuditLog } from "@/models/StationAuditLog";
import { getStationDatasetSource } from "@/lib/storage/stationDatasetStorage";
import { validateStationGeoJson } from "@/lib/stations/validateGeoJson";
import { diffStationDataset } from "@/lib/stations/diffDataset";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(
    undefined,
    req.nextUrl.searchParams.get("region"),
  );
  if (!auth.authorized) return auth.response;
  const { id } = await params;
  if (!Types.ObjectId.isValid(id))
    return NextResponse.json({ error: "Invalid dataset id." }, { status: 400 });

  await connectDB();
  const dataset = await StationDataset.findOneAndUpdate(
    {
      _id: id,
      regionCode: auth.region.code,
      status: { $in: ["UPLOADED", "VALID", "INVALID"] },
    },
    { $set: { status: "VALIDATING" } },
    { returnDocument: "after" },
  ).lean();
  if (!dataset)
    return NextResponse.json(
      { error: "Dataset cannot be validated." },
      { status: 409 },
    );

  try {
    const source = await getStationDatasetSource(dataset.file.storageKey);
    const checksum = createHash("sha256").update(source.bytes).digest("hex");
    if (checksum !== dataset.file.checksumSha256)
      throw new Error("Dataset checksum mismatch.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(source.bytes).toString("utf8"));
    } catch {
      parsed = null;
    }
    const validation = validateStationGeoJson(parsed, auth.region.code);
    const active = await Station.find({
      regionCode: auth.region.code,
      active: true,
    })
      .select(
        "objectId name direction zones description landmark stationType lat lng",
      )
      .lean();
    const diff = diffStationDataset(validation.records, active);
    const status = validation.errors.length === 0 ? "VALID" : "INVALID";
    await StationDataset.updateOne(
      { _id: dataset._id, status: "VALIDATING" },
      {
        $set: {
          status,
          validatedAt: new Date(),
          stationCount: validation.totalCount,
          validCount: validation.validCount,
          invalidCount: validation.invalidCount,
          errors: validation.errors,
          warnings: validation.warnings,
          normalizedStations: validation.records,
          ...diff,
        },
      },
    );
    await StationAuditLog.create({
      action: "validate",
      regionCode: auth.region.code,
      datasetVersionId: dataset._id,
      actorId: auth.userId,
      metadata: { status, ...diff },
    });
    return NextResponse.json({
      status,
      ...validation,
      ...diff,
      records: undefined,
    });
  } catch (error) {
    await StationDataset.updateOne(
      { _id: dataset._id },
      {
        $set: {
          status: "INVALID",
          errors: [
            {
              field: "file",
              code: "VALIDATION_FAILED",
              message:
                error instanceof Error ? error.message : "Validation failed.",
            },
          ],
        },
      },
    );
    await StationAuditLog.create({
      action: "failed",
      regionCode: auth.region.code,
      datasetVersionId: dataset._id,
      actorId: auth.userId,
      metadata: {
        operation: "validate",
        message: error instanceof Error ? error.message : "Validation failed.",
      },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Validation failed." },
      { status: 422 },
    );
  }
}
