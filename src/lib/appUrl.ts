export function parseAppUrls(value: string | undefined): string[] {
  if (!value) return [];

  const urls = value
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set(urls)].slice(0, 2);
}

export function getPrimaryAppUrl(
  value: string | undefined,
  fallback = "http://localhost:3000",
): string {
  return parseAppUrls(value)[0] ?? fallback;
}
