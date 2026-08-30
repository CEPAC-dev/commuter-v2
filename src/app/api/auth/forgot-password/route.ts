import { NextRequest, NextResponse } from "next/server";
import { validateMutationRequest } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { isStrongPassword, PASSWORD_RULES_MESSAGE } from "@/lib/auth/validation";

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;
  const limited = await enforceRateLimit(req, "password-recovery", {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  try {
    const { phone, role, newPassword, confirmPassword } = await req.json();

    if (!phone || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: "Phone and password fields are required." }, { status: 400 });
    }

    if (!isStrongPassword(newPassword)) {
      return NextResponse.json({ error: PASSWORD_RULES_MESSAGE }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    if (role !== "passenger" && role !== "driver") {
      return NextResponse.json({ error: "Invalid account role." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  return NextResponse.json(
    {
      error:
        "Password reset requires verified account recovery. Contact support until OTP recovery is available.",
    },
    { status: 503 },
  );
}
