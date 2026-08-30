import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { nextSequence } from "@/models/Counter";
import { createSession } from "@/lib/auth/session";
import { applyReferralOnSignup, generateReferralCode } from "@/lib/referral";
import {
  isStrongPassword,
  normalizeEgyptPhone,
  PASSWORD_RULES_MESSAGE,
  PHONE_RULES_MESSAGE,
} from "@/lib/auth/validation";
import bcrypt from "bcryptjs";
import {
  isSafePassword,
  normalizeEmail,
  normalizePlainText,
  validateMutationRequest,
} from "@/lib/security/request";

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;
  try {
    const { name, email, password, phone, referralCodeUsed } = await req.json();
    const safeName = normalizePlainText(name, { maxLength: 100 });

    if (!safeName || typeof phone !== "string" || !phone.trim() || !password)
      return NextResponse.json(
        { error: "Name, phone and password are required." },
        { status: 400 },
      );
    if (!isSafePassword(password))
      return NextResponse.json(
        { error: PASSWORD_RULES_MESSAGE },
        { status: 400 },
      );
    if (!isStrongPassword(password))
      return NextResponse.json(
        { error: PASSWORD_RULES_MESSAGE },
        { status: 400 },
      );
    const normalizedPhone = normalizeEgyptPhone(phone);
    if (!normalizedPhone)
      return NextResponse.json({ error: PHONE_RULES_MESSAGE }, { status: 400 });
    if (email !== undefined && typeof email !== "string")
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 },
      );
    const normalizedEmail = email?.trim() ? normalizeEmail(email) : undefined;
    if (email?.trim() && !normalizedEmail)
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 },
      );

    await connectDB();

    const existing = await User.findOne({
      phone: normalizedPhone,
      role: "passenger",
    }).lean();
    if (existing)
      return NextResponse.json(
        { error: "An account with this phone number already exists." },
        { status: 409 },
      );

    if (normalizedEmail) {
      const existingEmail = await User.findOne({
        email: normalizedEmail,
        role: "passenger",
      }).lean();
      if (existingEmail)
        return NextResponse.json(
          { error: "An account with this email already exists." },
          { status: 409 },
        );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userNumber = await nextSequence("userNumber");
    const referralCode = await generateReferralCode();
    const user = await User.create({
      userNumber,
      name: safeName,
      phone: normalizedPhone,
      passwordHash,
      email: normalizedEmail,
      role: "passenger",
      referralCode,
    });

    let referralWarning: string | undefined;
    const safeReferralCode = normalizePlainText(referralCodeUsed, {
      maxLength: 32,
      allowEmpty: true,
    });
    if (safeReferralCode) {
      try {
        const referralResult = await applyReferralOnSignup(
          safeReferralCode.toUpperCase(),
          user._id,
        );
        if (!referralResult.success) referralWarning = referralResult.message;
      } catch (referralError) {
        console.error("Referral application failed:", referralError);
        referralWarning =
          "Your account was created, but the referral could not be applied.";
      }
    }

    await createSession({
      userId: String(user._id),
      email: user.email ?? "",
      role: "passenger",
    });
    return NextResponse.json(
      {
        ok: true,
        ...(referralWarning ? { referralWarning } : {}),
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 },
    );
  }
}
