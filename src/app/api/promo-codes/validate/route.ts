import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { validateAndPreviewPromoCode } from "@/lib/promoCode";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const result = await validateAndPreviewPromoCode(code);
  return NextResponse.json(result);
}
