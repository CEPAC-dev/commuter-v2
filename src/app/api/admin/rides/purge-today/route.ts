import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Ride } from "@/models/Ride";

function getCairoDayRange(now = new Date()) {
  const cairoFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = cairoFormatter.formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  const startUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const endUtc = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));

  return {
    label: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    startUtc,
    endUtc,
  };
}

export async function DELETE(req: NextRequest) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  await connectDB();

  const { label, startUtc, endUtc } = getCairoDayRange();
  const result = await Ride.deleteMany({
    createdAt: { $gte: startUtc, $lt: endUtc },
  });

  return NextResponse.json({
    ok: true,
    date: label,
    deletedCount: result.deletedCount ?? 0,
  });
}
