import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { connectDB } from "@/lib/db/mongoose";
import type { RegionCode } from "@/lib/config/regions";
import type { ZoneFeature } from "@/lib/geo/zones";
import { ZoneDataset } from "@/models/ZoneDataset";
import { OperatingCity } from "@/models/OperatingCity";
import { CAPITAL_CITY_CODES } from "@/lib/config/regions";

export interface ServiceZoneConfig {
  regionCode: RegionCode;
  cityCode: string;
  sourceName: string | null;
  source: "database" | "legacy-file" | "none";
  features: ZoneFeature[];
}

function validFeatures(features: ZoneFeature[]): ZoneFeature[] {
  return features.filter(
    (feature) =>
      feature.geometry?.type === "Polygon" ||
      feature.geometry?.type === "MultiPolygon",
  );
}

export async function getServiceZoneConfig(
  regionCode: RegionCode,
  cityCode?: string,
): Promise<ServiceZoneConfig> {
  await connectDB();
  if (cityCode && cityCode !== CAPITAL_CITY_CODES[regionCode]) {
    const city = await OperatingCity.findOne({ regionCode, cityCode })
    .select("zoneFeatures zoneSourceName name")
    .lean<{ zoneFeatures?: ZoneFeature[]; zoneSourceName?: string; name?: string } | null>();
    const cityFeatures = validFeatures(city?.zoneFeatures ?? []);
    return {
      regionCode,
      cityCode,
      sourceName: city?.zoneSourceName || null,
      source: cityFeatures.length ? "database" : "none",
      features: cityFeatures,
    };
  }
  const capitalCode = cityCode ?? CAPITAL_CITY_CODES[regionCode];
  const capitalCity = await OperatingCity.findOne({
    regionCode,
    cityCode: capitalCode,
  })
    .select("zoneFeatures zoneSourceName name")
    .lean<{ zoneFeatures?: ZoneFeature[]; zoneSourceName?: string; name?: string } | null>();
  const capitalFeatures = validFeatures(capitalCity?.zoneFeatures ?? []);
  if (capitalFeatures.length) {
    return {
      regionCode,
      cityCode: capitalCode,
      sourceName: capitalCity?.zoneSourceName || null,
      source: "database",
      features: capitalFeatures,
    };
  }
  const stored = await ZoneDataset.findOne({ regionCode }).lean<{
    sourceName: string;
    features: ZoneFeature[];
  }>();
  if (stored) {
    return {
      regionCode,
      cityCode: capitalCode,
      sourceName: stored.sourceName,
      source: "database",
      features: validFeatures(stored.features ?? []),
    };
  }

  if (regionCode === "EGY") {
    try {
      const file = await readFile(
        path.join(process.cwd(), "public", "geo", "zone_polygon.geojson"),
        "utf8",
      );
      const parsed = JSON.parse(file) as { features?: ZoneFeature[] };
      const features = validFeatures(parsed.features ?? []);
      if (features.length) {
        return {
          regionCode,
          cityCode: capitalCode,
          sourceName: "zone_polygon.geojson (legacy fallback)",
          source: "legacy-file",
          features,
        };
      }
    } catch {
      // A missing legacy file means no zone configuration is available.
    }
  }

  return {
    regionCode,
    cityCode: capitalCode,
    sourceName: null,
    source: "none",
    features: [],
  };
}

export async function loadServiceZones(
  regionCode: RegionCode,
  cityCode?: string,
): Promise<ZoneFeature[]> {
  return (await getServiceZoneConfig(regionCode, cityCode)).features;
}
