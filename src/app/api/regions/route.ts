import { NextRequest, NextResponse } from "next/server";
import { isRegionCode, REGION_LIST } from "@/lib/config/regions";
import { getOperatingCities } from "@/lib/regions/cities";

export async function GET(request: NextRequest) {
  const requestedRegion = request.nextUrl.searchParams.get("regionCode");
  if (requestedRegion && !isRegionCode(requestedRegion)) {
    return NextResponse.json({ error: "Invalid region." }, { status: 400 });
  }

  const cities = await getOperatingCities(
    requestedRegion && isRegionCode(requestedRegion)
      ? requestedRegion
      : undefined,
  );
  const regions = REGION_LIST.map((region) => ({
    code: region.code,
    countryCode: region.countryCode,
    label: region.countryCode === "AE" ? "United Arab Emirates" : region.countryCode === "EG" ? "Egypt" : "Saudi Arabia",
    labelAr: region.labelAr,
    currency: region.currency,
  }));
  return NextResponse.json(
    { regions, cities },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
