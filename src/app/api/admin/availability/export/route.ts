import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";

export async function GET() {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  await connectDB();

  const records = await Availability.find({})
    .sort({ date: 1, startTime: 1 })
    .lean();

  const payload = JSON.stringify(records, null, 2);

  return new NextResponse(payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition":
        'attachment; filename="availabilities-backup.json"',
    },
  });
}
