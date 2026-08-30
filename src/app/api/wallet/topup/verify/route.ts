import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { verifyAndSettleTopup } from "@/lib/payments/kashier";
import { validateMutationRequest } from "@/lib/security/request";
import { Types } from "mongoose";

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let topupId: string;
  try {
    ({ topupId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (typeof topupId !== "string" || !Types.ObjectId.isValid(topupId))
    return NextResponse.json({ error: "Invalid topupId" }, { status: 400 });

  const status = await verifyAndSettleTopup(topupId, session.userId);
  return NextResponse.json({ status });
}
