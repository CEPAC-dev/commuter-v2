import { NextRequest, NextResponse } from "next/server";
import { validateMutationRequest } from "@/lib/security/request";

/**
 * DEPRECATED — mixed payments now go through /api/payments/session with
 * `useWallet: true`. Wallet-fully-covers path returns `{ walletOnly: true }`
 * from that endpoint. This shim is kept only for older clients still on the
 * previous flow.
 */
export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

  const forwarded = new URL("/api/payments/session", req.url);
  const body = await req.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch {}
  const proxied = await fetch(forwarded, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: req.headers.get("cookie") ?? "",
      origin: req.headers.get("origin") ?? new URL(req.url).origin,
    },
    body: JSON.stringify({ ...parsed, useWallet: true }),
  });
  const data = await proxied.json().catch(() => ({}));
  return NextResponse.json(data, { status: proxied.status });
}
