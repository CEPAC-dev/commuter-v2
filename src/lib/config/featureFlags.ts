export function isMultiDayRequestsEnabled(): boolean {
  return process.env.MULTI_DAY_REQUESTS_ENABLED === "true";
}

export function shouldCreateRequestGroup(
  enabled: boolean,
  dateCount: number,
): boolean {
  return enabled && dateCount > 1;
}
