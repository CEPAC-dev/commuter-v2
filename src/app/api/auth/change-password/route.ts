import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { getSession } from "@/lib/auth/session";
import {
  isPasswordInput,
  isSafePassword,
  validateMutationRequest,
} from "@/lib/security/request";
import {
  PASSWORD_RULES_MESSAGE,
  isStrongPassword,
} from "@/lib/auth/validation";

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { currentPassword, newPassword, confirmPassword } = await req.json();

    if (
      !isPasswordInput(currentPassword) ||
      !isSafePassword(newPassword) ||
      !isPasswordInput(confirmPassword)
    )
      return NextResponse.json(
        { error: PASSWORD_RULES_MESSAGE },
        { status: 400 },
      );

    if (!isStrongPassword(newPassword))
      return NextResponse.json(
        { error: PASSWORD_RULES_MESSAGE },
        { status: 400 },
      );

    if (newPassword !== confirmPassword)
      return NextResponse.json(
        { error: "New passwords do not match." },
        { status: 400 },
      );

    if (currentPassword === newPassword)
      return NextResponse.json(
        { error: "New password must be different from current password." },
        { status: 400 },
      );

    await connectDB();
    const user = await User.findById(session.userId).select("+passwordHash");
    if (!user)
      return NextResponse.json({ error: "User not found." }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid)
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 },
      );

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to change password." },
      { status: 500 },
    );
  }
}
