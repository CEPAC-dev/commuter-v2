import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { reconcileReferralUsage } from "@/lib/referral";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ referralUsageId: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const { referralUsageId } = await params;
  const result = await reconcileReferralUsage(referralUsageId);

  if (!result.success && result.status !== "credited") {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json(result);
}
