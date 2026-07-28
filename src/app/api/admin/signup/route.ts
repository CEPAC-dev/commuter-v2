import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { nextSequence } from "@/models/Counter";
import { createSession } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password, inviteCode } = await req.json();

    if (!name?.trim() || !phone?.trim() || !password) {
      return NextResponse.json(
        { error: "Name, phone and password are required." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
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

    const existing = await User.findOne({ phone: phone.trim(), role: "admin" }).lean();
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
      name: name.trim(),
      phone: phone.trim(),
      passwordHash,
      email: email?.trim() ? email.toLowerCase().trim() : undefined,
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
