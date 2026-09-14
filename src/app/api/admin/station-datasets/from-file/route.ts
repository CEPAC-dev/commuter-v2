import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { nextSequence } from "@/models/Counter";
import { StationDataset } from "@/models/StationDataset";
import { StationAuditLog } from "@/models/StationAuditLog";
import { getStationDatasetSource } from "@/lib/storage/stationDatasetStorage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await adminAuth(undefined, req.nextUrl.searchParams.get("region"));
  if (!auth.authorized) return auth.response;

  let storageKey = "";
  try {
    const body = await req.json();
    storageKey = typeof body.path === "string" ? body.path.trim() : "";
    if (!storageKey || !/\.geojson$/i.test(storageKey)) {
      return NextResponse.json({ error: "Choose a valid GeoJSON file." }, { status: 400 });
    }
    const source = await getStationDatasetSource(storageKey);
    if (source.bytes.length === 0) {
      return NextResponse.json({ error: "The selected GeoJSON file is empty." }, { status: 400 });
    }
    await connectDB();
    const version = await nextSequence(`station-dataset:${auth.region.code}`);
    const originalName = storageKey.split("/").at(-1) ?? "source.geojson";
    const dataset = await StationDataset.create({
      regionCode: auth.region.code,
      version,
      status: "UPLOADED",
      file: {
        originalName,
        contentType: source.contentType,
        size: source.bytes.length,
        checksumSha256: createHash("sha256").update(source.bytes).digest("hex"),
        storageKey,
      },
      uploadedBy: auth.userId,
    });
    await StationAuditLog.create({
      action: "upload",
      regionCode: auth.region.code,
      datasetVersionId: dataset._id,
      actorId: auth.userId,
      metadata: { version, storageKey, reusedExistingFile: true },
    });
    return NextResponse.json({ datasetId: String(dataset._id), version, status: dataset.status }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not use the selected file.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
