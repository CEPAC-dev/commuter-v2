import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { isRegionCode } from "@/lib/config/regions";
import { ensureOperatingCitySeed } from "@/lib/regions/cities";
import { OperatingCity } from "@/models/OperatingCity";
import { Vehicle } from "@/models/Vehicle";
import { CAPITAL_CITY_CODES } from "@/lib/config/regions";
import { invalidateVehiclesCache } from "@/lib/db/getVehicles";
import type { VehicleRegionConfig } from "@/lib/config/vehicles";
import { ensureVehicleSeed } from "@/lib/db/seedVehicles";
import { validateMutationRequest } from "@/lib/security/request";
import { MapSettingsModel } from "@/models/MapSettings";
import { defaultMapSettings } from "@/lib/config/mapSettings";

export async function GET(request: NextRequest) {
  const regionCode = request.nextUrl.searchParams.get("regionCode");
  if (regionCode && !isRegionCode(regionCode)) {
    return NextResponse.json({ error: "Choose a valid Region." }, { status: 400 });
  }
  const auth = regionCode
    ? await adminAuth(undefined, regionCode)
    : await adminAuth();
  if (!auth.authorized) return auth.response;
  await ensureOperatingCitySeed();
  const cities = await OperatingCity.find(
    regionCode ? { regionCode } : {},
  )
    .sort({ isCapital: -1, name: 1 })
    .lean();
  return NextResponse.json({ cities });
}

export async function POST(request: NextRequest) {
  const invalid = validateMutationRequest(request);
  if (invalid) return invalid;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const value = body as Record<string, unknown>;
  const regionCode = value.regionCode;
  const cityCode =
    typeof value.cityCode === "string" ? value.cityCode.trim().toLowerCase() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const nameAr = typeof value.nameAr === "string" ? value.nameAr.trim() : "";
  const timezone = typeof value.timezone === "string" ? value.timezone.trim() : "";
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  const mapZoom = Number(value.mapZoom ?? 11);

  if (!isRegionCode(regionCode)) {
    return NextResponse.json({ error: "Choose a valid Region." }, { status: 400 });
  }
  const auth = await adminAuth(undefined, regionCode);
  if (!auth.authorized) return auth.response;
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cityCode) ||
    !name ||
    name.length > 100 ||
    !nameAr ||
    nameAr.length > 100 ||
    !timezone ||
    timezone.length > 80 ||
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180 ||
    !Number.isInteger(mapZoom) ||
    mapZoom < 1 ||
    mapZoom > 20
  ) {
    return NextResponse.json({ error: "Invalid City/State settings." }, { status: 400 });
  }

  await ensureOperatingCitySeed();
  await ensureVehicleSeed();
  try {
    const city = await OperatingCity.create({
      regionCode,
      cityCode,
      name,
      nameAr,
      timezone,
      mapCenter: { lat, lng },
      mapZoom,
      isCapital: false,
      active: false,
    });
    const capitalCode = CAPITAL_CITY_CODES[regionCode];
    const capitalSettings =
      (await MapSettingsModel.findOne({
        regionCode,
        cityCode: capitalCode,
      }).lean()) ??
      (await MapSettingsModel.findOne({
        regionCode,
        $or: [
          { cityCode: { $exists: false } },
          { cityCode: null },
          { cityCode: "" },
        ],
      }).lean()) ??
      defaultMapSettings(regionCode, capitalCode);
    await MapSettingsModel.create({
      regionCode,
      cityCode,
      provider: capitalSettings.provider,
      canvasStyle: capitalSettings.canvasStyle,
      osmTheme: capitalSettings.osmTheme,
      showStations: capitalSettings.showStations,
      stationAssignmentMode: capitalSettings.stationAssignmentMode,
      directPointZoneIds: [],
      stationZoneIds: [],
      showZones: false,
      showZoneLabels: false,
      maskOutsideZones: false,
    });
    const vehicles = await Vehicle.find({
      "regionConfigs.regionCode": regionCode,
    }).lean();
    await Promise.all(
      vehicles.map((vehicle) => {
        const configs = (vehicle.regionConfigs ?? []) as VehicleRegionConfig[];
        if (
          configs.some(
            (config) =>
              config.regionCode === regionCode && config.cityCode === cityCode,
          )
        ) {
          return Promise.resolve();
        }
        const capitalConfig =
          configs.find(
            (config) =>
              config.regionCode === regionCode &&
              config.cityCode === CAPITAL_CITY_CODES[regionCode],
          ) ??
          configs.find(
            (config) =>
              config.regionCode === regionCode && !config.cityCode,
          );
        if (!capitalConfig) return Promise.resolve();
        return Vehicle.updateOne(
          { _id: vehicle._id },
          {
            $push: {
              regionConfigs: { ...capitalConfig, cityCode },
            },
          },
        );
      }),
    );
    invalidateVehiclesCache();
    return NextResponse.json({ city }, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        { error: "That City/State code already exists in this Region." },
        { status: 409 },
      );
    }
    console.error("Operating city creation failed:", error);
    return NextResponse.json({ error: "Could not create City/State." }, { status: 500 });
  }
}
