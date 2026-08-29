import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { normalizePlainText, validateMutationRequest } from "@/lib/security/request";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "driver") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const driver = await Driver.findOne({ userId: session.userId })
    .select(
      "payoutMethod payoutMobile payoutBankName payoutAccountNumber payoutAccountHolder",
    )
    .lean();

  if (!driver) {
    return NextResponse.json({ error: "Driver not found." }, { status: 404 });
  }

  return NextResponse.json({
    payoutMethod: driver.payoutMethod ?? null,
    payoutMobile: driver.payoutMobile ?? "",
    payoutBankName: driver.payoutBankName ?? "",
    payoutAccountNumber: driver.payoutAccountNumber ?? "",
    payoutAccountHolder: driver.payoutAccountHolder ?? "",
  });
}

export async function PATCH(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (!session || session.role !== "driver") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const method = body.payoutMethod;
  if (method !== "mobile_wallet" && method !== "bank") {
    return NextResponse.json(
      { error: "payoutMethod must be mobile_wallet or bank." },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = { payoutMethod: method };

  if (method === "mobile_wallet") {
    const mobile = String(body.payoutMobile ?? "").replace(/\D/g, "");
    if (!/^01\d{9}$/.test(mobile)) {
      return NextResponse.json(
        { error: "Mobile wallet must be a valid 01xxxxxxxxx number." },
        { status: 400 },
      );
    }
    update.payoutMobile = mobile;
    update.payoutBankName = undefined;
    update.payoutAccountNumber = undefined;
    update.payoutAccountHolder = undefined;
  } else {
    const bankName = normalizePlainText(body.payoutBankName, { maxLength: 100 });
    const accountNumber =
      typeof body.payoutAccountNumber === "string"
        ? body.payoutAccountNumber.normalize("NFKC").trim()
        : "";
    const accountHolder = normalizePlainText(body.payoutAccountHolder, {
      maxLength: 100,
    });
    if (!bankName || !/^[A-Za-z0-9 -]{6,34}$/.test(accountNumber) || !accountHolder) {
      return NextResponse.json(
        { error: "Bank name, account number, and holder name are required." },
        { status: 400 },
      );
    }
    update.payoutBankName = bankName;
    update.payoutAccountNumber = accountNumber;
    update.payoutAccountHolder = accountHolder;
    update.payoutMobile = undefined;
  }

  await connectDB();
  const driver = await Driver.findOneAndUpdate(
    { userId: session.userId },
    update,
    { returnDocument: "after" },
  )
    .select(
      "payoutMethod payoutMobile payoutBankName payoutAccountNumber payoutAccountHolder",
    )
    .lean();

  if (!driver) {
    return NextResponse.json({ error: "Driver not found." }, { status: 404 });
  }

  return NextResponse.json({
    payoutMethod: driver.payoutMethod,
    payoutMobile: driver.payoutMobile ?? "",
    payoutBankName: driver.payoutBankName ?? "",
    payoutAccountNumber: driver.payoutAccountNumber ?? "",
    payoutAccountHolder: driver.payoutAccountHolder ?? "",
  });
}
