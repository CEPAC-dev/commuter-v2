import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { getSession } from "@/lib/auth/session";
import {
  getActiveVerificationMethod,
  hashSecurityAnswer,
  isPlausibleSecurityAnswer,
} from "@/lib/auth/securityQuestion";
import { isValidSecurityQuestionId } from "@/lib/config/verification";
import { User } from "@/models/User";
import { validateMutationRequest } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit(req, "security-question-setup", {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  try {
    const { securityQuestionId, securityAnswer } = await req.json();
    if (!isValidSecurityQuestionId(securityQuestionId)) {
      return NextResponse.json(
        { error: "Choose a valid security question." },
        { status: 400 },
      );
    }
    if (!isPlausibleSecurityAnswer(securityAnswer)) {
      return NextResponse.json(
        { error: "Enter a security answer between 2 and 120 characters." },
        { status: 400 },
      );
    }

    await connectDB();
    if ((await getActiveVerificationMethod()) !== "security_question") {
      return NextResponse.json(
        { error: "Security-question verification is not enabled." },
        { status: 409 },
      );
    }

    const securityAnswerHash = await hashSecurityAnswer(securityAnswer);
    const result = await User.updateOne(
      {
        _id: session.userId,
        $or: [
          { securityQuestionId: null },
          { securityQuestionId: { $exists: false } },
          { securityAnswerHash: null },
          { securityAnswerHash: { $exists: false } },
        ],
      },
      { $set: { securityQuestionId, securityAnswerHash } },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "A security question is already set for this account." },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not save security question." },
      { status: 500 },
    );
  }
}
