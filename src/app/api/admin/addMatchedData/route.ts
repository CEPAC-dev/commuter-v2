import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { nextSequence } from "@/models/Counter";
import { Driver } from "@/models/Driver";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";
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

function getSheetRows(sheet: ExcelJS.Worksheet): ExcelJS.Row[] {
  const rows: ExcelJS.Row[] = [];
  sheet.eachRow((row) => rows.push(row));
  return rows;
}

function parseTripNumber(value: string): number | null {
  if (!value) return null;
  const normalized = value.trim().replace(/,/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeRideType(value: string): "private" | "shared" {
  const normalized = normalizeLookupKey(value);
  if (["private", "privatecar", "1"].includes(normalized)) return "private";
  return "shared";
}

function normalizeVehicleType(value: string): string {
  const normalized = normalizeLookupKey(value);
  if (["1", "private", "privatecar"].includes(normalized)) {
    return "private_car";
  }
  if (["2", "taxi", "taxi_private"].includes(normalized)) {
    return "taxi_private";
  }
  if (["3", "van"].includes(normalized)) {
    return "van_shared";
  }
  if (["4", "microbus"].includes(normalized)) {
    return "microbus_shared";
  }
  return "private_car";
}

function isNullValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "-" || normalized === "0" || normalized === "null";
}

function getCellValueAtColumn(row: ExcelJS.Row, columnNumber: number): string {
  const value = row.getCell(columnNumber).value;
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  return String(value).trim();
}

function buildPointFromStopValue(
  stopValue: string,
  stopLookup: Map<string, { lat: number; lng: number; address: string }>,
) {
  if (!stopValue) return null;
  const point = stopLookup.get(normalizeLookupKey(stopValue));
  if (!point) return null;
  return {
    lat: point.lat,
    lng: point.lng,
    address: point.address,
  };
}

function buildRideDetailContext(
  row: ExcelJS.Row,
  indexes: Map<string, number>,
  stopLookup: Map<string, { lat: number; lng: number; address: string }>,
) {
  const tripNumber = parseTripNumber(getCellValue(row, indexes, "Ride_ID"));
  const passengerNumber = parseNumber(getCellValue(row, indexes, "Pass_ID"));
  const rideType = normalizeRideType(getCellValue(row, indexes, "Ride_Type"));
  const seatNumber = parseNumber(getCellValue(row, indexes, "Seat"));
  const boardingPoint = buildPointFromStopValue(
    getCellValue(row, indexes, "Board_Stop"),
    stopLookup,
  );
  const departure = normalizeTimeValue(getCellValue(row, indexes, "Departure"));
  const stops = getCellValue(row, indexes, "Stops");
  const alightingPoint = buildPointFromStopValue(
    getCellValue(row, indexes, "Alight_Stop"),
    stopLookup,
  );
  const arrival = normalizeTimeValue(getCellValue(row, indexes, "Arrival"));

  return {
    tripNumber,
    passengerNumber,
    rideType,
    seatNumber,
    boardingPoint,
    departure,
    stops,
    alightingPoint,
    arrival,
  };
}

function buildRouteFromRow(
  row: ExcelJS.Row,
  indexes: Map<string, number>,
  stopLookup: Map<string, { lat: number; lng: number; address: string }>,
) {
  const detailContext = buildRideDetailContext(row, indexes, stopLookup);
  const route: Array<{
    point: { lat: number; lng: number; address: string } | null;
    alighting: Record<string, unknown> | null;
    boarding: Record<string, unknown> | null;
    waitingMinutes: number;
    departure: string;
    arrival: string;
  }> = [];

  const startColumn = 4;
  const valuesLength = Array.isArray(row.values) ? row.values.length : 0;
  const maxColumn = Math.max(4, valuesLength - 1);

  for (let columnNumber = startColumn; columnNumber <= maxColumn - 5; columnNumber += 6) {
    const stopValue = getCellValueAtColumn(row, columnNumber);
    const arrivalValue = getCellValueAtColumn(row, columnNumber + 1);
    const alightingValue = getCellValueAtColumn(row, columnNumber + 2);
    const boardingValue = getCellValueAtColumn(row, columnNumber + 3);
    const departureValue = getCellValueAtColumn(row, columnNumber + 4);
    const waitingValue = getCellValueAtColumn(row, columnNumber + 5);

    if (
      !stopValue &&
      !arrivalValue &&
      !alightingValue &&
      !boardingValue &&
      !departureValue &&
      !waitingValue
    ) {
      continue;
    }

    const point =
      buildPointFromStopValue(stopValue, stopLookup) ??
      detailContext.boardingPoint ??
      detailContext.alightingPoint;

    if (!point) {
      continue;
    }

    const alighting = isNullValue(alightingValue)
      ? null
      : {
          tripNumber: detailContext.tripNumber,
          passengerNumber: detailContext.passengerNumber,
          rideType: detailContext.rideType,
          seatNumber: detailContext.seatNumber,
          boardingPoint: detailContext.boardingPoint,
          departure: detailContext.departure,
          stops: detailContext.stops,
          alightingPoint: detailContext.alightingPoint,
          arrival: detailContext.arrival,
        };
    const boarding = isNullValue(boardingValue)
      ? null
      : {
          tripNumber: detailContext.tripNumber,
          passengerNumber: detailContext.passengerNumber,
          rideType: detailContext.rideType,
          seatNumber: detailContext.seatNumber,
          boardingPoint: detailContext.boardingPoint,
          departure: detailContext.departure,
          stops: detailContext.stops,
          alightingPoint: detailContext.alightingPoint,
          arrival: detailContext.arrival,
        };

    route.push({
      point,
      alighting,
      boarding,
      waitingMinutes: parseNumber(waitingValue) ?? 0,
      departure: normalizeTimeValue(departureValue),
      arrival: normalizeTimeValue(arrivalValue),
    });
  }

  return route;
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
  const rows = getSheetRows(sheet).slice(1);
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
      "Trips_Summary",
      "Trips Summary",
      "Summary",
    ]);
    const ridesDetailsSheet = getWorksheetByName(workbook, [
      "Rides_Details",
      "Rides Details",
      "Trips_Details",
      "Trips Details",
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
    const summaryRows = getSheetRows(ridesSummarySheet).slice(1);
    const updatedTripIds: string[] = [];

    for (const row of summaryRows) {
      if (!row) continue;
      const rideIdValue = pickValue(row, summaryIndexes, [
        "Ride_ID",
        "RideID",
        "Trip_Number",
        "TripNumber",
        "TripID",
      ]);
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

      const driverIdValue = pickValue(row, summaryIndexes, [
        "Driver_ID",
        "DriverID",
        "DriverNo",
      ]);
      const totalPersonsValue = pickValue(row, summaryIndexes, [
        "Total_Pers",
        "TotalPersons",
      ]);
      const totalFeesValue = pickValue(row, summaryIndexes, [
        "Total_Fees",
        "TotalFees",
      ]);
      const firstStopValue = pickValue(row, summaryIndexes, [
        "First Stop",
        "FirstStop",
        "Origin",
      ]);
      const boardingValue = pickValue(row, summaryIndexes, [
        "Boarding",
        "BoardingCount",
      ]);
      const departureValue = pickValue(row, summaryIndexes, [
        "Departure",
        "Depart",
      ]);
      const lastStopValue = pickValue(row, summaryIndexes, [
        "Last Stop",
        "LastStop",
        "Destination",
      ]);
      const alightingValue = pickValue(row, summaryIndexes, [
        "Alighting",
        "AlightingCount",
      ]);
      const arrivalValue = pickValue(row, summaryIndexes, [
        "Arrival",
        "Arrive",
      ]);

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
      const detailsRows = getSheetRows(ridesDetailsSheet).slice(1);

      for (const row of detailsRows) {
        if (!row) continue;

        const availabilityNumberValue = pickValue(row, detailsIndexes, [
          "Trip_ID",
          "TripID",
          "Availability_ID",
          "AvailabilityID",
          "availabilityNumber",
        ]);
        const rideIdValue = pickValue(row, detailsIndexes, [
          "Ride_ID",
          "RideID",
          "Trip_Number",
          "TripNumber",
          "TripID",
        ]);
        if (!availabilityNumberValue || !rideIdValue) continue;

        const availabilityNumber = parseTripNumber(availabilityNumberValue);
        const tripNumber = parseTripNumber(rideIdValue);
        if (availabilityNumber == null || tripNumber == null) continue;

        const availability = await Availability.findOne({ availabilityNumber }).lean<{
          _id?: unknown;
          date?: string;
          matched?: boolean;
          status?: string;
        }>();

        const trip = await Trip.findOne({
          $or: [{ tripNumber }, { tripNumber: String(tripNumber) }],
        }).lean<{
          _id: unknown;
          tripNumber: number;
          userId?: unknown;
          summary?: Record<string, unknown> | null;
        }>();

        const driverNumberValue = pickValue(row, detailsIndexes, [
          "Driver_ID",
          "DriverID",
          "DriverNo",
        ]);
        const driverSummary = await getDriverSummaryByUserNumber(driverNumberValue);
        const driverUser = driverNumberValue
          ? await User.findOne({ userNumber: Number(driverNumberValue) }).select("_id").lean<{
              _id?: unknown;
            }>()
          : null;

        const driverDoc = driverUser?._id
          ? await Driver.findOne({ userId: driverUser._id }).select(
              "gender carBrand carModel carType modelYear vehicleColor carCapacity documents plateChar1 plateChar2 plateChar3 plateDigits",
            ).lean<{
              gender?: string;
              carBrand?: string;
              carModel?: string;
              carType?: string;
              modelYear?: number;
              vehicleColor?: string;
              carCapacity?: number;
              documents?: { profilePic?: string; carImage?: string };
              plateChar1?: string;
              plateChar2?: string;
              plateChar3?: string;
              plateDigits?: string;
            }>()
          : null;

        const route = buildRouteFromRow(row, detailsIndexes, stopLookup);
        const rideNumber = await nextSequence("rideNumber");
        const ride = await Ride.create({
          rideNumber,
          availabilityId: availability?._id ?? null,
          driverId: driverUser?._id ?? null,
          assignedDriver: driverSummary
            ? {
                name: driverSummary.name,
                phone: driverSummary.phone,
                profilePic: driverSummary.profilePicture,
                profilePicture: driverSummary.profilePicture,
                carBrand: driverSummary.carBrand,
                carModel: driverSummary.carModel,
                carType: driverSummary.carType,
                vehicleColor: driverSummary.vehicleColor,
                carCapacity: driverSummary.carCapacity,
                modelYear: driverSummary.modelYear,
                carImage: driverSummary.carImage,
                plate: [
                  driverDoc?.plateChar1,
                  driverDoc?.plateChar2,
                  driverDoc?.plateChar3,
                  driverDoc?.plateDigits,
                ]
                  .filter(Boolean)
                  .join(" "),
                plateChar1: driverDoc?.plateChar1,
                plateChar2: driverDoc?.plateChar2,
                plateChar3: driverDoc?.plateChar3,
                plateDigits: driverDoc?.plateDigits,
              }
            : null,
          date: availability?.date ?? "",
          rideType: normalizeRideType(
            pickValue(row, detailsIndexes, ["Ride_Type", "RideType", "VehicleType"]),
          ),
          vehicleType: normalizeVehicleType(
            pickValue(row, detailsIndexes, ["Car_Type", "CarType", "VehicleType"]),
          ),
          route,
          startTime: route[0]?.departure || normalizeTimeValue(getCellValue(row, detailsIndexes, "Departure")),
          endTime: route[route.length - 1]?.arrival || normalizeTimeValue(getCellValue(row, detailsIndexes, "Arrival")),
          passengers: [],
          totalCost: 0,
          status: "matched",
        });

        if (availability?._id) {
          await Availability.updateOne(
            { availabilityNumber },
            {
              $set: {
                matched: true,
                rideId: ride._id,
                status: "matched",
              },
            },
          );
        }

        if (trip) {
          await Trip.collection.updateOne(
            {
              $or: [{ tripNumber }, { tripNumber: String(tripNumber) }],
            },
            {
              $set: {
                rideId: ride._id,
                driverId: driverUser?._id ?? null,
                details: {
                  driver: driverSummary,
                  seatNumber: getCellValue(row, detailsIndexes, "Seat"),
                  pickupPoint: trip.summary?.pickupPoint ?? null,
                  departureTime: trip.summary?.departureTime ?? null,
                  dropoffPoint: trip.summary?.dropoffPoint ?? null,
                  arrivalTime: trip.summary?.arrivalTime ?? null,
                  stops: getCellValue(row, detailsIndexes, "Stops"),
                },
                status: "matched",
              },
            },
          );
        }

        if (trip?.userId) {
          const confirmedTime = normalizeTimeValue(
            getCellValue(row, detailsIndexes, "Arrival"),
          );
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

        updatedTripIds.push(String(tripNumber));
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
