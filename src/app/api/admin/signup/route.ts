import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { nextSequence } from "@/models/Counter";
import { createSession } from "@/lib/auth/session";
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
    const { name, email, phone, password, inviteCode } = await req.json();
    const safeName = normalizePlainText(name, { maxLength: 100 });

    if (!safeName || typeof phone !== "string" || !phone.trim() || !password) {
      return NextResponse.json(
        { error: "Name, phone and password are required." },
        { status: 400 },
      );
    }

    if (!isSafePassword(password) || !isStrongPassword(password)) {
      return NextResponse.json(
        { error: PASSWORD_RULES_MESSAGE },
        { status: 400 },
      );
    }

    const normalizedPhone = normalizeEgyptPhone(phone);
    if (!normalizedPhone) {
      return NextResponse.json({ error: PHONE_RULES_MESSAGE }, { status: 400 });
    }

    if (email !== undefined && typeof email !== "string") {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 },
      );
    }
    const normalizedEmail = email?.trim() ? normalizeEmail(email) : undefined;
    if (email?.trim() && !normalizedEmail) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 },
      );
    }

    if (!process.env.ADMIN_INVITE_CODE) {
      return NextResponse.json(
        { error: "Admin signup is not enabled." },
        { status: 500 },
      );
    }

    if (inviteCode !== process.env.ADMIN_INVITE_CODE) {
      return NextResponse.json(
        { error: "Invalid admin invite code." },
        { status: 403 },
      );
    }

    await connectDB();

    const existing = await User.findOne({ phone: normalizedPhone, role: "admin" }).lean();
    if (existing) {
      return NextResponse.json(
        { error: "An admin account with this phone number already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userNumber = await nextSequence("userNumber");
    const user = await User.create({
      userNumber,
      name: safeName,
      phone: normalizedPhone,
      passwordHash,
      email: normalizedEmail,
      role: "admin",
    });

    await createSession({
      userId: String(user._id),
      email: user.email ?? "",
      role: "admin",
    });

    return NextResponse.json({ ok: true, role: "admin" }, { status: 201 });
  } catch (error) {
    console.error("Admin signup error:", error);
    return NextResponse.json(
      { error: "Admin signup failed. Please try again." },
      { status: 500 },
    );
  }
}
