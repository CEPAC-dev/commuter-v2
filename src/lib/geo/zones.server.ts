import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { connectDB } from "@/lib/db/mongoose";
import type { RegionCode } from "@/lib/config/regions";
import type { ZoneFeature } from "@/lib/geo/zones";
import { ZoneDataset } from "@/models/ZoneDataset";

export interface ServiceZoneConfig {
  regionCode: RegionCode;
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
): Promise<ServiceZoneConfig> {
  await connectDB();
  const stored = await ZoneDataset.findOne({ regionCode }).lean<{
    sourceName: string;
    features: ZoneFeature[];
  }>();
  if (stored) {
    return {
      regionCode,
      sourceName: stored.sourceName,
      source: "database",
      features: validFeatures(stored.features ?? []),
    };
  }

  if (regionCode === "EG-CAIRO") {
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
          sourceName: "zone_polygon.geojson (legacy fallback)",
          source: "legacy-file",
          features,
        };
      }
    } catch {
      // A missing legacy file means no zone configuration is available.
    }
  }

  return { regionCode, sourceName: null, source: "none", features: [] };
}

export async function loadServiceZones(
  regionCode: RegionCode,
): Promise<ZoneFeature[]> {
  return (await getServiceZoneConfig(regionCode)).features;
}
