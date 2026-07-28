import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();

    const updates: Record<string, unknown> = {};
    if (typeof body.role === "string") {
      updates.role = body.role;
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unable to update user" },
      { status: 500 },
    );
  }
}
