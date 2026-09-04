import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { normalizeEgyptPhone } from "@/lib/auth/validation";
import { validateMutationRequest } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getActiveVerificationMethod } from "@/lib/auth/securityQuestion";
import { getSecurityQuestion } from "@/lib/config/verification";

// Look up the security question for the account matching (phone, role). Used
// by the forgot-password page so the user is prompted with THEIR question.
// Kept minimal to avoid user enumeration side channels; rate-limited hard.
export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;
  const limited = await enforceRateLimit(req, "security-question-lookup", {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  try {
    const { phone, role } = await req.json();
    if (role !== "passenger" && role !== "driver") {
      return NextResponse.json(
        { error: "Invalid account role." },
        { status: 400 },
      );
    }
    const method = await getActiveVerificationMethod();
    if (method !== "security_question") {
      return NextResponse.json(
        { error: "Security-question verification is not enabled." },
        { status: 400 },
      );
    }
    const normalizedPhone = normalizeEgyptPhone(phone);
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: "Enter a valid Egyptian mobile number." },
        { status: 400 },
      );
    }
    await connectDB();
    const user = await User.findOne({ phone: normalizedPhone, role })
      .select("securityQuestionId")
      .lean<{ securityQuestionId?: string | null }>();
    if (!user) {
      return NextResponse.json(
        { error: "No account found with this phone number." },
        { status: 404 },
      );
    }
    const q = user.securityQuestionId
      ? getSecurityQuestion(user.securityQuestionId)
      : null;
    if (!q) {
      return NextResponse.json(
        {
          error: "This account has no security question set. Contact support.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ questionId: q.id, question: q.question, questionAr: q.questionAr });
  } catch {
    return NextResponse.json(
      { error: "Could not look up the security question." },
      { status: 500 },
    );
  }
}
