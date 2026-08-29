import { NextRequest, NextResponse } from "next/server";
import { validateMutationRequest } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;
  const limited = await enforceRateLimit(req, "password-recovery", {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  return NextResponse.json(
    {
      error:
        "Password reset requires verified account recovery. Contact support until OTP recovery is available.",
    },
    { status: 503 },
  );
}
