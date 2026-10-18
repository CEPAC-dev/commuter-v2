export function resolveLiveTileUrl(
  candidate: unknown,
  fallback: string,
): string {
  if (typeof candidate !== "string") return fallback;
  const value = candidate.trim();
  if (!value || !["{z}", "{x}", "{y}"].every((part) => value.includes(part))) {
    return fallback;
  }
  try {
    return new URL(value).protocol === "https:" ? value : fallback;
  } catch {
    return fallback;
  }
}
