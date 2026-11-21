import "server-only";

import { connectDB } from "@/lib/db/mongoose";
import { defaultMapSettings, type MapSettings } from "@/lib/config/mapSettings";
import {
  CAPITAL_CITY_CODES,
  type RegionCode,
} from "@/lib/config/regions";
import { MapSettingsModel } from "@/models/MapSettings";

export async function getMapSettings(
  regionCode: RegionCode,
  cityCode: string,
): Promise<MapSettings> {
  await connectDB();
  let stored = await MapSettingsModel.findOne({ regionCode, cityCode }).lean();
  if (!stored && cityCode === CAPITAL_CITY_CODES[regionCode]) {
    stored = await MapSettingsModel.findOne({
      regionCode,
      $or: [
        { cityCode: { $exists: false } },
        { cityCode: null },
        { cityCode: "" },
      ],
    }).lean();
  }
  const fallback = defaultMapSettings(regionCode, cityCode);
  return stored
    ? {
        regionCode,
        cityCode,
        provider: stored.provider ?? fallback.provider,
        canvasStyle: stored.canvasStyle ?? fallback.canvasStyle,
        osmTheme: stored.osmTheme ?? fallback.osmTheme,
        showStations: stored.showStations ?? fallback.showStations,
        stationAssignmentMode:
          stored.stationAssignmentMode ?? fallback.stationAssignmentMode,
        directPointZoneIds:
          stored.directPointZoneIds ?? fallback.directPointZoneIds,
        stationZoneIds: stored.stationZoneIds ?? fallback.stationZoneIds,
        showZones: stored.showZones ?? fallback.showZones,
        showZoneLabels: stored.showZoneLabels ?? fallback.showZoneLabels,
        maskOutsideZones: stored.maskOutsideZones ?? fallback.maskOutsideZones,
      }
    : fallback;
}
