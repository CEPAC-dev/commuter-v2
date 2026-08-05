import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { getDriverSummaryByUserNumber } from "@/lib/services/trips";
import { createNotification } from "@/lib/notifications/createNotification";

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

function parseTripNumber(value: string): number | null {
  if (!value) return null;
  const normalized = value.trim().replace(/,/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Number.isInteger(parsed) ? parsed : null;
}

function getWorksheetByName(
  workbook: ExcelJS.Workbook,
  candidates: string[],
): ExcelJS.Worksheet | undefined {
  for (const candidate of candidates) {
    const sheet = workbook.getWorksheet(candidate);
    if (sheet) return sheet;
  }

  const normalizedCandidates = new Set(
    candidates.map((candidate) => normalizeLookupKey(candidate)),
  );

  for (const sheet of workbook.worksheets) {
    if (normalizedCandidates.has(normalizeLookupKey(sheet.name))) {
      return sheet;
    }
  }

  return undefined;
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

    const ridesSummarySheet = getWorksheetByName(workbook, [
      "Rides_Summary",
      "Rides Summary",
      "Summary",
    ]);
    const ridesDetailsSheet = getWorksheetByName(workbook, [
      "Rides_Details",
      "Rides Details",
      "Details",
    ]);
    const stopsSheet = getWorksheetByName(workbook, ["Stops", "Stop"]);
    if (!ridesSummarySheet) {
      return NextResponse.json(
        { error: "A summary sheet is required" },
        { status: 400 },
      );
    }
    if (!stopsSheet) {
      return NextResponse.json(
        { error: "A stops sheet is required" },
        { status: 400 },
      );
    }

    const stopLookup = buildStopLookup(stopsSheet);
    const summaryHeaderRow = ridesSummarySheet.getRow(1);
    const summaryIndexes = getHeaderIndexes(summaryHeaderRow);
    const summaryRows =
      ridesSummarySheet.getRows(2, ridesSummarySheet.rowCount - 1) ?? [];
    const updatedTripIds: string[] = [];

    for (const row of summaryRows) {
      if (!row) continue;
      const rideIdValue = getCellValue(row, summaryIndexes, "Ride_ID");
      if (!rideIdValue) continue;

      const tripNumber = parseTripNumber(rideIdValue);
      if (tripNumber == null) continue;

      const trip = await Trip.findOne({
        $or: [{ tripNumber }, { tripNumber: String(tripNumber) }],
      }).lean<{
        _id: unknown;
        tripNumber: number;
      }>();
      if (!trip) continue;

      const driverIdValue = getCellValue(row, summaryIndexes, "Driver_ID");
      const totalPersonsValue = getCellValue(row, summaryIndexes, "Total_Pers");
      const totalFeesValue = getCellValue(row, summaryIndexes, "Total_Fees");
      const firstStopValue = getCellValue(row, summaryIndexes, "First Stop");
      const boardingValue = getCellValue(row, summaryIndexes, "Boarding");
      const departureValue = getCellValue(row, summaryIndexes, "Departure");
      const lastStopValue = getCellValue(row, summaryIndexes, "Last Stop");
      const alightingValue = getCellValue(row, summaryIndexes, "Alighting");
      const arrivalValue = getCellValue(row, summaryIndexes, "Arrival");

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
        totalFees: Math.round(parseNumber(totalFeesValue) ?? 0),
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

      await Trip.collection.updateOne({ tripNumber }, { $set: { summary } });
      updatedTripIds.push(String(trip.tripNumber));
    }

    if (ridesDetailsSheet) {
      const detailsHeaderRow = ridesDetailsSheet.getRow(1);
      const detailsIndexes = getHeaderIndexes(detailsHeaderRow);
      const detailsRows =
        ridesDetailsSheet.getRows(2, ridesDetailsSheet.rowCount - 1) ?? [];

      for (const row of detailsRows) {
        if (!row) continue;
        const rideIdValue = getCellValue(row, detailsIndexes, "Ride_ID");
        if (!rideIdValue) continue;

        const tripNumber = parseTripNumber(rideIdValue);
        if (tripNumber == null) continue;

        const trip = await Trip.findOne({
          $or: [{ tripNumber }, { tripNumber: String(tripNumber) }],
        }).lean<{
          _id: unknown;
          tripNumber: number;
          userId?: unknown;
          summary?: Record<string, unknown> | null;
        }>();
        if (!trip) continue;

        const seatValue = getCellValue(row, detailsIndexes, "Seat");
        const stopsValue = getCellValue(row, detailsIndexes, "Stops");
        const details = {
          driver: trip.summary?.driver ?? null,
          seatNumber: seatValue,
          pickupPoint: trip.summary?.pickupPoint ?? null,
          departureTime: trip.summary?.departureTime ?? null,
          dropoffPoint: trip.summary?.dropoffPoint ?? null,
          arrivalTime: trip.summary?.arrivalTime ?? null,
          stops: stopsValue,
        };

        const confirmedTime = normalizeTimeValue(
          getCellValue(row, detailsIndexes, "Arrival"),
        );

        await Trip.collection.updateOne(
          {
            $or: [{ tripNumber }, { tripNumber: String(tripNumber) }],
          },
          {
            $set: {
              details,
              status: "matched",
            },
          },
        );

        if (trip.userId) {
          await createNotification({
            userId: String(trip.userId),
            type: "trip_submitted",
            title: "Trip matched",
            body: `Your trip has been matched and confirmed for ${confirmedTime || "the scheduled time"}.`,
            data: {
              tripNumber,
              status: "matched",
              confirmedTime,
            },
          });
        }
      }
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
