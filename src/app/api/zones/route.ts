import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { resolveActiveRegion } from "@/lib/regions/resolveActiveRegion";
import { getServiceZoneConfig } from "@/lib/geo/zones.server";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const region = await resolveActiveRegion({
      userId: session.userId,
      requested: request.nextUrl.searchParams.get("region"),
    });
    return NextResponse.json(await getServiceZoneConfig(region.code));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load service zones.",
      },
      { status: 403 },
    );
  }
}
