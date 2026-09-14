import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { Vehicle } from "@/models/Vehicle";
import { validateMutationRequest } from "@/lib/security/request";
import { cleanVehicle } from "@/lib/admin/vehicleInput";
import { invalidateVehiclesCache } from "@/lib/db/getVehicles";

function checkPassword(value: unknown) {
  const expected = process.env.ADMIN_PASSWORD?.trim();
  if (!expected) return NextResponse.json({ error: "ADMIN_PASSWORD is not configured on the server." }, { status: 500 });
  if (typeof value !== "string" || value.trim() !== expected) return NextResponse.json({ error: "Invalid admin password." }, { status: 401 });
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const invalid = validateMutationRequest(req);
  if (invalid) return invalid;
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  const parsed = cleanVehicle(body as Record<string, unknown>, true);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { key } = await params;
  const vehicle = await Vehicle.findOneAndUpdate({ key }, parsed.update, { returnDocument: "after", runValidators: true });
  if (!vehicle) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  invalidateVehiclesCache();
  return NextResponse.json({ vehicle });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const invalid = validateMutationRequest(req);
  if (invalid) return invalid;
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  const body = await req.json().catch(() => null) as { password?: unknown } | null;
  const passwordError = checkPassword(req.headers.get("x-admin-password") ?? body?.password);
  if (passwordError) return passwordError;
  const { key } = await params;
  const result = await Vehicle.findOneAndDelete({ key });
  if (!result) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  invalidateVehiclesCache();
  return NextResponse.json({ deleted: true });
}
