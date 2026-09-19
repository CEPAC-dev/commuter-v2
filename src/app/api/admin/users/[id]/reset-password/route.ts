import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { validateMutationRequest } from "@/lib/security/request";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const expectedAdminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!expectedAdminPassword) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not configured on the server." },
      { status: 500 },
    );
  }
  if (req.headers.get("x-admin-password")?.trim() !== expectedAdminPassword) {
    return NextResponse.json(
      { error: "Invalid admin password." },
      { status: 401 },
    );
  }

  const defaultPassword = process.env.DEFAULT_USER_PASSWORD?.trim();
  if (!defaultPassword) {
    return NextResponse.json(
      { error: "DEFAULT_USER_PASSWORD is not configured on the server." },
      { status: 500 },
    );
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  await connectDB();
  const user = await User.findByIdAndUpdate(
    id,
    {
      $set: {
        passwordHash: await bcrypt.hash(defaultPassword, 12),
        resetPassword: true,
      },
    },
    { new: true },
  ).select("_id");
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
