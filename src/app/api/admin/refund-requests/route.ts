import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { RefundRequest } from "@/models/RefundRequest";
import "@/models/User";
import "@/models/Trip";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") || "pending";

    await connectDB();

    const query: any = {};
    if (statusParam !== "all") {
      query.status = statusParam;
    }

    const requests = await RefundRequest.find(query)
      .sort({ requestedAt: -1 })
      .populate("passengerId", "name email phone profilePic")
      .populate("tripId", "tripNumber date pickup dropoff priceEgp status cancellation")
      .populate("reviewedBy", "name email")
      .lean();

    return NextResponse.json({
      success: true,
      data: requests,
    });
  } catch (error: any) {
    console.error("Error fetching refund requests:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
