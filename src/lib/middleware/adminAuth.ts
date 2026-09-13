import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/User";
import { hasPermission, type PermissionKey } from "@/lib/auth/permissions";
import {
  RegionAccessError,
  resolveActiveRegion,
} from "@/lib/regions/resolveActiveRegion";

export async function adminAuth(
  requiredPermission?: PermissionKey,
  requestedRegion?: string | null,
) {
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

  if (requestedRegion !== undefined) {
    try {
      const region = await resolveActiveRegion({
        userId: session.userId,
        requested: requestedRegion,
      });
      return {
        authorized: true as const,
        userId: session.userId,
        permissions: user.permissions ?? [],
        region,
      };
    } catch (error) {
      const status = error instanceof RegionAccessError ? error.status : 403;
      const message =
        error instanceof Error ? error.message : "Region access denied.";
      return {
        authorized: false as const,
        response: NextResponse.json({ error: message }, { status }),
      };
    }
  }

  return {
    authorized: true as const,
    userId: session.userId,
    permissions: user.permissions ?? [],
  };
}
