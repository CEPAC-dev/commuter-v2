import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getReferralDiscountAvailability } from "@/lib/referral";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const availability = await getReferralDiscountAvailability(session.userId);
  return NextResponse.json({ data: availability });
}