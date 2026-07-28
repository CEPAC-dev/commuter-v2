import ExcelJS from "exceljs";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// TODO: restrict to admin once dashboard exists
// GET /api/admin/getSharedRideRequests

interface Row {
  rideId: number;
  passId: number | null;
  originNearestStationNo: number | null;
  destinationNearestStationNo: number | null;
  readyFrom: string;
  shouldArrivebefore: string;
  rideType: number;
  extraPassengers: number;
}

const COLUMNS: (keyof Row)[] = [
  "rideId",
  "passId",
  "originNearestStationNo",
  "destinationNearestStationNo",
  "readyFrom",
  "shouldArrivebefore",
  "rideType",
  "extraPassengers",
];

const RIDE_TYPE_BY_VEHICLE: Record<string, number> = {
  taxi_shared: 3,
  van_shared: 4,
  microbus_shared: 5,
};

function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function GET() {
  await connectDB();

  const tomorrow = getTomorrowDate();

  const trips = await Trip.find({
    date: tomorrow,
    status: "submitted",
    paymentStatus: "paid",
    vehicleType: { $in: ["taxi_shared", "van_shared", "microbus_shared"] },
  }).lean<
    {
      tripNumber: number;
      userId: unknown;
      pickupStation?: { id: number };
      dropoffStation?: { id: number };
      pickupTime: string;
      arrivalTime: string;
      vehicleType: string;
      extraPassengers: number;
    }[]
  >();

  const userIds = Array.from(new Set(trips.map((t) => String(t.userId))));
  const users = await User.find({ _id: { $in: userIds } })
    .select("userNumber")
    .lean<{ _id: unknown; userNumber: number }[]>();
  const userNumberMap = new Map(
    users.map((u) => [String(u._id), u.userNumber]),
  );

  const rows: Row[] = trips.map((trip) => ({
    rideId: trip.tripNumber,
    passId: userNumberMap.get(String(trip.userId)) ?? null,
    originNearestStationNo: trip.pickupStation?.id ?? null,
    destinationNearestStationNo: trip.dropoffStation?.id ?? null,
    readyFrom: trip.pickupTime,
    shouldArrivebefore: trip.arrivalTime,
    rideType: RIDE_TYPE_BY_VEHICLE[trip.vehicleType],
    extraPassengers: trip.extraPassengers,
  }));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("SharedRideRequests");
  ws.addRow(COLUMNS);
  for (const r of rows) ws.addRow(COLUMNS.map((c) => r[c]));

  const zip = new JSZip();
  zip.file("shared-ride-requests.json", JSON.stringify(rows, null, 2));
  zip.file(
    "shared-ride-requests.xlsx",
    Buffer.from(await wb.xlsx.writeBuffer()),
  );

  const body = await zip.generateAsync({ type: "blob" });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="shared-ride-requests.zip"',
    },
  });
}
