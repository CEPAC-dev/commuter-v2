import { REGIONS, type RegionCode } from "../config/regions.ts";

export interface StationDatasetRecord {
  objectId: number;
  name: string;
  direction: string;
  zones: string;
  description: string;
  landmark: string;
  stationType: string;
  lat: number;
  lng: number;
}

export interface StationValidationIssue {
  row?: number;
  field: string;
  code: string;
  message: string;
}

export interface StationValidationResult {
  totalCount: number;
  validCount: number;
  invalidCount: number;
  records: StationDatasetRecord[];
  errors: StationValidationIssue[];
  warnings: StationValidationIssue[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function validateStationGeoJson(
  input: unknown,
  regionCode: RegionCode,
): StationValidationResult {
  const errors: StationValidationIssue[] = [];
  const warnings: StationValidationIssue[] = [];
  const records: StationDatasetRecord[] = [];
  const root = record(input);
  const features = root?.features;
  if (root?.type !== "FeatureCollection" || !Array.isArray(features)) {
    return {
      totalCount: 0,
      validCount: 0,
      invalidCount: 1,
      records,
      errors: [
        {
          field: "type",
          code: "INVALID_GEOJSON",
          message: "Expected a GeoJSON FeatureCollection.",
        },
      ],
      warnings,
    };
  }
  if (features.length === 0) {
    return {
      totalCount: 0,
      validCount: 0,
      invalidCount: 1,
      records,
      errors: [
        {
          field: "features",
          code: "EMPTY_DATASET",
          message: "Dataset contains no station features.",
        },
      ],
      warnings,
    };
  }

  const ids = new Set<number>();
  const coordinates = new Set<string>();
  const bounds = REGIONS[regionCode].map.bounds;
  features.forEach((rawFeature, index) => {
    const row = index + 1;
    const featureErrorsBefore = errors.length;
    const feature = record(rawFeature);
    const geometry = record(feature?.geometry);
    const properties = record(feature?.properties) ?? {};
    if (geometry?.type !== "Point") {
      errors.push({
        row,
        field: "geometry.type",
        code: "UNSUPPORTED_GEOMETRY",
        message: "Station geometry must be Point.",
      });
    }
    const coords = geometry?.coordinates;
    const lng = Array.isArray(coords) ? Number(coords[0]) : NaN;
    const lat = Array.isArray(coords) ? Number(coords[1]) : NaN;
    if (
      !Array.isArray(coords) ||
      coords.length < 2 ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      errors.push({
        row,
        field: "coordinates",
        code: "INVALID_COORDINATES",
        message: "Expected valid [lng, lat] coordinates.",
      });
    } else if (
      bounds &&
      (lat < bounds.minLat ||
        lat > bounds.maxLat ||
        lng < bounds.minLng ||
        lng > bounds.maxLng)
    ) {
      errors.push({
        row,
        field: "coordinates",
        code: "OUTSIDE_REGION",
        message: `Coordinates are outside ${REGIONS[regionCode].label}.`,
      });
    }

    const rawObjectId = properties.OBJECTID ?? feature?.id;
    const objectId = Number(rawObjectId);
    if (!Number.isInteger(objectId) || objectId < 0) {
      errors.push({
        row,
        field: "OBJECTID",
        code: "INVALID_SOURCE_ID",
        message: "A non-negative integer OBJECTID or feature id is required.",
      });
    } else if (ids.has(objectId)) {
      errors.push({
        row,
        field: "OBJECTID",
        code: "DUPLICATE_SOURCE_ID",
        message: `Duplicate station source id ${objectId}.`,
      });
    } else {
      ids.add(objectId);
    }

    const name = String(properties.name ?? "").trim();
    const stationType = String(
      properties.stationType ?? properties.station_type ?? "",
    ).trim();
    if (!name)
      errors.push({
        row,
        field: "name",
        code: "MISSING_NAME",
        message: "Station name is required.",
      });
    if (!stationType)
      errors.push({
        row,
        field: "stationType",
        code: "MISSING_STATION_TYPE",
        message: "Station type is required.",
      });

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const coordinateKey = `${lat.toFixed(7)},${lng.toFixed(7)}`;
      if (coordinates.has(coordinateKey)) {
        warnings.push({
          row,
          field: "coordinates",
          code: "DUPLICATE_COORDINATES",
          message: "Another station uses the same coordinates.",
        });
      }
      coordinates.add(coordinateKey);
    }

    if (errors.length === featureErrorsBefore) {
      records.push({
        objectId,
        name,
        direction: String(properties.direction ?? "").trim(),
        zones: String(properties.zones ?? "").trim(),
        description: String(properties.description ?? "").trim(),
        landmark: String(properties.landmark ?? "").trim(),
        stationType,
        lat,
        lng,
      });
    }
  });

  return {
    totalCount: features.length,
    validCount: records.length,
    invalidCount: features.length - records.length,
    records,
    errors,
    warnings,
  };
}
