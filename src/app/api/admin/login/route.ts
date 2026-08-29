import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { createSession } from "@/lib/auth/session";
import {
  isPasswordInput,
  normalizeEmail,
  validateMutationRequest,
} from "@/lib/security/request";
import { normalizeEgyptPhone } from "@/lib/auth/validation";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;
  const limited = await enforceRateLimit(req, "admin-login", {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  try {
    const { phone, password } = await req.json();

    if (
      typeof phone !== "string" ||
      !phone.trim() ||
      !isPasswordInput(password)
    ) {
      return NextResponse.json(
        { error: "Phone and password are required." },
        { status: 400 },
      );
    }

    await connectDB();

    const identifier = phone.normalize("NFKC").trim();
    const isEmail = identifier.includes("@");
    const normalizedIdentifier = isEmail
      ? normalizeEmail(identifier)
      : normalizeEgyptPhone(identifier);
    if (!normalizedIdentifier)
      return NextResponse.json(
        { error: "Invalid phone or password." },
        { status: 401 },
      );

    const user = await User.findOne(
      isEmail
        ? { email: normalizedIdentifier, role: "admin" }
        : { phone: normalizedIdentifier, role: "admin" },
    )
      .select("+passwordHash email name")
      .lean<{
        _id?: unknown;
        passwordHash?: string;
        email?: string;
        name?: string;
      }>();

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
