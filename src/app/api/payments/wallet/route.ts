import { NextRequest, NextResponse } from "next/server";

/**
 * DEPRECATED — mixed payments now go through /api/payments/session with
 * `useWallet: true`. Wallet-fully-covers path returns `{ walletOnly: true }`
 * from that endpoint. This shim is kept only for older clients still on the
 * previous flow.
 */
export async function POST(req: NextRequest) {
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
    },
    body: JSON.stringify({ ...parsed, useWallet: true }),
  });
  const data = await proxied.json().catch(() => ({}));
  return NextResponse.json(data, { status: proxied.status });
}
