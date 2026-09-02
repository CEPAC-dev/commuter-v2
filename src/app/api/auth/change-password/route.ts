import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { getSession } from "@/lib/auth/session";
import { validateMutationRequest } from "@/lib/security/request";
import {
  PASSWORD_RULES_MESSAGE,
  isStrongPassword,
} from "@/lib/auth/validation";
import { consumeSmsOtp } from "@/lib/auth/smsOtp";
import {
  getActiveVerificationMethod,
  isPlausibleSecurityAnswer,
  verifySecurityAnswer,
} from "@/lib/auth/securityQuestion";

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { newPassword, confirmPassword, otp, securityAnswer } =
      await req.json();

    if (typeof newPassword !== "string" || typeof confirmPassword !== "string")
      return NextResponse.json(
        { error: PASSWORD_RULES_MESSAGE },
        { status: 400 },
      );

    if (!isStrongPassword(newPassword))
      return NextResponse.json(
        { error: PASSWORD_RULES_MESSAGE },
        { status: 400 },
      );

    if (newPassword !== confirmPassword)
      return NextResponse.json(
        { error: "New passwords do not match." },
        { status: 400 },
      );

    await connectDB();
    const user = await User.findById(session.userId).select(
      "+passwordHash +securityAnswerHash phone role securityQuestionId",
    );
    if (!user)
      return NextResponse.json({ error: "User not found." }, { status: 404 });

    const method = await getActiveVerificationMethod();
    if (method === "security_question") {
      if (!user.securityAnswerHash || !user.securityQuestionId) {
        return NextResponse.json(
          {
            error:
              "Set a security question in your profile before changing your password.",
          },
          { status: 409 },
        );
      }
      if (!isPlausibleSecurityAnswer(securityAnswer)) {
        return NextResponse.json(
          { error: "Enter the answer to your security question." },
          { status: 400 },
        );
      }
      const ok = await verifySecurityAnswer(
        securityAnswer,
        user.securityAnswerHash,
      );
      if (!ok) {
        return NextResponse.json(
          { error: "The security answer is incorrect." },
          { status: 400 },
        );
      }
    } else {
      const validOtp = await consumeSmsOtp(
        {
          purpose: "password_change",
          userId: session.userId,
          phone: user.phone,
          role: user.role === "driver" ? "driver" : "passenger",
        },
        otp,
      );
      if (!validOtp)
        return NextResponse.json(
          { error: "Invalid or expired verification code." },
          { status: 400 },
        );
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to change password." },
      { status: 500 },
    );
  }
}
