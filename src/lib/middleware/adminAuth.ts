import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";

export async function adminAuth(_req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  await connectDB();
  const user = await User.findById(session.userId).select("role").lean<{
    role?: string;
  }>();

  if (!user || user.role !== "admin") {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      ),
    };
  }

  return { authorized: true, userId: session.userId };
}
