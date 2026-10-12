import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ZoneFeature } from "@/lib/geo/zones";

export async function loadServiceZones(): Promise<ZoneFeature[]> {
  const file = await readFile(
    path.join(process.cwd(), "public", "geo", "zone_polygon.geojson"),
    "utf8",
  );
  const parsed = JSON.parse(file) as { features?: ZoneFeature[] };
  return (parsed.features ?? []).filter(
    (feature) =>
      feature.geometry?.type === "Polygon" ||
      feature.geometry?.type === "MultiPolygon",
  );
}
