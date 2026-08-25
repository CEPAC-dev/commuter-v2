import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { hasPermission, type PermissionKey } from "@/lib/auth/permissions";

export async function adminAuth(requiredPermission?: PermissionKey) {
  const session = await getSession();
  if (!session) {
    return {
      authorized: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  await connectDB();
  const user = await User.findById(session.userId)
    .select("role permissions")
    .lean<{ role?: string; permissions?: string[] }>();

  if (!user || user.role !== "admin") {
    return {
      authorized: false as const,
      response: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      ),
    };
  }

  if (
    requiredPermission &&
    !hasPermission(user.role, user.permissions, requiredPermission)
  ) {
    return {
      authorized: false as const,
      response: NextResponse.json(
        { error: `Missing permission: ${requiredPermission}` },
        { status: 403 },
      ),
    };
  }

  return {
    authorized: true as const,
    userId: session.userId,
    permissions: user.permissions ?? [],
  };
}
