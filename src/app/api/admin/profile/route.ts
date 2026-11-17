import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession, getSession } from "@/lib/auth/session";
import { normalizeEgyptPhone, PHONE_RULES_MESSAGE } from "@/lib/auth/validation";
import { connectDB } from "@/lib/db/mongoose";
import {
  isPasswordInput,
  normalizeEmail,
  normalizePlainText,
  validateMutationRequest,
} from "@/lib/security/request";
import { User } from "@/models/User";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const admin = await User.findOne({ _id: session.userId, role: "admin" })
    .select("name email phone profilePic")
    .lean();
  if (!admin)
    return NextResponse.json({ error: "Admin account not found." }, { status: 404 });

  return NextResponse.json({ data: admin });
}

export async function PATCH(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (!session || session.role !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const name = normalizePlainText(body.name, { maxLength: 100 });
    const phone = normalizeEgyptPhone(body.phone);
    if (typeof body.email !== "string")
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    const emailInput = body.email.trim();
    const email = emailInput ? normalizeEmail(emailInput) : null;

    if (!name)
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!phone)
      return NextResponse.json({ error: PHONE_RULES_MESSAGE }, { status: 400 });
    if (emailInput && !email)
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

    await connectDB();
    const currentAdmin = await User.findOne({
      _id: session.userId,
      role: "admin",
    })
      .select("+passwordHash name email phone")
      .lean<{
        passwordHash?: string;
        email?: string | null;
        phone?: string;
      }>();
    if (!currentAdmin?.passwordHash)
      return NextResponse.json({ error: "Admin account not found." }, { status: 404 });

    const contactChanged =
      currentAdmin.phone !== phone ||
      (currentAdmin.email ?? "") !== (email ?? "");
    if (contactChanged) {
      if (!isPasswordInput(body.currentPassword))
        return NextResponse.json(
          { error: "Enter your current password to change your contact details." },
          { status: 400 },
        );
      const validPassword = await bcrypt.compare(
        body.currentPassword,
        currentAdmin.passwordHash,
      );
      if (!validPassword)
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 403 },
        );
    }

    const fieldsToSet: Record<string, unknown> = {
      name,
      phone,
      ...(currentAdmin.phone !== phone ? { phoneVerifiedAt: null } : {}),
      ...(email ? { email } : {}),
    };
    const updatedAdmin = await User.findOneAndUpdate(
      { _id: session.userId, role: "admin" },
      {
        $set: fieldsToSet,
        ...(!email ? { $unset: { email: 1 } } : {}),
      },
      {
        returnDocument: "after",
        select: "name email phone profilePic",
        runValidators: true,
      },
    ).lean();

    if (!updatedAdmin)
      return NextResponse.json({ error: "Admin account not found." }, { status: 404 });
    if ((currentAdmin.email ?? "") !== (email ?? "")) {
      await createSession({
        userId: session.userId,
        email: updatedAdmin.email ?? "",
        role: "admin",
      });
    }
    return NextResponse.json({ data: updatedAdmin });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        { error: "That email or phone number is already used by another admin." },
        { status: 409 },
      );
    }
    console.error("Admin profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update admin profile." },
      { status: 500 },
    );
  }
}
