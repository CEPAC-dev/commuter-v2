import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { getDriverSummaryByUserNumber } from "@/lib/services/trips";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeTimeValue(value: unknown): string {
  if (value == null || value === "") return "";

  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }

  const trimmed = String(value).trim();
  if (!trimmed) return "";

  const simpleMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (simpleMatch) {
    const hours = Number(simpleMatch[1]);
    const minutes = Number(simpleMatch[2]);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]);
    const minutes = Number(ampmMatch[2]);
    const suffix = ampmMatch[3].toLowerCase();
    if (suffix === "pm" && hours < 12) hours += 12;
    if (suffix === "am" && hours === 12) hours = 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  const numericValue = Number(trimmed);
  if (Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 1) {
    const totalMinutes = Math.round(numericValue * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  return trimmed;
}

function getHeaderIndexes(headerRow: ExcelJS.Row): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    const key = normalizeHeader(cell.value);
    if (key) map.set(key, colNumber);
  });
  return map;
}

function getCellValue(
  row: ExcelJS.Row,
  indexes: Map<string, number>,
  header: string,
): string {
  const column = indexes.get(normalizeHeader(header));
  if (column == null) return "";
  const value = row.getCell(column).value;
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  return String(value).trim();
}

function pickValue(
  row: ExcelJS.Row,
  indexes: Map<string, number>,
  aliases: string[],
): string {
  for (const alias of aliases) {
    const value = getCellValue(row, indexes, alias);
    if (value) return value;
  }
  return "";
}

function parseNumber(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePointFromStopRow(row: ExcelJS.Row, indexes: Map<string, number>) {
  const lat = parseNumber(
    pickValue(row, indexes, ["lat", "latitude", "latitute"]),
  );
  const lng = parseNumber(
    pickValue(row, indexes, ["lng", "lon", "long", "longitude"]),
  );
  const address = pickValue(row, indexes, [
    "stop_name",
    "stopname",
    "stop",
    "name",
    "stationname",
    "label",
    "station",
    "stationnameen",
    "stationnamear",
    "address",
    "stopaddress",
    "location",
    "locationname",
  ]);

  if (lat == null || lng == null) return null;

  return {
    lat,
    lng,
    address: address || "",
  };
}

function buildStopLookup(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  const indexes = getHeaderIndexes(headerRow);
  const rows = sheet.getRows(2, sheet.rowCount - 1) ?? [];
  const map = new Map<string, { lat: number; lng: number; address: string }>();

  for (const row of rows) {
    if (!row) continue;
    const point = parsePointFromStopRow(row, indexes);
    if (!point) continue;

    const stopName = pickValue(row, indexes, ["Stop"]);

    if (stopName) {
      map.set(normalizeLookupKey(stopName), point);
    }
  }

  return map;
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Excel file is required" },
        { status: 400 },
      );
    }

    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as ArrayBuffer);

    const ridesSummarySheet = workbook.getWorksheet("Rides_Summary");
    const stopsSheet = workbook.getWorksheet("Stops");
    if (!ridesSummarySheet) {
      return NextResponse.json(
        { error: "Rides_Summary sheet is required" },
        { status: 400 },
      );
    }
    if (!stopsSheet) {
      return NextResponse.json(
        { error: "Stops sheet is required" },
        { status: 400 },
      );
    }

    const stopLookup = buildStopLookup(stopsSheet);
    const headerRow = ridesSummarySheet.getRow(1);
    const indexes = getHeaderIndexes(headerRow);
    const rows =
      ridesSummarySheet.getRows(2, ridesSummarySheet.rowCount - 1) ?? [];
    const updatedTripIds: string[] = [];

    for (const row of rows) {
      if (!row) continue;
      const rideIdValue = getCellValue(row, indexes, "Ride_ID");
      if (!rideIdValue) continue;

      const tripNumber = Number(rideIdValue);
      if (!Number.isInteger(tripNumber)) continue;

      const trip = await Trip.findOne({ tripNumber }).lean<{
        _id: unknown;
        tripNumber: number;
      }>();
      if (!trip) continue;

      const driverIdValue = getCellValue(row, indexes, "Driver_ID");
      const totalPersonsValue = getCellValue(row, indexes, "Total_Pers");
      const totalFeesValue = getCellValue(row, indexes, "Total_Fees");
      const firstStopValue = getCellValue(row, indexes, "First Stop");
      const boardingValue = getCellValue(row, indexes, "Boarding");
      const departureValue = getCellValue(row, indexes, "Departure");
      const lastStopValue = getCellValue(row, indexes, "Last Stop");
      const alightingValue = getCellValue(row, indexes, "Alighting");
      const arrivalValue = getCellValue(row, indexes, "Arrival");

      const driverSummary = await getDriverSummaryByUserNumber(driverIdValue);
      const pickUpStopPoint = stopLookup.get(
        normalizeLookupKey(firstStopValue),
      );
      const dropOffStopPoint = stopLookup.get(
        normalizeLookupKey(lastStopValue),
      );

      const summary = {
        driver: driverSummary,
        totalPersons: parseNumber(totalPersonsValue),
        totalFees: parseNumber(totalFeesValue),
        pickupPoint: pickUpStopPoint
          ? {
              lat: pickUpStopPoint.lat,
              lng: pickUpStopPoint.lng,
              address: pickUpStopPoint.address,
            }
          : null,
        boarding: parseNumber(boardingValue),
        departureTime: normalizeTimeValue(departureValue),
        dropoffPoint: dropOffStopPoint
          ? {
              lat: dropOffStopPoint.lat,
              lng: dropOffStopPoint.lng,
              address: dropOffStopPoint.address,
            }
          : null,
        alighting: parseNumber(alightingValue),
        arrivalTime: normalizeTimeValue(arrivalValue),
      };

      await Trip.updateOne({ tripNumber }, { $set: { summary } });
      updatedTripIds.push(String(trip.tripNumber));
    }

    return NextResponse.json({
      ok: true,
      updatedCount: updatedTripIds.length,
      tripIds: updatedTripIds,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
