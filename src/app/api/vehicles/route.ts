import { NextRequest, NextResponse } from "next/server";
import { ensureVehicleSeed } from "@/lib/db/seedVehicles";
import { Vehicle } from "@/models/Vehicle";
import { isRegionCode, type RegionCode } from "@/lib/config/regions";
import { vehicleForRegion } from "@/lib/vehicles/regionConfig";
import { AdminSettings } from "@/models/AdminSettings";
import { getSharedRideWaitingListEnabled } from "@/lib/admin/waitingList";
import { isOperatingCityInRegion } from "@/lib/regions/cities";

export async function GET(req: NextRequest) {
  await ensureVehicleSeed();
  const region = req.nextUrl.searchParams.get("region");
  const cityCode = req.nextUrl.searchParams.get("cityCode");
  if (region && !isRegionCode(region)) {
    return NextResponse.json({ error: "Invalid region" }, { status: 400 });
  }
  if (region && !cityCode) {
    return NextResponse.json(
      { error: "cityCode is required with region." },
      { status: 400 },
    );
  }
  if (
    region &&
    cityCode &&
    !(await isOperatingCityInRegion(region as RegionCode, cityCode))
  ) {
    return NextResponse.json({ error: "Invalid City/State." }, { status: 400 });
  }
  const vehicles = await Vehicle.find({})
    .sort({ sortOrder: 1 })
    .select(
      "key label rate additional_rate ride vehicle_type trip_type buffer window capacity occupancy min_occupancy minimum_charge regionCodes regionConfigs sortOrder active",
    )
    .lean();
  const scoped = region
    ? vehicles.map((vehicle) => vehicleForRegion(vehicle, region as RegionCode, cityCode ?? undefined)).filter(Boolean)
    : vehicles;
  const settings = await AdminSettings.findOne()
    .select("sharedRideWaitingListEnabled")
    .lean<{ sharedRideWaitingListEnabled?: boolean } | null>();
  return NextResponse.json({
    vehicles: scoped,
    sharedRideWaitingListEnabled: getSharedRideWaitingListEnabled(
      settings?.sharedRideWaitingListEnabled,
    ),
  });
}
