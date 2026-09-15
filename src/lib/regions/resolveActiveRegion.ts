import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import {
  DEFAULT_REGION,
  getRegionBySlug,
  isRegionCode,
  normalizeRegion,
  REGION_CODES,
  REGIONS,
  type RegionCode,
  type RegionConfig,
} from "@/lib/config/regions";
import { User } from "@/models/User";

export class RegionAccessError extends Error {
  constructor(
    public readonly status: 400 | 403,
    message: string,
  ) {
    super(message);
  }
}

export interface ActiveRegion {
  code: RegionCode;
  config: RegionConfig;
  allowedRegionCodes: RegionCode[];
}

function requestedRegion(value: string | null | undefined): RegionCode | null {
  if (!value) return null;
  if (isRegionCode(value)) return value;
  return getRegionBySlug(value)?.code ?? null;
}

export async function resolveActiveRegion({
  userId,
  requested,
}: {
  userId: string;
  requested?: string | null;
}): Promise<ActiveRegion> {
  const requestedCode = requestedRegion(requested);
  if (requested && !requestedCode) {
    throw new RegionAccessError(400, "Invalid region.");
  }

  await connectDB();
  const user = await User.findById(userId)
    .select("role region defaultRegionCode allowedRegionCodes")
    .lean<{
      role?: string;
      region?: unknown;
      defaultRegionCode?: unknown;
      allowedRegionCodes?: unknown;
    }>();
  if (!user) throw new RegionAccessError(403, "Region access denied.");

  const configuredAllowed = Array.isArray(user.allowedRegionCodes)
    ? user.allowedRegionCodes.filter(isRegionCode)
    : [];
  // Initial rollout policy: admins without explicit assignments access all active regions.
  const allowedRegionCodes =
    user.role === "admin" && configuredAllowed.length === 0
      ? [...REGION_CODES]
      : configuredAllowed;
  const defaultRegionCode = isRegionCode(user.defaultRegionCode)
    ? user.defaultRegionCode
    : user.region
      ? normalizeRegion(user.region)
      : user.role === "admin" || user.role === "driver"
        ? DEFAULT_REGION
        : null;
  const activeCode = requestedCode ?? defaultRegionCode;
  const effectiveAllowedRegionCodes =
    user.role === "driver" && configuredAllowed.length === 0 && activeCode
      ? [activeCode]
      : allowedRegionCodes;

  if (!activeCode) {
    throw new RegionAccessError(403, "No default region configured.");
  }
  if (!effectiveAllowedRegionCodes.includes(activeCode)) {
    throw new RegionAccessError(403, "Region access denied.");
  }

  return {
    code: activeCode,
    config: REGIONS[activeCode],
    allowedRegionCodes: effectiveAllowedRegionCodes,
  };
}

export function legacyDefaultRegion(): RegionCode {
  return DEFAULT_REGION;
}
