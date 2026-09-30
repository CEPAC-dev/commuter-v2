import "server-only";

import { connectDB } from "@/lib/db/mongoose";
import { defaultMapSettings, type MapSettings } from "@/lib/config/mapSettings";
import type { RegionCode } from "@/lib/config/regions";
import { MapSettingsModel } from "@/models/MapSettings";

export async function getMapSettings(
  regionCode: RegionCode,
): Promise<MapSettings> {
  await connectDB();
  const stored = await MapSettingsModel.findOne({ regionCode }).lean();
  const fallback = defaultMapSettings(regionCode);
  return stored
    ? {
        regionCode,
        provider: stored.provider ?? fallback.provider,
        canvasStyle: stored.canvasStyle ?? fallback.canvasStyle,
        osmTheme: stored.osmTheme ?? fallback.osmTheme,
        showStations: stored.showStations ?? fallback.showStations,
        showZones: stored.showZones ?? fallback.showZones,
        showZoneLabels: stored.showZoneLabels ?? fallback.showZoneLabels,
        maskOutsideZones: stored.maskOutsideZones ?? fallback.maskOutsideZones,
      }
    : fallback;
}
