import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth/session";
import {
  getActiveVerificationMethod,
  isPlausibleSecurityAnswer,
  verifySecurityAnswer,
} from "@/lib/auth/securityQuestion";
import {
  isStrongPassword,
  PASSWORD_RULES_MESSAGE,
} from "@/lib/auth/validation";
import { connectDB } from "@/lib/db/mongoose";
import {
  isSafePassword,
  validateMutationRequest,
} from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { consumeSmsOtp } from "@/lib/auth/smsOtp";
import { User } from "@/models/User";

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const limited = await enforceRateLimit(req, "admin-password-change", {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (limited) return limited;

    if (!isSafePassword(body.newPassword) || !isStrongPassword(body.newPassword))
      return NextResponse.json(
        { error: PASSWORD_RULES_MESSAGE },
        { status: 400 },
      );
    if (body.newPassword !== body.confirmPassword)
      return NextResponse.json(
        { error: "New passwords do not match." },
        { status: 400 },
      );

    await connectDB();
    const method = await getActiveVerificationMethod();
    const admin = await User.findOne({ _id: session.userId, role: "admin" })
      .select("phone securityQuestionId +securityAnswerHash")
      .lean<{
        phone?: string;
        securityQuestionId?: string | null;
        securityAnswerHash?: string | null;
      }>();
    if (!admin)
      return NextResponse.json({ error: "Admin account not found." }, { status: 404 });

    if (method === "sms_otp") {
      if (!admin.phone)
        return NextResponse.json(
          { error: "Add a valid phone number to your profile first." },
          { status: 400 },
        );
      const validOtp = await consumeSmsOtp(
        {
          purpose: "password_change",
          userId: session.userId,
          phone: admin.phone,
          role: "admin",
        },
        body.otp,
      );
      if (!validOtp)
        return NextResponse.json(
          { error: "Invalid or expired verification code." },
          { status: 400 },
        );
    } else {
      if (!admin.securityQuestionId || !admin.securityAnswerHash)
        return NextResponse.json(
          {
            error:
              "Set a security question in your profile before changing your password.",
          },
          { status: 409 },
        );
      if (!isPlausibleSecurityAnswer(body.securityAnswer))
        return NextResponse.json(
          { error: "Enter the answer to your security question." },
          { status: 400 },
        );
      const validAnswer = await verifySecurityAnswer(
        body.securityAnswer,
        admin.securityAnswerHash,
      );
      if (!validAnswer)
        return NextResponse.json(
          { error: "The security answer is incorrect." },
          { status: 400 },
        );
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    await User.updateOne(
      { _id: session.userId, role: "admin" },
      { $set: { passwordHash } },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin password update error:", error);
    return NextResponse.json(
      { error: "Failed to change password." },
      { status: 500 },
    );
  }
}
