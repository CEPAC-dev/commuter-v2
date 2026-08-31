import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Types } from "mongoose";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (typeof body.unlimited !== "boolean") {
    return NextResponse.json(
      { error: "unlimited must be a boolean." },
      { status: 400 },
    );
  }

  await connectDB();

  const user = await User.findByIdAndUpdate(
    id,
    { $set: { referralUnlimited: body.unlimited } },
    { new: true },
  ).select("_id userNumber name role referralUnlimited");

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: String(user._id),
      referralUnlimited: Boolean(user.referralUnlimited),
    },
  });
}
