import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { publishStationDataset, StationPublishError } from "@/lib/stations/publishDataset";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await adminAuth(PERMISSIONS.STATIONS_PUBLISH, req.nextUrl.searchParams.get("region"));
  if (!auth.authorized) return auth.response;
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid dataset id." }, { status: 400 });
  try { return NextResponse.json({ ok: true, ...(await publishStationDataset({ datasetId: id, regionCode: auth.region.code, actorId: auth.userId, rollback: true })) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Rollback failed." }, { status: error instanceof StationPublishError ? error.status : 500 }); }
}
