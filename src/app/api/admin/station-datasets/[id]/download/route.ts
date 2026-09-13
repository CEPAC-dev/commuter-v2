import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { StationDataset } from "@/models/StationDataset";
import { getStationDatasetSource } from "@/lib/storage/stationDatasetStorage";
import { StationAuditLog } from "@/models/StationAuditLog";

export const runtime = "nodejs";

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
  }).lean();

  if (!dataset)
    return NextResponse.json({ error: "Dataset not found." }, { status: 404 });
  try {
    const source = await getStationDatasetSource(dataset.file.storageKey);
    const safeName = dataset.file.originalName.replace(/[^A-Za-z0-9._-]/g, "_");
    await StationAuditLog.create({
      action: "download",
      regionCode: region.code,
      datasetVersionId: dataset._id,
      actorId: auth.userId,
    });
    return new NextResponse(Buffer.from(source.bytes), {
      headers: {
        "Content-Type": source.contentType,
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Download failed." },
      { status: 500 },
    );
  }
}
