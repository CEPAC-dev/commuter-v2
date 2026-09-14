import { REGION_CODES } from "@/lib/config/regions";
import { normalizePlainText } from "@/lib/security/request";

const numericFields = ["rate", "additional_rate", "buffer", "window", "capacity", "occupancy", "min_occupancy", "minimum_charge", "vehicle_type", "trip_type", "sortOrder"] as const;
const integers = new Set(["capacity", "occupancy", "min_occupancy", "vehicle_type", "trip_type", "sortOrder"]);

function cleanRegionConfig(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Invalid region configuration." };
  const value = input as Record<string, unknown>;
  if (typeof value.regionCode !== "string" || !REGION_CODES.includes(value.regionCode as (typeof REGION_CODES)[number])) return { error: "Invalid region." };
  const config: Record<string, string | number> = { regionCode: value.regionCode };
  for (const field of numericFields) {
    const number = Number(value[field]);
    if (!Number.isFinite(number) || number < 0) return { error: `Invalid ${field} for ${value.regionCode}.` };
    config[field] = integers.has(field) ? Math.round(number) : number;
  }
  if (Number(config.occupancy) > Number(config.capacity)) return { error: `Occupancy cannot exceed capacity for ${value.regionCode}.` };
  return { config };
}

export function cleanVehicle(input: Record<string, unknown>, partial = false) {
  const update: Record<string, unknown> = {};
  if (!partial) {
    const key = typeof input.key === "string" ? input.key.trim().toLowerCase() : "";
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(key)) return { error: "Key must use lowercase letters, numbers, and underscores." };
    update.key = key;
  }
  if (input.label !== undefined) {
    const label = normalizePlainText(input.label, { maxLength: 80 });
    if (!label) return { error: "Invalid label." };
    update.label = label;
  }
  if (input.ride !== undefined) {
    if (input.ride !== "private" && input.ride !== "shared") return { error: "Invalid ride type." };
    update.ride = input.ride;
  }
  if (input.active !== undefined) {
    if (typeof input.active !== "boolean") return { error: "Invalid active flag." };
    update.active = input.active;
  }
  if (input.regionConfigs !== undefined) {
    if (!Array.isArray(input.regionConfigs)) return { error: "Invalid regional configurations." };
    const parsed: Array<{ config?: Record<string, string | number>; error?: string }> = input.regionConfigs.map(cleanRegionConfig);
    const failed = parsed.find((result) => "error" in result);
    if (failed?.error) return { error: failed.error };
    const configs = parsed.map((result) => result.config as Record<string, string | number>);
    if (new Set(configs.map((config) => config.regionCode)).size !== configs.length) return { error: "Each region can be configured once." };
    update.regionConfigs = configs;
    update.regionCodes = configs.map((config) => config.regionCode);
    if (configs[0]) Object.assign(update, configs[0]);
  }
  if (!partial && !["key", "label", "ride", "regionConfigs"].every((field) => update[field] !== undefined)) return { error: "Add at least one complete regional configuration." };
  return { update };
}
