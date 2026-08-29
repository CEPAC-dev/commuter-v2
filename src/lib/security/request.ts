import { NextRequest, NextResponse } from "next/server";

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateMutationRequest(
  req: NextRequest,
  options: { requireJson?: boolean; maxBytes?: number } = {},
): NextResponse | null {
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  const maxBytes = options.maxBytes ?? 16_384;
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > maxBytes) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  const origin = req.headers.get("origin");
  const configuredOrigin = getConfiguredOrigin();
  const requestOrigin = new URL(req.url).origin;
  const allowedOrigins = new Set([configuredOrigin, requestOrigin].filter(Boolean));

  if (!origin || !allowedOrigins.has(origin)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  if (
    options.requireJson !== false &&
    !req.headers.get("content-type")?.toLowerCase().startsWith("application/json")
  ) {
    return NextResponse.json(
      { error: "Content-Type must be application/json." },
      { status: 415 },
    );
  }

  return null;
}

function getConfiguredOrigin(): string | null {
  const appUrl = process.env.APP_URL;
  if (!appUrl) return null;
  try {
    return new URL(appUrl).origin;
  } catch {
    return null;
  }
}

export function normalizePlainText(
  value: unknown,
  options: { maxLength: number; allowEmpty?: boolean },
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim();
  if ((!normalized && !options.allowEmpty) || normalized.length > options.maxLength)
    return null;
  if (CONTROL_CHARACTERS.test(normalized) || /[<>]/.test(normalized)) return null;
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