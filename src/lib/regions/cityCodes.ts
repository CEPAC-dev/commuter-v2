import type { RegionCode } from "@/lib/config/regions";

export function getOperatingCityCounterId(regionCode: RegionCode) {
  return `operating-city-code:${regionCode}`;
}

export function getOperatingCitySequence(
  cityCode: string,
  regionCode: RegionCode,
) {
  const match = new RegExp(`^${regionCode}-(\\d+)$`, "i").exec(cityCode);
  if (!match) return 0;
  const sequence = Number(match[1]);
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : 0;
}

export function formatOperatingCityCode(
  regionCode: RegionCode,
  sequence: number,
) {
  return `${regionCode}-${sequence}`;
}

export function getNextOperatingCityCode(
  regionCode: RegionCode,
  cityCodes: string[],
  counterValue = 0,
) {
  const highestCitySequence = cityCodes.reduce(
    (highest, cityCode) =>
      Math.max(highest, getOperatingCitySequence(cityCode, regionCode)),
    0,
  );
  const highestCounterValue =
    Number.isSafeInteger(counterValue) && counterValue > 0 ? counterValue : 0;
  return formatOperatingCityCode(
    regionCode,
    Math.max(highestCitySequence, highestCounterValue) + 1,
  );
}
