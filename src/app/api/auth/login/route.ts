import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import { createSession } from "@/lib/auth/session";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { phone, password, role: rawRole } = await req.json();
    const role = rawRole === "driver" ? "driver" : "passenger";

    if (!phone?.trim() || !password)
      return NextResponse.json(
        { error: "Phone and password are required." },
        { status: 400 },
      );

    await connectDB();

    const identifier = phone.trim();
    const isEmail = identifier.includes("@");

    // First try exact match with phone/email AND specified role
    let user = await User.findOne(
      isEmail
        ? { email: identifier.toLowerCase(), role }
        : { phone: identifier, role }
    );

    // If not found with exact role, check if user exists under a different role to give helpful error
    if (!user) {
      const existingUserAnyRole = await User.findOne(
        isEmail
          ? { email: identifier.toLowerCase() }
          : { phone: identifier }
      );

      if (existingUserAnyRole) {
        const correctTab =
          existingUserAnyRole.role === "driver" ? "Driver" : "Passenger";
        return NextResponse.json(
          {
            error: `This account is registered as a ${correctTab}. Please select the ${correctTab} tab to log in.`,
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "Invalid phone or password." },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid)
      return NextResponse.json(
        { error: "Invalid phone or password." },
        { status: 401 }
      );

    await createSession({
      userId: String(user._id),
      email: user.email ?? "",
      role,
    });

    if (role !== "driver") return NextResponse.json({ ok: true, role });

    const driver = await Driver.findOne({ userId: user._id })
      .select("verificationStatus")
      .lean<{ verificationStatus?: string }>();
    return NextResponse.json({
      ok: true,
      role,
      verificationStatus: driver?.verificationStatus ?? "incomplete",
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 },
    );
  }
}
