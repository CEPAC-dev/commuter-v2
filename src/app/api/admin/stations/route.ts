import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Station } from "@/models/Station";

export async function GET(req: NextRequest) {
  const auth = await adminAuth(
    undefined,
    req.nextUrl.searchParams.get("region"),
  );
  if (!auth.authorized) return auth.response;

  await connectDB();

  const stations = await Station.find({ regionCode: auth.region.code })
    .sort({ objectId: 1 })
    .lean();

  return NextResponse.json({ stations });
}
