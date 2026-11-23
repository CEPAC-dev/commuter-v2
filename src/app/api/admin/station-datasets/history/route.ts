import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { StationDataset } from "@/models/StationDataset";

export async function GET(req: NextRequest) {
  const auth = await adminAuth(
    undefined,
    req.nextUrl.searchParams.get("region"),
    req.nextUrl.searchParams.get("cityCode"),
  );
  if (!auth.authorized) return auth.response;
  await connectDB();
  const datasets = await StationDataset.find({
    regionCode: auth.region.code,
    cityCode: auth.region.cityCode,
  })
    .select(
      "regionCode cityCode version status file uploadedBy uploadedAt validatedAt publishedAt publishedBy stationCount validCount invalidCount newCount updatedCount removedCount unchangedCount createdAt",
    )
    .sort({ version: -1 })
    .limit(100)
    .lean();
  return NextResponse.json({ region: auth.region.config, datasets });
}
