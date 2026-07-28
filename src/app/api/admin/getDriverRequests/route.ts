import ExcelJS from "exceljs";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { Driver } from "@/models/Driver";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// TODO: restrict to admin once dashboard exists
// GET /api/admin/getDriverRequests

interface Row {
  driverId: number | null;
  availabilityId: number;
  startLat: number;
  startLong: number;
  startNearestStationNo: number | null;
  endLat: number;
  endLong: number;
  endNearestStationNo: number | null;
  startTime: string;
  endTime: string;
  vehicleType: number | null;
}

const COLUMNS: (keyof Row)[] = [
  "driverId",
  "availabilityId",
  "startLat",
  "startLong",
  "startNearestStationNo",
  "endLat",
  "endLong",
  "endNearestStationNo",
  "startTime",
  "endTime",
  "vehicleType",
];

const VEHICLE_TYPE_BY_CAR_TYPE: Record<string, number> = {
  private: 1,
  taxi: 2,
  van: 3,
  microbus: 4,
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

  const availabilities = await Availability.find({
    date: tomorrow,
  }).lean<
    {
      availabilityNumber: number;
      driverId: unknown;
      startLocation: { lat: number; lng: number };
      endLocation: { lat: number; lng: number };
      startNearestStation?: { id: number };
      endNearestStation?: { id: number };
      startTime: string;
      endTime: string;
    }[]
  >();

  const driverIds = Array.from(
    new Set(
      availabilities.map((availability) => String(availability.driverId)),
    ),
  );
  const users = await User.find({ _id: { $in: driverIds } })
    .select("userNumber")
    .lean<{ _id: unknown; userNumber: number }[]>();
  const userNumberMap = new Map(
    users.map((user) => [String(user._id), user.userNumber]),
  );
  const drivers = await Driver.find({ userId: { $in: driverIds } })
    .select("userId carType")
    .lean<{ userId: unknown; carType?: string }[]>();
  const carTypeMap = new Map(
    drivers.map((driver) => [String(driver.userId), driver.carType]),
  );

  const rows: Row[] = availabilities.map((availability) => {
    const carType = carTypeMap.get(String(availability.driverId));
    return {
      driverId: userNumberMap.get(String(availability.driverId)) ?? null,
      availabilityId: availability.availabilityNumber,
      startLat: availability.startLocation.lat,
      startLong: availability.startLocation.lng,
      startNearestStationNo: availability.startNearestStation?.id ?? null,
      endLat: availability.endLocation.lat,
      endLong: availability.endLocation.lng,
      endNearestStationNo: availability.endNearestStation?.id ?? null,
      startTime: availability.startTime,
      endTime: availability.endTime,
      vehicleType: carType ? (VEHICLE_TYPE_BY_CAR_TYPE[carType] ?? null) : null,
    };
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("DriverRequests");
  ws.addRow(COLUMNS);
  for (const row of rows) ws.addRow(COLUMNS.map((column) => row[column]));

  const zip = new JSZip();
  zip.file("driver-requests.json", JSON.stringify(rows, null, 2));
  zip.file("driver-requests.xlsx", Buffer.from(await wb.xlsx.writeBuffer()));

  const body = await zip.generateAsync({ type: "blob" });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="driver-requests.zip"',
    },
  });
}
