import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { createSession } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const { phone, password } = await req.json();

    if (!phone?.trim() || !password) {
      return NextResponse.json(
        { error: "Phone and password are required." },
        { status: 400 },
      );
    }

    await connectDB();

    const user = await User.findOne({ phone: phone.trim(), role: "admin" })
      .select("passwordHash email name")
      .lean<{ _id?: unknown; passwordHash?: string; email?: string; name?: string }>();

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: "Invalid phone or password." },
        { status: 401 },
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid phone or password." },
        { status: 401 },
      );
    }

    await createSession({
      userId: String(user._id),
      email: user.email ?? "",
      role: "admin",
    });

    return NextResponse.json({ ok: true, role: "admin" });
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { error: "Admin login failed. Please try again." },
      { status: 500 },
    );
  }
}
