import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { reconcileReferralUsage } from "@/lib/referral";

export async function POST(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const referralUsageId = String(body.referralUsageId ?? body.id ?? "").trim();
  if (!referralUsageId) {
    return NextResponse.json(
      { error: "referralUsageId is required." },
      { status: 400 },
    );
  }

  const result = await reconcileReferralUsage(referralUsageId);

  if (!result.success && result.status !== "credited") {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json(result);
}
