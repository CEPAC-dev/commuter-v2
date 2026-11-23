import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { connectDB } from "@/lib/db/mongoose";
import { Station } from "@/models/Station";
import { StationDataset } from "@/models/StationDataset";
import { StationRegionState } from "@/models/StationRegionState";

export async function GET(req: NextRequest) {
  const auth = await adminAuth(PERMISSIONS.STATIONS_MANAGE, req.nextUrl.searchParams.get("region"), req.nextUrl.searchParams.get("cityCode"));
  if (!auth.authorized) return auth.response;
  await connectDB();
  const [state, total, active, byType, byDirection, byZone, pending, failed] = await Promise.all([
    StationRegionState.findOne({ regionCode: auth.region.code, cityCode: auth.region.cityCode }).lean(),
    Station.countDocuments({ regionCode: auth.region.code, cityCode: auth.region.cityCode }),
    Station.countDocuments({ regionCode: auth.region.code, cityCode: auth.region.cityCode, active: true }),
    Station.aggregate([{ $match: { regionCode: auth.region.code, cityCode: auth.region.cityCode } }, { $group: { _id: "$stationType", count: { $sum: 1 } } }]),
    Station.aggregate([{ $match: { regionCode: auth.region.code, cityCode: auth.region.cityCode } }, { $group: { _id: "$direction", count: { $sum: 1 } } }]),
    Station.aggregate([{ $match: { regionCode: auth.region.code, cityCode: auth.region.cityCode } }, { $group: { _id: "$zones", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 20 }]),
    StationDataset.countDocuments({ regionCode: auth.region.code, cityCode: auth.region.cityCode, status: { $in: ["UPLOADED", "VALIDATING", "VALID"] } }),
    StationDataset.countDocuments({ regionCode: auth.region.code, cityCode: auth.region.cityCode, status: "INVALID" }),
  ]);
  const activeDataset = state?.activeDatasetVersionId ? await StationDataset.findOne({ _id: state.activeDatasetVersionId, regionCode: auth.region.code, cityCode: auth.region.cityCode }).lean() : null;
  return NextResponse.json({ region: auth.region.config, activeDataset, statistics: { total, active, inactive: total - active, byType, byDirection, byZone, pending, failed } });
}
