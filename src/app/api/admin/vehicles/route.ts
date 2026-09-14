import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { ensureVehicleSeed } from "@/lib/db/seedVehicles";
import { Vehicle } from "@/models/Vehicle";
import { validateMutationRequest } from "@/lib/security/request";
import { invalidateVehiclesCache } from "@/lib/db/getVehicles";
import { cleanVehicle } from "@/lib/admin/vehicleInput";

export async function GET() {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  await ensureVehicleSeed();
  const vehicles = await Vehicle.find({}).sort({ sortOrder: 1, label: 1 }).lean();
  return NextResponse.json({ vehicles });
}

export async function POST(req: NextRequest) {
  const invalid = validateMutationRequest(req);
  if (invalid) return invalid;
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  const parsed = cleanVehicle(body as Record<string, unknown>);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const vehicle = await Vehicle.create({ ...parsed.update, active: parsed.update.active ?? true, regionCodes: parsed.update.regionCodes ?? [] });
    invalidateVehiclesCache();
    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) return NextResponse.json({ error: "Vehicle key already exists." }, { status: 409 });
    return NextResponse.json({ error: "Could not create vehicle." }, { status: 400 });
  }
}
