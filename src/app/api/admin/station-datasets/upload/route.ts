import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { nextSequence } from "@/models/Counter";
import { StationDataset } from "@/models/StationDataset";
import { StationAuditLog } from "@/models/StationAuditLog";
import {
  deleteStationDatasetSource,
  putStationDatasetSource,
} from "@/lib/storage/stationDatasetStorage";
import { validateMutationRequest } from "@/lib/security/request";

export const runtime = "nodejs";
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/json",
  "application/geo+json",
  "application/octet-stream",
]);

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req, {
    requireJson: false,
    maxBytes: MAX_SIZE + 64 * 1024,
  });
  if (invalidRequest) return invalidRequest;

  const requestedRegion = req.nextUrl.searchParams.get("region");
  const auth = await adminAuth(undefined, requestedRegion);
  if (!auth.authorized) return auth.response;

  let file: File | null = null;
  try {
    const formData = await req.formData();
    const value = formData.get("file");
    if (value instanceof File) file = value;
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }
  if (!file)
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (file.size < 1 || file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File must be between 1 byte and 10MB." },
      { status: 400 },
    );
  }
  const extensionAllowed = /\.(json|geojson)$/i.test(file.name);
  if (!extensionAllowed || (file.type && !ALLOWED_TYPES.has(file.type))) {
    return NextResponse.json(
      { error: "Only JSON or GeoJSON files are supported." },
      { status: 415 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  const datasetId = new Types.ObjectId();
  const storageKey = `station-datasets/${auth.region.code}/${datasetId}/source.geojson`;

  await connectDB();
  const version = await nextSequence(`station-dataset:${auth.region.code}`);
  try {
    await putStationDatasetSource({
      storageKey,
      body: bytes,
      contentType: file.type || "application/geo+json",
    });
    const dataset = await StationDataset.create({
      _id: datasetId,
      regionCode: auth.region.code,
      version,
      status: "UPLOADED",
      file: {
        originalName: file.name,
        contentType: file.type || "application/geo+json",
        size: file.size,
        checksumSha256,
        storageKey,
      },
      uploadedBy: auth.userId,
    });
    await StationAuditLog.create({
      action: "upload",
      regionCode: auth.region.code,
      datasetVersionId: dataset._id,
      actorId: auth.userId,
      metadata: { version, checksumSha256, size: file.size },
    });
    return NextResponse.json(
      { datasetId: String(dataset._id), version, status: dataset.status },
      { status: 201 },
    );
  } catch (error) {
    await deleteStationDatasetSource(storageKey).catch(() => undefined);
    await StationAuditLog.create({
      action: "failed",
      regionCode: auth.region.code,
      actorId: auth.userId,
      metadata: {
        operation: "upload",
        message: error instanceof Error ? error.message : "Upload failed.",
      },
    }).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Upload failed.";
    const status = message.includes("not configured") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
