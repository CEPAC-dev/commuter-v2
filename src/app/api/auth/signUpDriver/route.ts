import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { nextSequence } from "@/models/Counter";
import { Driver } from "@/models/Driver";
import { createSession } from "@/lib/auth/session";
import { generateReferralCode } from "@/lib/referral";
import {
  isStrongPassword,
  normalizeEgyptPhone,
  PASSWORD_RULES_MESSAGE,
  PHONE_RULES_MESSAGE,
} from "@/lib/auth/validation";

export async function POST(req: NextRequest) {
  try {
    const { name, phone, password, email, gender } = await req.json();

    if (!name?.trim() || !phone?.trim() || !password)
      return NextResponse.json(
        { error: "Name, phone and password are required." },
        { status: 400 },
      );
    if (password.length < 8)
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
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
    if (email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
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

    if (email?.trim()) {
      const existingEmail = await User.findOne({
        email: email.toLowerCase().trim(),
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

    console.log("Driver registration data:", {
      name: name.trim(),
      phone: normalizedPhone,
      PasswordHash: passwordHash,
      email: email?.trim() ? email.toLowerCase().trim() : undefined,
      gender,
    });

    const user = await User.create({
      userNumber,
      name: name.trim(),
      phone: normalizedPhone,
      passwordHash,
      email: email?.trim() ? email.toLowerCase().trim() : undefined,
      role: "driver",
      referralCode,
    });

    console.log("Driver user created:", user);
    console.log("Driver data:", {
      userId: user._id,
      gender,
      verificationStatus: "incomplete",
    });

    await Driver.create({
      userId: user._id,
      gender,
      verificationStatus: "incomplete",
    });

    console.log("Phase 2: Driver data created successfully.");

    await createSession({
      userId: String(user._id),
      email: user.email ?? "",
      role: "driver",
    });
    console.log("Phase 3: Session created successfully.");
    return NextResponse.json(
      { ok: true, role: "driver", verificationStatus: "incomplete" },
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
