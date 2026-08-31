import { NextRequest, NextResponse } from "next/server";

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateMutationRequest(
  req: NextRequest,
  options: { requireJson?: boolean; maxBytes?: number } = {},
): NextResponse | null {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  const maxBytes = options.maxBytes ?? 16_384;
  if (
    !Number.isFinite(contentLength) ||
    contentLength < 0 ||
    contentLength > maxBytes
  ) {
    return NextResponse.json(
      { error: "Request body is too large." },
      { status: 413 },
    );
  }

  const requestOrigin = new URL(req.url).origin;
  const configuredOrigins = getConfiguredOrigins();
  const allowedOrigins = new Set([requestOrigin, ...configuredOrigins]);
  const origin = req.headers.get("origin");

  if (origin) {
    if (!allowedOrigins.has(origin) && !isLocalDevelopmentOrigin(origin)) {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    }
  } else if (!isLocalDevelopmentOrigin(requestOrigin)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }

  if (
    options.requireJson !== false &&
    !req.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    return NextResponse.json(
      { error: "Content-Type must be application/json." },
      { status: 415 },
    );
  }

  return null;
}

function getConfiguredOrigins(): string[] {
  const raw = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_API_URL,
  ].filter((value): value is string => Boolean(value));

  const origins = new Set<string>();
  for (const value of raw) {
    try {
      origins.add(new URL(value).origin);
    } catch {
      // Ignore invalid env values; the request will still be checked against the request origin.
    }
  }

  return [...origins];
}

function isLocalDevelopmentOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

export function normalizePlainText(
  value: unknown,
  options: { maxLength: number; allowEmpty?: boolean },
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim();
  if (
    (!normalized && !options.allowEmpty) ||
    normalized.length > options.maxLength
  )
    return null;
  if (CONTROL_CHARACTERS.test(normalized) || /[<>]/.test(normalized))
    return null;
  return normalized;
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.normalize("NFKC").trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function isSafePassword(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 128 &&
    !CONTROL_CHARACTERS.test(value)
  );
}

export function isPasswordInput(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    !CONTROL_CHARACTERS.test(value)
  );
}

export function isPositiveEgpAmount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}
