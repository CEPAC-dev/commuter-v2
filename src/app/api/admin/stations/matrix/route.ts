import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import {
  fetchDirectionsMatrix,
  isMatrixProvider,
} from "@/app/api/directions/route";
import { connectDB } from "@/lib/db/mongoose";
import { haversineKm } from "@/lib/geo/stations";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { Station } from "@/models/Station";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StationRow = {
  objectId: number;
  lat: number;
  lng: number;
  name?: string;
  zones?: string;
  description?: string;
  landmark?: string;
  direction?: string;
};

function styleWorksheet(sheet: ExcelJS.Worksheet) {
  const border = {
    style: "thin" as ExcelJS.BorderStyle,
    color: { argb: "FF999999" },
  };

  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: border,
        bottom: border,
        left: border,
        right: border,
      };
      if (rowNumber === 1) cell.font = { bold: true };
    });
  });

  sheet.columns.forEach((column) => {
    const values = Array.isArray(column.values) ? column.values : [];
    const maxLength = values.reduce<number>(
      (maximum, value) => Math.max(maximum, String(value ?? "").length),
      10,
    );
    column.width = Math.min(maxLength + 2, 60);
  });
}

function styleMatrixWorksheet(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  sheet.getColumn(1).font = { bold: true };
  sheet.getColumn(1).width = 14;
}

export async function GET(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const requestedProvider = req.nextUrl.searchParams.get("matrixProvider");
  const matrixProvider = isMatrixProvider(requestedProvider)
    ? requestedProvider
    : "osrm";
  const requestedCosting = req.nextUrl.searchParams.get("valhallaCosting");
  const valhallaCosting =
    requestedCosting === "taxi" || requestedCosting === "bus"
      ? requestedCosting
      : "auto";
  const requestedDateTimeType = req.nextUrl.searchParams.get(
    "valhallaDateTimeType",
  );
  const valhallaDateTimeType =
    requestedDateTimeType === "depart_at" ||
    requestedDateTimeType === "arrive_by"
      ? requestedDateTimeType
      : "current";
  const valhallaDateTime = req.nextUrl.searchParams
    .get("valhallaDateTime")
    ?.trim();
  const requestedTransportation = req.nextUrl.searchParams.get(
    "travelTimeTransportation",
  );
  const travelTimeTransportation =
    requestedTransportation === "walking" ||
    requestedTransportation === "cycling"
      ? requestedTransportation
      : "driving";
  const requestedDepartureTime = req.nextUrl.searchParams
    .get("travelTimeDepartureTime")
    ?.trim();
  const travelTimeDepartureTime =
    requestedDepartureTime && !Number.isNaN(Date.parse(requestedDepartureTime))
      ? requestedDepartureTime
      : new Date().toISOString();

  await connectDB();
  const stations = await Station.find({})
    .select("objectId lat lng name zones description landmark direction")
    .sort({ objectId: 1 })
    .lean<StationRow[]>();

  if (stations.length === 0) {
    return NextResponse.json({ error: "No stations found." }, { status: 404 });
  }

  const invalidStations = stations.filter(
    (station) =>
      !Number.isFinite(station.objectId) ||
      !Number.isFinite(station.lat) ||
      !Number.isFinite(station.lng),
  );
  if (invalidStations.length > 0) {
    return NextResponse.json(
      {
        error:
          "All stations must have a valid objectId, latitude, and longitude.",
        invalidStationIds: invalidStations.map((station) => station.objectId),
      },
      { status: 422 },
    );
  }

  const directionsTable = await fetchDirectionsMatrix(
    matrixProvider,
    stations,
    {
      valhalla: {
        costing: valhallaCosting,
        dateTimeType: valhallaDateTimeType,
        dateTime: valhallaDateTime || undefined,
      },
      travelTime: {
        transportation: travelTimeTransportation,
        departureTime: travelTimeDepartureTime,
      },
    },
  );

  const workbook = new ExcelJS.Workbook();
  const stationsSheet = workbook.addWorksheet("Stations");
  stationsSheet.addRow([
    "Stop",
    "Lat",
    "Long",
    "Stop_Name",
    "Zone",
    "Description",
    "Landmark",
    "Direction",
  ]);
  stations.forEach((station) => {
    stationsSheet.addRow([
      station.objectId,
      station.lat,
      station.lng,
      station.name ?? "",
      station.zones ?? "",
      station.description ?? "",
      station.landmark ?? "",
      station.direction ?? "",
    ]);
  });

  const distanceSheet = workbook.addWorksheet("Dist_Skim");
  const timeSheet = workbook.addWorksheet("Time_Skim");
  distanceSheet.addRow([
    "Station Id",
    ...stations.map((station) => station.objectId),
  ]);
  timeSheet.addRow([
    "Station Id",
    ...stations.map((station) => station.objectId),
  ]);

  stations.forEach((origin, rowIndex) => {
    const distanceRow: Array<number> = [origin.objectId];
    const timeRow: Array<number> = [origin.objectId];

    stations.forEach((destination, columnIndex) => {
      if (rowIndex === columnIndex) {
        distanceRow.push(0);
        timeRow.push(0);
        return;
      }

      const directDistanceKm = haversineKm(
        origin.lat,
        origin.lng,
        destination.lat,
        destination.lng,
      );
      const routeDistance =
        directionsTable?.distancesKm[rowIndex]?.[columnIndex];
      const routeDuration =
        directionsTable?.durationsMinutes[rowIndex]?.[columnIndex];
      distanceRow.push(
        typeof routeDistance === "number" && routeDistance > 0
          ? routeDistance
          : Math.round(directDistanceKm * 10) / 10,
      );
      timeRow.push(
        typeof routeDuration === "number" && routeDuration > 0
          ? routeDuration
          : Math.max(1, Math.round((directDistanceKm / 35) * 60)),
      );
    });

    distanceSheet.addRow(distanceRow);
    timeSheet.addRow(timeRow);
  });

  styleWorksheet(stationsSheet);
  styleMatrixWorksheet(distanceSheet);
  styleMatrixWorksheet(timeSheet);

  const body = Buffer.from(await workbook.xlsx.writeBuffer());
  return new NextResponse(body, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="stations-matrix.xlsx"',
    },
  });
}
