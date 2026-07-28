import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listDriverTrips } from "@/lib/services/trips";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "driver")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize")) || 12));
  const statusGroup = sp.get("group") as
    | "upcoming"
    | "ongoing"
    | "previous"
    | "pending_payment"
    | null;
  const dateFrom = sp.get("dateFrom") ?? undefined;
  const dateTo = sp.get("dateTo") ?? undefined;

  const result = await listDriverTrips(session.userId, {
    page,
    pageSize,
    statusGroup: statusGroup ?? undefined,
    dateFrom,
    dateTo,
  });

  return NextResponse.json({ trips: result.rows, total: result.total, page: result.page });
}
