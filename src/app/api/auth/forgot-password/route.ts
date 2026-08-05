import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";

function getPhoneCandidates(value: string) {
  const digits = value.replace(/\D/g, "");
  const candidates = new Set<string>();

  if (!digits) return [];

  let core = digits;

  if (core.startsWith("20") && core.length > 10) {
    core = core.slice(2);
  }

  if (core.startsWith("0") && core.length > 10) {
    core = core.slice(1);
  }

  if (core.length > 10) {
    core = core.slice(-10);
  }

  if (core.length !== 10) return [];

  const withoutLeadingZero = core.replace(/^0/, "");

  candidates.add(`+20${withoutLeadingZero}`);
  candidates.add(`0${withoutLeadingZero}`);
  candidates.add(withoutLeadingZero);
  candidates.add(`+20${core}`);
  candidates.add(`0${core}`);
  candidates.add(core);

  return Array.from(candidates).filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
    const role = body.role === "driver" ? "driver" : "passenger";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";
    const confirmPassword =
      typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    const phoneCandidates = getPhoneCandidates(rawPhone);

    if (phoneCandidates.length === 0) {
      return NextResponse.json(
        { error: "Phone number must be 10 digits after +20." },
        { status: 400 },
      );
    }

    if (!newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Please enter a new password and confirm it." },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters." },
        { status: 400 },
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 },
      );
    }

    await connectDB();

    const rolesToTry = role === "driver" ? (["driver", "passenger"] as const) : (["passenger", "driver"] as const);
    let user = null;

    for (const candidateRole of rolesToTry) {
      user = await User.findOne({
        role: candidateRole,
        $or: phoneCandidates.map((phone) => ({ phone })),
      }).select("passwordHash");

      if (user) break;
    }

    if (!user) {
      return NextResponse.json(
        { error: "No account was found for this phone number for the selected role." },
        { status: 404 },
      );
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Failed to update password. Please try again." },
      { status: 500 },
    );
  }
}
