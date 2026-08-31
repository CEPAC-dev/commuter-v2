import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import { createSession } from "@/lib/auth/session";
import { normalizeEgyptPhone } from "@/lib/auth/validation";
import {
  isPasswordInput,
  normalizeEmail,
  validateMutationRequest,
} from "@/lib/security/request";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;
  try {
    const { phone, password, role: rawRole } = await req.json();
    if (rawRole !== "driver" && rawRole !== "passenger")
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    const role = rawRole;

    if (
      typeof phone !== "string" ||
      !phone.trim() ||
      !isPasswordInput(password)
    )
      return NextResponse.json(
        { error: "Phone and password are required." },
        { status: 400 },
      );

    await connectDB();

    const rawIdentifier = phone.normalize("NFKC").trim();
    const isEmail = rawIdentifier.includes("@");
    const identifier = isEmail
      ? normalizeEmail(rawIdentifier)
      : (normalizeEgyptPhone(rawIdentifier) ?? rawIdentifier);

    if (!identifier)
      return NextResponse.json(
        { error: "Invalid phone or password." },
        { status: 401 },
      );

    // First try exact match with phone/email AND specified role
    const user = await User.findOne(
      isEmail
        ? { email: identifier.toLowerCase(), role }
        : { phone: identifier, role },
    ).select("+passwordHash");

    if (!user) {
      return NextResponse.json(
        { error: "Invalid phone or password." },
        { status: 401 },
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid)
      return NextResponse.json(
        { error: "Invalid phone or password." },
        { status: 401 },
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
