import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { validateMutationRequest } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import {
  isStrongPassword,
  normalizeEgyptPhone,
  PASSWORD_RULES_MESSAGE,
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
  const limited = await enforceRateLimit(req, "password-recovery", {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  try {
    const { phone, role, newPassword, confirmPassword, otp, securityAnswer } =
      await req.json();

    if (!phone || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Phone and password fields are required." },
        { status: 400 },
      );
    }

    if (role !== "passenger" && role !== "driver") {
      return NextResponse.json(
        { error: "Invalid account role." },
        { status: 400 },
      );
    }

    const normalizedPhone = normalizeEgyptPhone(phone) ?? phone.trim();
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: "Invalid phone number." },
        { status: 400 },
      );
    }

    if (!isStrongPassword(newPassword)) {
      return NextResponse.json(
        { error: PASSWORD_RULES_MESSAGE },
        { status: 400 },
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 },
      );
    }

    await connectDB();

    const user = await User.findOne({ phone: normalizedPhone, role }).select(
      "+passwordHash +securityAnswerHash",
    );
    if (!user) {
      return NextResponse.json(
        { error: "No account found with this phone number." },
        { status: 404 },
      );
    }

    const method = await getActiveVerificationMethod();
    if (method === "security_question") {
      if (!user.securityAnswerHash || !user.securityQuestionId) {
        return NextResponse.json(
          {
            error:
              "This account has no security question set. Contact support.",
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
          purpose: "password_reset",
          userId: String(user._id),
          phone: normalizedPhone,
          role,
        },
        otp,
      );
      if (!validOtp) {
        return NextResponse.json(
          { error: "Invalid or expired verification code." },
          { status: 400 },
        );
      }
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    return NextResponse.json({
      ok: true,
      message: "Password updated successfully.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json(
      { error: "Failed to reset password. Please try again." },
      { status: 500 },
    );
  }
}
