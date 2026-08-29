import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import { Types } from "mongoose";
import { validateMutationRequest } from "@/lib/security/request";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  await connectDB();
  const { id } = await params;
  if (!Types.ObjectId.isValid(id))
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  const user = await User.findById(id)
    .select("userNumber name phone profilePic")
    .lean();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ data: user });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  try {
    await connectDB();
    const { id } = await params;
    if (!Types.ObjectId.isValid(id))
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    const body = await req.json();

    const updates: Record<string, unknown> = {};
    if (["passenger", "driver", "admin"].includes(body.role)) {
      updates.role = body.role;
    } else if (body.role !== undefined) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    if (body.verificationStatus) {
      const allowedStatuses = ["incomplete", "pending", "verified"];
      if (allowedStatuses.includes(body.verificationStatus)) {
        await Driver.findOneAndUpdate(
          { userId: id },
          { verificationStatus: body.verificationStatus },
          { upsert: true },
        );
      }
    }

    const user = await User.findByIdAndUpdate(id, updates, {
      returnDocument: "after",
    })
      .select("-passwordHash")
      .lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ data: user });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update user",
      },
      { status: 500 },
    );
  }
}
