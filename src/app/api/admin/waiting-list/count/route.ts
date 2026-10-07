import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  await connectDB();
  const count = await Request.countDocuments({ status: "waiting_list" });
  return NextResponse.json({ count });
}
