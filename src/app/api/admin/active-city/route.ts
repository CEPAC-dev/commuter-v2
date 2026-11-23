import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { isRegionCode } from "@/lib/config/regions";
import { User } from "@/models/User";
import { OperatingCity } from "@/models/OperatingCity";
import { validateMutationRequest } from "@/lib/security/request";

export async function PATCH(request: NextRequest) {
  const invalid = validateMutationRequest(request);
  if (invalid) return invalid;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const { regionCode, cityCode } = body as {
    regionCode?: unknown;
    cityCode?: unknown;
  };
  if (!isRegionCode(regionCode)) {
    return NextResponse.json({ error: "Choose a valid Region." }, { status: 400 });
  }
  const auth = await adminAuth(undefined, regionCode);
  if (!auth.authorized) return auth.response;
  if (
    typeof cityCode !== "string" ||
    !(await OperatingCity.exists({
      regionCode,
      cityCode: cityCode.trim().toLowerCase(),
    }))
  ) {
    return NextResponse.json(
      { error: "Choose an active City/State within the selected Region." },
      { status: 400 },
    );
  }
  await User.findByIdAndUpdate(auth.userId, {
    $set: {
      defaultRegionCode: regionCode,
      defaultCityCode: cityCode.trim().toLowerCase(),
    },
  });
  return NextResponse.json({ ok: true });
}
