import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { nextSequence } from "@/models/Counter";
import { Driver } from "@/models/Driver";
import { createSession } from "@/lib/auth/session";
import { applyReferralOnSignup, generateReferralCode } from "@/lib/referral";
import {
  isStrongPassword,
  normalizeEgyptPhone,
  PASSWORD_RULES_MESSAGE,
  PHONE_RULES_MESSAGE,
} from "@/lib/auth/validation";
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
    const { name, phone, password, email, gender, referralCodeUsed } = await req.json();
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
    if (gender !== "male" && gender !== "female")
      return NextResponse.json(
        { error: "Gender is required." },
        { status: 400 },
      );

    console.log(
      "Phase 1: Input validation passed. Proceeding to database operations.",
    );

    await connectDB();

    console.log("Phase 2: Database connection established.");

    const existing = await User.findOne({
      phone: normalizedPhone,
      role: "driver",
    }).lean();
    if (existing)
      return NextResponse.json(
        { error: "A driver account with this phone number already exists." },
        { status: 409 },
      );

    console.log(
      "Phase 3: No existing driver account found with the provided phone number. Proceeding to check email if provided.",
    );

    if (normalizedEmail) {
      const existingEmail = await User.findOne({
        email: normalizedEmail,
        role: "driver",
      }).lean();
      if (existingEmail)
        return NextResponse.json(
          { error: "A driver account with this email already exists." },
          { status: 409 },
        );
    }

    console.log("Phase 4: Email check passed. Proceeding to create user.");

    const passwordHash = await bcrypt.hash(password, 12);
    const userNumber = await nextSequence("userNumber");
    const referralCode = await generateReferralCode();

    console.log("Phase 5: Password hashed. Proceeding to create user.");

    const user = await User.create({
      userNumber,
      name: safeName,
      phone: normalizedPhone,
      passwordHash,
      email: normalizedEmail,
      role: "driver",
      referralCode,
    });

    await Driver.create({
      userId: user._id,
      gender,
      verificationStatus: "incomplete",
    });

    let referralWarning: string | undefined;
    const safeReferralCode = normalizePlainText(referralCodeUsed, {
      maxLength: 32,
      allowEmpty: true,
    });
    if (safeReferralCode) {
      const referralResult = await applyReferralOnSignup(
        safeReferralCode.toUpperCase(),
        user._id,
      );
      if (!referralResult.success) referralWarning = referralResult.message;
    }

    console.log("Phase 2: Driver data created successfully.");

    await createSession({
      userId: String(user._id),
      email: user.email ?? "",
      role: "driver",
    });
    console.log("Phase 3: Session created successfully.");
    return NextResponse.json(
      {
        ok: true,
        role: "driver",
        verificationStatus: "incomplete",
        ...(referralWarning ? { referralWarning } : {}),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Driver registration failed:", err);
    return NextResponse.json(
      { error: "Driver registration failed. Please try again." },
      { status: 500 },
    );
  }
}
