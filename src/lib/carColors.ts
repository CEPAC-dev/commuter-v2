export const CAR_COLOR_OPTIONS = [
  { value: "أبيض", labelAr: "أبيض", labelEn: "White", fullEn: "White" },
  { value: "أسود", labelAr: "أسود", labelEn: "Black", fullEn: "Black" },
  { value: "رمادي", labelAr: "رمادي", labelEn: "Gray", fullEn: "Gray" },
  {
    value: "رمادي/فيراني",
    labelAr: "فيراني",
    labelEn: "Gunmetal",
    fullEn: "Gray/Gunmetal",
  },
  { value: "فضي", labelAr: "فضي", labelEn: "Silver", fullEn: "Silver" },
  { value: "أزرق", labelAr: "أزرق", labelEn: "Blue", fullEn: "Blue" },
  {
    value: "أزرق/سماوي",
    labelAr: "سماوي",
    labelEn: "Sky Blue",
    fullEn: "Blue/Sky Blue",
  },
  {
    value: "أزرق/كحلي",
    labelAr: "كحلي",
    labelEn: "Navy",
    fullEn: "Blue/Navy",
  },
  { value: "أحمر", labelAr: "أحمر", labelEn: "Red", fullEn: "Red" },
  {
    value: "أحمر/نبيتي",
    labelAr: "نبيتي",
    labelEn: "Burgundy",
    fullEn: "Red/Burgundy",
  },
  { value: "بيج", labelAr: "بيج", labelEn: "Beige", fullEn: "Beige" },
  {
    value: "بيج/كافيه",
    labelAr: "كافيه",
    labelEn: "Mocha",
    fullEn: "Beige/Mocha",
  },
  { value: "بني", labelAr: "بني", labelEn: "Brown", fullEn: "Brown" },
  {
    value: "بني غامق",
    labelAr: "بني غامق",
    labelEn: "Dark Brown",
    fullEn: "Dark Brown",
  },
  { value: "ذهبي", labelAr: "ذهبي", labelEn: "Gold", fullEn: "Gold" },
  {
    value: "ذهبي فاتح",
    labelAr: "ذهبي فاتح",
    labelEn: "Light Gold",
    fullEn: "Light Gold",
  },
  { value: "أصفر", labelAr: "أصفر", labelEn: "Yellow", fullEn: "Yellow" },
  { value: "أخضر", labelAr: "أخضر", labelEn: "Green", fullEn: "Green" },
  {
    value: "أخضر/زيتي",
    labelAr: "زيتي",
    labelEn: "Olive",
    fullEn: "Green/Olive",
  },
  {
    value: "أخضر فاتح",
    labelAr: "أخضر فاتح",
    labelEn: "Light Green",
    fullEn: "Light Green",
  },
  { value: "برتقالي", labelAr: "برتقالي", labelEn: "Orange", fullEn: "Orange" },
  {
    value: "برتقالي/نحاسي",
    labelAr: "نحاسي",
    labelEn: "Copper",
    fullEn: "Orange/Copper",
  },
  { value: "بنفسجي", labelAr: "بنفسجي", labelEn: "Purple", fullEn: "Purple" },
  { value: "أخرى", labelAr: "أخرى", labelEn: "Other", fullEn: "Other" },
] as const;

export type CarColorLanguage = "ar" | "en";
export type CarColorOption = (typeof CAR_COLOR_OPTIONS)[number];

export const MAX_CAR_COLOR_LENGTH = 40;

const knownCarColors = new Set<string>(
  CAR_COLOR_OPTIONS.map((option) => option.value),
);
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

export function isKnownCarColor(
  value: unknown,
): value is CarColorOption["value"] {
  return typeof value === "string" && knownCarColors.has(value);
}

export function getCarColorOptionLabel(
  option: CarColorOption,
  lang: CarColorLanguage,
): string {
  return lang === "en" ? option.labelEn : option.labelAr;
}

export function getCarColorDisplay(
  storedValue: string | null | undefined,
  lang: CarColorLanguage,
): string {
  if (typeof storedValue !== "string") return "";
  if (lang !== "en") return storedValue;
  return (
    CAR_COLOR_OPTIONS.find((option) => option.value === storedValue)?.fullEn ??
    storedValue
  );
}

export function normalizeCarColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim();
  if (
    !normalized ||
    normalized.length > MAX_CAR_COLOR_LENGTH ||
    CONTROL_CHARACTERS.test(normalized) ||
    /[<>]/.test(normalized)
  )
    return null;
  return normalized;
}
