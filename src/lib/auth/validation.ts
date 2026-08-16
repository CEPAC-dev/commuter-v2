// Egyptian mobile numbers: 10 national digits starting with 1 (leading 0 dropped).
export const PHONE_NATIONAL_LENGTH = 10;

/** Strips +20/20 and any leading zero, keeping at most 10 digits. Used while typing. */
export function toNationalDigits(input: string): string {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (digits.startsWith("20")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  return digits.slice(0, PHONE_NATIONAL_LENGTH);
}

/** Returns the stored E.164 phone (+20XXXXXXXXXX) or null when invalid. */
export function normalizeEgyptPhone(input: string): string | null {
  const digits = toNationalDigits(input);
  if (digits.length !== PHONE_NATIONAL_LENGTH || !digits.startsWith("1"))
    return null;
  return `+20${digits}`;
}

export function isStrongPassword(password: string): boolean {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export const PASSWORD_RULES_MESSAGE =
  "Password must be at least 8 characters and include uppercase, lowercase, a number and a symbol.";

export const PHONE_RULES_MESSAGE =
  "Enter a valid 10-digit Egyptian mobile number (e.g. 1000000000).";
