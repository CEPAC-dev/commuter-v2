import type { StationDatasetRecord } from "./validateGeoJson.ts";

const COMPARISON_FIELDS: Array<keyof StationDatasetRecord> = [
  "name",
  "direction",
  "zones",
  "description",
  "landmark",
  "stationType",
  "lat",
  "lng",
];

export interface StationDatasetDiff {
  newCount: number;
  updatedCount: number;
  removedCount: number;
  unchangedCount: number;
}

export function diffStationDataset(
  incoming: StationDatasetRecord[],
  active: StationDatasetRecord[],
): StationDatasetDiff {
  const activeById = new Map(
    active.map((station) => [station.objectId, station]),
  );
  const incomingIds = new Set(incoming.map((station) => station.objectId));
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const station of incoming) {
    const current = activeById.get(station.objectId);
    if (!current) {
      newCount += 1;
    } else if (
      COMPARISON_FIELDS.some((field) => station[field] !== current[field])
    ) {
      updatedCount += 1;
    } else {
      unchangedCount += 1;
    }
  }

  return {
    newCount,
    updatedCount,
    unchangedCount,
    removedCount: active.filter((station) => !incomingIds.has(station.objectId))
      .length,
  };
}
