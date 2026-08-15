import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Ride } from "@/models/Ride";

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function requireAdminPassword(req: NextRequest) {
  const expectedPassword = process.env.ADMIN_PASSWORD?.trim();
  const providedPassword = req.headers.get("x-admin-password")?.trim();

  if (!expectedPassword) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "ADMIN_PASSWORD is not configured on the server." },
        { status: 500 },
      ),
    };
  }

  if (!providedPassword || providedPassword !== expectedPassword) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid admin password." },
        { status: 401 },
      ),
    };
  }

  return { ok: true };
}

export async function DELETE(req: NextRequest) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  const passwordCheck = requireAdminPassword(req);
  if (!passwordCheck.ok) return passwordCheck.response;

  await connectDB();

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date")?.trim();

  if (date && !isValidDate(date)) {
    return NextResponse.json(
      { error: "date must be a valid YYYY-MM-DD string." },
      { status: 400 },
    );
  }

  const filter = date ? { date } : {};
  const result = await Ride.deleteMany(filter);

  return NextResponse.json({
    ok: true,
    deletedCount: result.deletedCount ?? 0,
    scope: date ? "date" : "all",
    date: date ?? null,
  });
}
