import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { countWaitingListRows } from "@/lib/admin/waitingList";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  await connectDB();
  const [requestCount, tripCount] = await Promise.all([
    Request.countDocuments({ status: "waiting_list" }),
    Trip.countDocuments({ status: "waiting_list", requestId: null }),
  ]);
  const count = countWaitingListRows(requestCount, tripCount);
  return NextResponse.json({ count });
}
