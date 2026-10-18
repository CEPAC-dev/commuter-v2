const USER_ID_PATTERN = /^[a-f\d]{24}$/i;

export function isMultiDayRequestsEnabled(userId?: string): boolean {
  if (process.env.MULTI_DAY_REQUESTS_ENABLED !== "true") return false;

  const configuredIds = (process.env.MULTI_DAY_REQUESTS_ALLOWED_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (configuredIds.length === 0) return true;
  if (!userId || !USER_ID_PATTERN.test(userId)) return false;

  const allowedIds = new Set(
    configuredIds
      .filter((id) => USER_ID_PATTERN.test(id))
      .map((id) => id.toLowerCase()),
  );
  return allowedIds.has(userId.toLowerCase());
}

export function shouldCreateRequestGroup(
  enabled: boolean,
  dateCount: number,
): boolean {
  return enabled && dateCount > 1;
}
