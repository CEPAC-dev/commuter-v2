import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { nextSequence } from "@/models/Counter";
import { Driver } from "@/models/Driver";
import { Trip } from "@/models/Trip";
import { Ride } from "@/models/Ride";
import { User } from "@/models/User";
import { getDriverSummaryByUserNumber } from "@/lib/services/trips";
import { createNotification } from "@/lib/notifications/createNotification";
import { haversineKm } from "@/lib/geo/stations";

type ImportedTripRecord = {
  _id: unknown;
  tripNumber: number;
  userId?: unknown;
  summary?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
  date?: string;
  driverId?: unknown;
  numberOfPassengers?: number;
  priceEgp?: number | string;
  pickup?: unknown;
  dropoff?: unknown;
};

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

function findHeaderRow(
  sheet: ExcelJS.Worksheet,
  aliases: string[],
): { row: ExcelJS.Row; index: number; indexes: Map<string, number> } | null {
  const rows = getSheetRows(sheet);
  const normalizedAliases = aliases.map((alias) => normalizeHeader(alias));

  let bestMatch: {
    row: ExcelJS.Row;
    index: number;
    indexes: Map<string, number>;
    score: number;
  } | null = null;

  for (const [index, row] of rows
    .slice(0, Math.min(8, rows.length))
    .entries()) {
    const indexes = getHeaderIndexes(row);
    const score = Array.from(indexes.keys()).reduce((total, headerKey) => {
      const normalizedHeader = normalizeHeader(headerKey);
      const matched = normalizedAliases.some(
        (alias) =>
          normalizedHeader === alias ||
          normalizedHeader.includes(alias) ||
          alias.includes(normalizedHeader),
      );
      return matched ? total + 1 : total;
    }, 0);

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { row, index, indexes, score };
    }
  }

  if (bestMatch) {
    return {
      row: bestMatch.row,
      index: bestMatch.index,
      indexes: bestMatch.indexes,
    };
  }

  const firstRow = rows[0];
  return firstRow
    ? { row: firstRow, index: 0, indexes: getHeaderIndexes(firstRow) }
    : null;
}

function getCellText(cell: ExcelJS.Cell): string {
  const rawValue = cell.value;
  if (rawValue == null || rawValue === "") return "";

  if (rawValue instanceof Date) {
    return `${String(rawValue.getHours()).padStart(2, "0")}:${String(rawValue.getMinutes()).padStart(2, "0")}`;
  }

  if (typeof rawValue === "object") {
    const payload = rawValue as unknown as Record<string, unknown>;
    const candidate =
      payload.result ?? payload.text ?? payload.formula ?? payload.value;
    if (candidate != null && candidate !== "") {
      return String(candidate).trim();
    }
  }

  if (cell.result != null && cell.result !== "") {
    return String(cell.result).trim();
  }

  if (typeof rawValue === "string") {
    return rawValue.trim();
  }

  return String(rawValue).trim();
}

function getCellValue(
  row: ExcelJS.Row,
  indexes: Map<string, number>,
  header: string,
): string {
  const column = indexes.get(normalizeHeader(header));
  if (column == null) return "";
  return getCellText(row.getCell(column));
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

  const normalizedAliases = aliases.map((alias) => normalizeLookupKey(alias));
  for (const [header, column] of indexes.entries()) {
    const normalizedHeader = normalizeLookupKey(header);
    const matches = normalizedAliases.some((alias) =>
      normalizedHeader.includes(alias),
    );
    if (!matches) continue;
    const value = getCellText(row.getCell(column));
    if (!value) continue;
    return value;
  }

  return "";
}

function parseNumber(value: string): number | null {
  if (!value) return null;
  const cleaned = value
    .trim()
    .replace(/[^0-9.+-]/g, "")
    .replace(/(?!^)-/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
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
  return (
    normalized === "" ||
    normalized === "-" ||
    normalized === "0" ||
    normalized === "null"
  );
}

function getCellValueAtColumn(row: ExcelJS.Row, columnNumber: number): string {
  return getCellText(row.getCell(columnNumber));
}

type StopLookupEntry = {
  lat: number;
  lng: number;
  address: string;
  id?: number;
  name?: string;
};

function buildPointFromStopValue(
  stopValue: string,
  stopLookup: Map<string, StopLookupEntry>,
) {
  if (!stopValue) return null;
  const point = stopLookup.get(normalizeLookupKey(stopValue));
  if (!point) {
    return {
      lat: 0,
      lng: 0,
      address: stopValue,
    };
  }
  return {
    lat: point.lat,
    lng: point.lng,
    address: point.address || stopValue,
  };
}

function buildStationFromStopValue(
  stopValue: string,
  stopLookup: Map<string, StopLookupEntry>,
) {
  if (!stopValue) return null;
  const entry = stopLookup.get(normalizeLookupKey(stopValue));
  console.log("[buildStationFromStopValue] stopValue", { stopValue, entry });
  const resolvedName = entry?.name || entry?.address || stopValue || "Unknown";
  const resolvedAddress = entry?.address || stopValue || resolvedName;
  if (!entry) {
    return {
      id: 0,
      lat: 0,
      lng: 0,
      address: resolvedAddress,
      name: resolvedName,
    };
  }
  return {
    id: entry.id ?? 0,
    lat: entry.lat,
    lng: entry.lng,
    address: resolvedAddress,
    name: resolvedName,
  };
}

function buildRideDetailContext(
  row: ExcelJS.Row,
  indexes: Map<string, number>,
  stopLookup: Map<string, StopLookupEntry>,
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

type RouteStop = {
  point: { lat: number; lng: number; address: string } | null;
  alighting: number;
  boarding: number;
  waitingMinutes?: number;
};

function splitTripRefs(raw: string): number[] {
  if (!raw) return [];

  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part))
    .filter((value) => Number.isInteger(value));
}

function pointKey(
  point: { lat: number; lng: number; address: string } | null | undefined,
): string | null {
  if (!point) return null;
  return `${point.lat.toFixed(6)}:${point.lng.toFixed(6)}:${(point.address || "").trim().toLowerCase()}`;
}

function upsertRouteStop(
  route: RouteStop[],
  point: { lat: number; lng: number; address: string } | null,
  boardingCount: number,
  alightingCount: number,
  waitingMinutes?: number,
) {
  if (!point) return;

  const key = pointKey(point);
  if (!key) return;

  const existingIndex = route.findIndex((stop) => pointKey(stop.point) === key);
  if (existingIndex >= 0) {
    const existing = route[existingIndex];
    if (!existing) return;
    existing.boarding += boardingCount;
    existing.alighting += alightingCount;
    if (waitingMinutes != null && existing.waitingMinutes == null) {
      existing.waitingMinutes = waitingMinutes;
    }
    return;
  }

  route.push({
    point,
    boarding: boardingCount,
    alighting: alightingCount,
    waitingMinutes: waitingMinutes ?? 0,
  });
}

function buildRouteFromRow(
  row: ExcelJS.Row,
  indexes: Map<string, number>,
  stopLookup: Map<string, StopLookupEntry>,
  boardingTripNumbers: number[],
  alightingTripNumbers: number[],
) {
  const detailContext = buildRideDetailContext(row, indexes, stopLookup);
  const route: RouteStop[] = [];

  const waitingValue = pickValue(row, indexes, [
    "Waiting_Time",
    "WaitingTime",
    "wait",
    "Wait",
    "waiting",
  ]);

  const stopCandidates = Array.from(indexes.entries())
    .filter(([header]) => {
      const normalizedHeader = normalizeLookupKey(header);
      return (
        normalizedHeader.includes("stop") ||
        normalizedHeader.includes("station") ||
        normalizedHeader.includes("location")
      );
    })
    .sort((a, b) => a[1] - b[1]);

  const seenStopValues = new Set<string>();
  for (const [header, column] of stopCandidates) {
    const rawValue = getCellText(row.getCell(column));
    if (!rawValue || isNullValue(rawValue)) continue;

    const stopValues = rawValue
      .split(/[;,]/)
      .map((part) => part.trim())
      .filter(Boolean);

    for (const stopValue of stopValues) {
      const key = normalizeLookupKey(stopValue);
      if (!key || seenStopValues.has(key)) continue;
      seenStopValues.add(key);

      const point = buildPointFromStopValue(stopValue, stopLookup) ??
        detailContext.boardingPoint ??
        detailContext.alightingPoint;
      if (!point) continue;

      const boardingCount =
        header.toLowerCase().includes("alight") || header.toLowerCase().includes("drop")
          ? 0
          : boardingTripNumbers.length > 0 ? boardingTripNumbers.length : 1;
      const alightingCount =
        header.toLowerCase().includes("alight") || header.toLowerCase().includes("drop")
          ? alightingTripNumbers.length > 0 ? alightingTripNumbers.length : 1
          : 0;

      upsertRouteStop(
        route,
        point,
        boardingCount,
        alightingCount,
        parseNumber(waitingValue) ?? undefined,
      );
    }
  }

  return route;
}

function calculateRouteDistanceKm(
  route: Array<{
    point: { lat: number; lng: number; address: string } | null;
    alighting: number;
    boarding: number;
  }>,
): number {
  return route.slice(1).reduce((distance, stop, index) => {
    const previousPoint = route[index]?.point;
    const currentPoint = stop.point;
    if (!previousPoint || !currentPoint) return distance;
    return (
      distance +
      haversineKm(
        previousPoint.lat,
        previousPoint.lng,
        currentPoint.lat,
        currentPoint.lng,
      )
    );
  }, 0);
}

function calculateMaxLoad(
  route: Array<{ boarding: number; alighting: number }>,
): number {
  let passengersOnBoard = 0;
  let maxLoad = 0;

  for (const stop of route) {
    passengersOnBoard = Math.max(0, passengersOnBoard - stop.alighting);
    passengersOnBoard += stop.boarding;
    maxLoad = Math.max(maxLoad, passengersOnBoard);
  }

  return maxLoad;
}

function resolvePassengerPoint(
  point: { lat: number; lng: number; address: string; id?: number; name?: string } | null,
  route: RouteStop[],
  role: "pickup" | "dropoff",
) {
  if (point) return point;
  const fallbackPoint =
    role === "pickup" ? route[0]?.point ?? null : route[route.length - 1]?.point ?? null;
  return fallbackPoint;
}

function resolvePassengerOrder(
  point: { lat: number; lng: number; address: string; id?: number; name?: string } | null,
  route: RouteStop[],
  routeIndexByPointKey: Map<string, number>,
  role: "pickup" | "dropoff",
): number {
  if (!point) {
    return role === "dropoff" ? Math.max(0, route.length - 1) : 0;
  }

  const pointKeyValue = pointKey(point as { lat: number; lng: number; address: string } | null);
  if (pointKeyValue != null) {
    const exactOrder = routeIndexByPointKey.get(pointKeyValue);
    if (exactOrder != null) {
      return exactOrder;
    }
  }

  const firstRoutePoint = route[0]?.point;
  const lastRoutePoint = route[route.length - 1]?.point;
  const firstKey = pointKey(firstRoutePoint);
  const lastKey = pointKey(lastRoutePoint);
  if (pointKeyValue && firstKey && pointKeyValue === firstKey) {
    return 0;
  }
  if (pointKeyValue && lastKey && pointKeyValue === lastKey) {
    return Math.max(0, route.length - 1);
  }

  return role === "dropoff" ? Math.max(0, route.length - 1) : 0;
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
  const map = new Map<string, StopLookupEntry>();

  for (const row of rows) {
    if (!row) continue;
    const point = parsePointFromStopRow(row, indexes);
    if (!point) continue;

    const stopName = pickValue(row, indexes, [
      "Stop",
      "Station",
      "StationName",
      "Name",
      "StopName",
      "StationNameEn",
      "StationNameAr",
      "Address",
    ]);

    const entry: StopLookupEntry = {
      ...point,
      id:
        parseNumber(
          pickValue(row, indexes, ["id", "stopid", "stationid", "station_id"]),
        ) ?? undefined,
      name: stopName || point.address || "",
    };

    if (stopName || entry.address) {
      map.set(normalizeLookupKey(stopName || entry.address), entry);
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

    const tripsSummarySheet = getWorksheetByName(workbook, [
      "Trips_Summary",
      "Trips Summary",
      "Rides_Summary",
      "Rides Summary",
      "Summary",
    ]);
    const tripsDetailsSheet = getWorksheetByName(workbook, [
      "Trips_Details",
      "Trips Details",
      "Rides_Details",
      "Rides Details",
      "Details",
    ]);
    const ridesSummarySheet = tripsSummarySheet;
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
    const summaryHeader = findHeaderRow(tripsSummarySheet, [
      "Ride_ID",
      "Trip_Number",
      "TripID",
      "Total_Pers",
      "Trip_Dist",
      "NumberOfTrips",
      "Max Load",
      "NumberOfStops",
      "First Stop",
      "Last Stop",
      "Departure",
      "Arrival",
    ]);
    const summaryHeaderRow = summaryHeader?.row ?? tripsSummarySheet.getRow(1);
    const summaryIndexes =
      summaryHeader?.indexes ?? getHeaderIndexes(summaryHeaderRow);
    const summaryRows = getSheetRows(tripsSummarySheet).filter(
      (row) => row.number > summaryHeaderRow.number,
    );
    const updatedTripIds: string[] = [];
    const summaryByTripNumber = new Map<number, Record<string, unknown>>();

    console.log("[addMatchedData] summary header", {
      rowNumber: summaryHeaderRow.number,
      headers: Array.from(summaryIndexes.entries()),
      dataRowNumbers: summaryRows.map((row) => row.number),
    });

    for (const row of summaryRows) {
      if (!row) continue;
      const rideIdValue = pickValue(row, summaryIndexes, [
        "Ride_ID",
        "RideID",
        "Trip_Number",
        "TripNumber",
        "TripID",
        "TripNo",
        "RideNo",
        "TripNo.",
        "RideNo.",
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

      const driverIdValue = pickValue(row, summaryIndexes, [
        "Driver_ID",
        "DriverID",
        "DriverNo",
      ]);
      const totalPersonsValue = pickValue(row, summaryIndexes, [
        "Total_Pers",
        "TotalPersons",
        "Total_Pax",
        "Passengers",
        "Persons",
        "NoOfPassengers",
        "PassengerCount",
        "No_Passengers",
        "NumberOfPersons",
      ]);
      const totalFeesValue = pickValue(row, summaryIndexes, [
        "Trip_Fees",
        "TripFees",
        "TripFee",
        "Total_Fees",
        "TotalFees",
        "TotalFee",
        "Fees",
        "Amount",
        "Amount_EGP",
        "Price",
        "TotalAmount",
        "NetAmount",
      ]);
      const totalDistanceValue = pickValue(row, summaryIndexes, [
        "Trip_Dist",
        "TripDist",
        "TripDistance",
        "Total_Distance",
        "TotalDistance",
        "Distance",
        "Dist",
        "DistanceKm",
        "Distance_Km",
        "Distance_KM",
        "DistKm",
      ]);
      const numberOfTripsValue = pickValue(row, summaryIndexes, [
        "Rides",
        "rides",
        "NumberOfTrips",
        "Trips",
        "TripCount",
        "NoOfTrips",
        "TripsCount",
        "No_Trips",
      ]);
      const maxLoadValue = pickValue(row, summaryIndexes, [
        "Max Load",
        "MaxLoad",
        "maxload",
        "Max_Load",
        "MaxLoadValue",
        "Load",
        "Capacity",
        "MaxCapacity",
      ]);
      const numberOfStopsValue = pickValue(row, summaryIndexes, [
        "Stops",
        "stops",
        "NumberOfStops",
        "StopCount",
        "NoOfStops",
        "No_Stops",
        "StopsCount",
      ]);
      const firstStopValue = pickValue(row, summaryIndexes, [
        "First Stop",
        "FirstStop",
        "Origin",
        "Pickup",
        "PickUp",
        "StartPoint",
        "From",
        "BoardingPoint",
      ]);
      const boardingValue = pickValue(row, summaryIndexes, [
        "Boarding",
        "BoardingCount",
        "Board",
        "PassengersBoarding",
      ]);
      const departureValue = pickValue(row, summaryIndexes, [
        "Departure",
        "Depart",
        "StartTime",
        "PickupTime",
        "DepTime",
        "Dep",
      ]);
      const lastStopValue = pickValue(row, summaryIndexes, [
        "Last Stop",
        "LastStop",
        "Destination",
        "Dropoff",
        "DropOff",
        "EndPoint",
        "To",
        "AlightPoint",
      ]);
      const alightingValue = pickValue(row, summaryIndexes, [
        "Alighting",
        "AlightingCount",
        "Alight",
        "AlightCount",
        "Disembarking",
        "DropOffCount",
      ]);
      const arrivalValue = pickValue(row, summaryIndexes, [
        "Arrival",
        "Arrive",
        "EndTime",
        "DropoffTime",
        "ArriveTime",
        "AlightTime",
      ]);

      const driverSummary = await getDriverSummaryByUserNumber(driverIdValue);
      const pickUpStopPoint = stopLookup.get(
        normalizeLookupKey(firstStopValue),
      );
      const dropOffStopPoint = stopLookup.get(
        normalizeLookupKey(lastStopValue),
      );

      const firstStop = buildStationFromStopValue(firstStopValue, stopLookup);
      const lastStop = buildStationFromStopValue(lastStopValue, stopLookup);

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
      const rideSummary = {
        totalFees: Math.round(parseNumber(totalFeesValue) ?? 0),
        totalPersons: parseNumber(totalPersonsValue),
        boarding: parseNumber(boardingValue),
        alighting: parseNumber(alightingValue),
        totalDistance: Math.round(parseNumber(totalDistanceValue) ?? 0),
        numberOfTrips: Math.round(parseNumber(numberOfTripsValue) ?? 0),
        maxLoad: Math.round(parseNumber(maxLoadValue) ?? 0),
        numberOfStops: Math.round(parseNumber(numberOfStopsValue) ?? 0),
        firstStop,
        departure: normalizeTimeValue(departureValue),
        lastStop,
        arrival: normalizeTimeValue(arrivalValue),
      };

      console.log("[addMatchedData] summary row", {
        rowNumber: row.number,
        tripNumber,
        values: {
          totalFeesValue,
          totalPersonsValue,
          totalDistanceValue,
          numberOfTripsValue,
          maxLoadValue,
          numberOfStopsValue,
          boardingValue,
          alightingValue,
        },
        rideSummary,
        foundTrip: Boolean(trip),
      });

      summaryByTripNumber.set(tripNumber, rideSummary);
      if (trip) {
        await Trip.collection.updateOne({ tripNumber }, { $set: { summary } });
        updatedTripIds.push(String(trip.tripNumber));
      }
    }

    if (tripsDetailsSheet) {
      const detailsHeader = findHeaderRow(tripsDetailsSheet, [
        "Ride_ID",
        "Trip_Number",
        "TripID",
        "Availability_ID",
        "Driver_ID",
        "Board_Stop",
        "Alight_Stop",
        "Departure",
        "Arrival",
        "Seat",
        "Stops",
      ]);
      const detailsHeaderRow =
        detailsHeader?.row ?? tripsDetailsSheet.getRow(1);
      const detailsIndexes =
        detailsHeader?.indexes ?? getHeaderIndexes(detailsHeaderRow);
      const detailsHeaders = detailsHeaderRow.values
        ? (detailsHeaderRow.values as unknown[])
            .slice(1)
            .filter((value) => value != null)
            .map((value) => String(value))
        : [];
      const detailsRows = getSheetRows(tripsDetailsSheet).filter(
        (row) => row.number > detailsHeaderRow.number,
      );
      console.log("[addMatchedData] details header", {
        rowNumber: detailsHeaderRow.number,
        headers: detailsHeaders,
        indexes: Array.from(detailsIndexes.entries()),
        dataRowNumbers: detailsRows.map((row) => row.number),
      });
      const tripPassengerLookup = new Map<number, number | null>();
      for (const row of detailsRows) {
        const rideIdValue = pickValue(row, detailsIndexes, [
          "Ride_ID",
          "RideID",
          "Trip_Number",
          "TripNumber",
          "TripID",
        ]);
        const tripNumber = parseTripNumber(rideIdValue);
        if (tripNumber == null) continue;
        const passengerNumber = parseNumber(
          pickValue(row, detailsIndexes, [
            "Pass_ID",
            "Passenger_ID",
            "PassengerNumber",
            "User_Number",
            "UserNumber",
          ]),
        );
        tripPassengerLookup.set(tripNumber, passengerNumber ?? null);
      }

      const detailEntries: Array<{
        availabilityNumber: number;
        tripNumber: number;
        trip: ImportedTripRecord | null;
        driverSummary: Awaited<ReturnType<typeof getDriverSummaryByUserNumber>>;
        driverUser: { _id?: unknown } | null;
        driverDoc: Record<string, unknown> | null;
        row: ExcelJS.Row;
        routeChunk: RouteStop[];
        boardTripNumbers: number[];
        alightTripNumbers: number[];
        sourceRowNumber: number;
        departureTime: string;
        arrivalTime: string;
        rideType: "private" | "shared";
        vehicleType: string;
        totalCost: number;
        passengerCount: number;
        rideSummary: Record<string, unknown> | null;
        pickupStation: ReturnType<typeof buildStationFromStopValue>;
        dropoffStation: ReturnType<typeof buildStationFromStopValue>;
      }> = [];

      for (const row of detailsRows) {
        if (!row) continue;

        const rideIdValue = pickValue(row, detailsIndexes, [
          "Ride_ID",
          "RideID",
          "Trip_Number",
          "TripNumber",
          "TripID",
        ]);
        const availabilityNumberValue =
          pickValue(row, detailsIndexes, [
            "Trip_ID",
            "TripID",
            "Availability_ID",
            "AvailabilityID",
            "availabilityNumber",
            "AvailabilityNumber",
            "AvailabilityNo",
            "Availability_No",
            "Ride_ID",
            "RideID",
            "Trip_Number",
            "TripNumber",
            "TripID",
          ]) || rideIdValue;
        if (!availabilityNumberValue || !rideIdValue) {
          console.log("[addMatchedData] details row skipped", {
            rowNumber: row.number,
            reason: "missing Ride_ID or availability ID",
            rideIdValue,
            availabilityNumberValue,
          });
          continue;
        }

        const availabilityNumber = parseTripNumber(availabilityNumberValue);
        const tripNumber = parseTripNumber(rideIdValue);
        if (availabilityNumber == null || tripNumber == null) {
          console.log("[addMatchedData] details row skipped", {
            rowNumber: row.number,
            reason: "invalid numeric ID",
            rideIdValue,
            availabilityNumberValue,
          });
          continue;
        }

        const trip = await Trip.findOne({
          $or: [{ tripNumber }, { tripNumber: String(tripNumber) }],
        }).lean<ImportedTripRecord>();

        const driverNumberValue = pickValue(row, detailsIndexes, [
          "Driver_ID",
          "DriverID",
          "DriverNo",
        ]);
        const driverSummary =
          await getDriverSummaryByUserNumber(driverNumberValue);
        const driverUser = driverNumberValue
          ? await User.findOne({ userNumber: Number(driverNumberValue) })
              .select("_id")
              .lean<{
                _id?: unknown;
              }>()
          : null;

        const driverDoc = driverUser?._id
          ? await Driver.findOne({ userId: driverUser._id })
              .select(
                "gender carBrand carModel carType modelYear vehicleColor carCapacity documents plateChar1 plateChar2 plateChar3 plateDigits",
              )
              .lean<{
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

        const departureTime = normalizeTimeValue(
          getCellValue(row, detailsIndexes, "Departure"),
        );
        const arrivalTime = normalizeTimeValue(
          getCellValue(row, detailsIndexes, "Arrival"),
        );
        const tripSummary = (trip?.summary ?? {}) as Record<string, unknown>;
        const passengerCount = Math.max(
          1,
          Number(trip?.numberOfPassengers ?? tripSummary.totalPersons ?? 1),
        );
        const totalCost = Math.max(
          0,
          Number(trip?.priceEgp ?? tripSummary.totalFees ?? 0) || 0,
        );
        const boardingTripNumbers = splitTripRefs(
          pickValue(row, detailsIndexes, [
            "Boarding",
            "BoardingValue",
            "BoardingRef",
            "Boarding_Ref",
            "Board",
            "BoardingTrips",
          ]),
        );
        const alightingTripNumbers = splitTripRefs(
          pickValue(row, detailsIndexes, [
            "Alighting",
            "AlightingValue",
            "AlightingRef",
            "Alighting_Ref",
            "Alight",
            "AlightingTrips",
          ]),
        );
        const routeChunk = buildRouteFromRow(
          row,
          detailsIndexes,
          stopLookup,
          boardingTripNumbers,
          alightingTripNumbers,
        );
        const pickupStation = buildStationFromStopValue(
          pickValue(row, detailsIndexes, [
            "Board_Stop",
            "BoardStop",
            "BoardingStop",
            "Pickup_Stop",
            "PickupStop",
            "Origin",
            "StartStop",
          ]),
          stopLookup,
        );
        const dropoffStation = buildStationFromStopValue(
          pickValue(row, detailsIndexes, [
            "Alight_Stop",
            "AlightStop",
            "AlightingStop",
            "Dropoff_Stop",
            "DropOff_Stop",
            "Destination",
            "EndStop",
          ]),
          stopLookup,
        );

        detailEntries.push({
          availabilityNumber,
          tripNumber,
          trip,
          driverSummary,
          driverUser,
          driverDoc,
          row,
          routeChunk,
          boardTripNumbers: boardingTripNumbers,
          alightTripNumbers: alightingTripNumbers,
          sourceRowNumber: row.number,
          departureTime,
          arrivalTime,
          rideType: normalizeRideType(
            pickValue(row, detailsIndexes, [
              "Ride_Type",
              "RideType",
              "VehicleType",
            ]),
          ),
          vehicleType: normalizeVehicleType(
            pickValue(row, detailsIndexes, [
              "Car_Type",
              "CarType",
              "VehicleType",
            ]),
          ),
          totalCost,
          passengerCount,
          rideSummary: summaryByTripNumber.get(tripNumber) ?? null,
          pickupStation,
          dropoffStation,
        });

        console.log("[addMatchedData] details row", {
          rowNumber: row.number,
          rideId: tripNumber,
          availabilityNumber,
          boardStop: getCellValue(row, detailsIndexes, "Board_Stop"),
          alightStop: getCellValue(row, detailsIndexes, "Alight_Stop"),
          seat: getCellValue(row, detailsIndexes, "Seat"),
          stops: getCellValue(row, detailsIndexes, "Stops"),
          boardingTripNumbers,
          alightingTripNumbers,
          cells: Object.fromEntries(
            Array.from(detailsIndexes.entries()).map(([header, column]) => [
              header,
              getCellValueAtColumn(row, column),
            ]),
          ),
          routeChunk,
        });
      }

      const groupedEntries = new Map<
        number,
        (typeof detailEntries)[number][]
      >();
      for (const entry of detailEntries) {
        const group = groupedEntries.get(entry.tripNumber) ?? [];
        group.push(entry);
        groupedEntries.set(entry.tripNumber, group);
      }

      for (const [rideId, entries] of groupedEntries.entries()) {
        const firstEntry = entries[0];
        if (!firstEntry) continue;

        console.log("[addMatchedData] ride group", {
          rideId,
          sourceRows: entries.map((entry) => entry.sourceRowNumber),
          availabilityNumbers: entries.map((entry) => entry.availabilityNumber),
        });

        const rideNumber = await nextSequence("rideNumber");
        const route = entries.reduce<RouteStop[]>((accumulator, entry) => {
          for (const stop of entry.routeChunk) {
            const key = pointKey(stop.point);
            if (!key) continue;
            const existingIndex = accumulator.findIndex(
              (routeStop) => pointKey(routeStop.point) === key,
            );
            if (existingIndex >= 0) {
              const existing = accumulator[existingIndex];
              if (existing) {
                existing.boarding += stop.boarding;
                existing.alighting += stop.alighting;
              }
            } else {
              accumulator.push({ ...stop });
            }
          }
          return accumulator;
        }, []);

        const routeIndexByPointKey = new Map(
          route
            .map((stop, index) => [pointKey(stop.point), index] as const)
            .filter((entry): entry is [string, number] => entry[0] != null),
        );

        const passengers: Array<Record<string, unknown>> = [];
        const passengerIndexByTripNumber = new Map<number, number>();

        for (const entry of entries) {
          const boardPointKey = pointKey(
            entry.pickupStation as {
              lat: number;
              lng: number;
              address: string;
            } | null,
          );
          const alightPointKey = pointKey(
            entry.dropoffStation as {
              lat: number;
              lng: number;
              address: string;
            } | null,
          );
          // keep these keys for future use / debugging only
          void boardPointKey;
          void alightPointKey;

          const boardTripIds =
            entry.boardTripNumbers.length > 0
              ? entry.boardTripNumbers
              : entry.tripNumber != null &&
                (tripPassengerLookup.get(entry.tripNumber) != null ||
                  entry.trip?.userId != null)
                ? [entry.tripNumber]
                : [];
          for (const tripNumber of boardTripIds) {
            const existingPassengerIndex =
              passengerIndexByTripNumber.get(tripNumber);
            if (existingPassengerIndex != null) {
              const existingPassenger = passengers[existingPassengerIndex];
              if (existingPassenger) {
                existingPassenger.pickupOrder = resolvePassengerOrder(
                  entry.pickupStation as { lat: number; lng: number; address: string } | null,
                  route,
                  routeIndexByPointKey,
                  "pickup",
                );
              }
              continue;
            }

            const resolvedTrip = await Trip.findOne({
              $or: [{ tripNumber }, { tripNumber: String(tripNumber) }],
            }).lean<ImportedTripRecord>();
            const resolvedTripRecord = resolvedTrip ?? entry.trip ?? null;
            const passengerNumber = tripPassengerLookup.get(tripNumber) ?? null;
            const passengerUser =
              passengerNumber != null
                ? await User.findOne({ userNumber: passengerNumber })
                    .select("_id userNumber")
                    .lean<{ _id?: unknown; userNumber?: number }>()
                : null;
            const passengerPickupPoint = resolvePassengerPoint(
              (entry.pickupStation as
                | { lat: number; lng: number; address: string; id?: number; name?: string }
                | null) ??
              ((entry.rideSummary?.firstStop as
                | { lat: number; lng: number; address: string; id?: number; name?: string }
                | null) ?? null),
              route,
              "pickup",
            );
            const passengerDropoffPoint = resolvePassengerPoint(
              (entry.dropoffStation as
                | { lat: number; lng: number; address: string; id?: number; name?: string }
                | null) ??
              ((entry.rideSummary?.lastStop as
                | { lat: number; lng: number; address: string; id?: number; name?: string }
                | null) ?? null),
              route,
              "dropoff",
            );
            const passengerPickupOrder = resolvePassengerOrder(
              passengerPickupPoint,
              route,
              routeIndexByPointKey,
              "pickup",
            );
            const passengerDropoffOrder = resolvePassengerOrder(
              passengerDropoffPoint,
              route,
              routeIndexByPointKey,
              "dropoff",
            );
            const fallbackTripId =
              (resolvedTripRecord?._id as unknown) ??
              (entry.trip?._id as unknown) ??
              null;
            const fallbackUserId =
              (passengerUser?._id as unknown) ??
              (resolvedTripRecord?.userId as unknown) ??
              (entry.trip?.userId as unknown) ??
              null;
            const passengerEntry = {
              tripId: fallbackTripId,
              tripNumber,
              userId: fallbackUserId,
              userNumber: passengerUser?.userNumber ?? passengerNumber ?? null,
              pickup: passengerPickupPoint ?? null,
              dropoff: passengerDropoffPoint ?? null,
              pickupOrder: passengerPickupOrder,
              dropoffOrder: passengerDropoffOrder,
              numberOfPassengers: entry.passengerCount,
              tripCost: entry.totalCost,
              pickupStation: passengerPickupPoint ?? null,
              dropoffStation: passengerDropoffPoint ?? null,
              seatNumbers: [],
              status: "waiting",
            };
            passengerIndexByTripNumber.set(tripNumber, passengers.length);
            passengers.push(passengerEntry);
          }

          const alightTripIds =
            entry.alightTripNumbers.length > 0
              ? entry.alightTripNumbers
              : entry.tripNumber != null &&
                (tripPassengerLookup.get(entry.tripNumber) != null ||
                  entry.trip?.userId != null)
                ? [entry.tripNumber]
                : [];
          for (const tripNumber of alightTripIds) {
            const existingPassengerIndex =
              passengerIndexByTripNumber.get(tripNumber);
            if (existingPassengerIndex != null) {
              const existingPassenger = passengers[existingPassengerIndex];
              if (existingPassenger) {
                existingPassenger.dropoffOrder = resolvePassengerOrder(
                  entry.dropoffStation as { lat: number; lng: number; address: string } | null,
                  route,
                  routeIndexByPointKey,
                  "dropoff",
                );
              }
              continue;
            }

            const resolvedTrip = await Trip.findOne({
              $or: [{ tripNumber }, { tripNumber: String(tripNumber) }],
            }).lean<ImportedTripRecord>();
            const resolvedTripRecord = resolvedTrip ?? entry.trip ?? null;
            const passengerNumber = tripPassengerLookup.get(tripNumber) ?? null;
            const passengerUser =
              passengerNumber != null
                ? await User.findOne({ userNumber: passengerNumber })
                    .select("_id userNumber")
                    .lean<{ _id?: unknown; userNumber?: number }>()
                : null;
            const passengerPickupPoint = resolvePassengerPoint(
              (entry.pickupStation as
                | { lat: number; lng: number; address: string; id?: number; name?: string }
                | null) ??
              ((entry.rideSummary?.firstStop as
                | { lat: number; lng: number; address: string; id?: number; name?: string }
                | null) ?? null),
              route,
              "pickup",
            );
            const passengerDropoffPoint = resolvePassengerPoint(
              (entry.dropoffStation as
                | { lat: number; lng: number; address: string; id?: number; name?: string }
                | null) ??
              ((entry.rideSummary?.lastStop as
                | { lat: number; lng: number; address: string; id?: number; name?: string }
                | null) ?? null),
              route,
              "dropoff",
            );
            const passengerPickupOrder = resolvePassengerOrder(
              passengerPickupPoint,
              route,
              routeIndexByPointKey,
              "pickup",
            );
            const passengerDropoffOrder = resolvePassengerOrder(
              passengerDropoffPoint,
              route,
              routeIndexByPointKey,
              "dropoff",
            );
            const fallbackTripId =
              (resolvedTripRecord?._id as unknown) ??
              (entry.trip?._id as unknown) ??
              null;
            const fallbackUserId =
              (passengerUser?._id as unknown) ??
              (resolvedTripRecord?.userId as unknown) ??
              (entry.trip?.userId as unknown) ??
              null;
            const passengerEntry = {
              tripId: fallbackTripId,
              tripNumber,
              userId: fallbackUserId,
              userNumber: passengerUser?.userNumber ?? passengerNumber ?? null,
              pickup: passengerPickupPoint ?? null,
              dropoff: passengerDropoffPoint ?? null,
              pickupOrder: passengerPickupOrder,
              dropoffOrder: passengerDropoffOrder,
              numberOfPassengers: entry.passengerCount,
              tripCost: entry.totalCost,
              pickupStation: passengerPickupPoint ?? null,
              dropoffStation: passengerDropoffPoint ?? null,
              seatNumbers: [],
              status: "waiting",
            };
            passengerIndexByTripNumber.set(tripNumber, passengers.length);
            passengers.push(passengerEntry);
          }
        }
        const pickupStation = passengers[0]?.pickupStation ?? null;
        const dropoffStation =
          passengers[passengers.length - 1]?.dropoffStation ?? null;
        const totalCost = passengers.reduce(
          (sum, passenger) => sum + Number(passenger.tripCost || 0),
          0,
        );
        const rideSummary =
          entries.find((entry) => entry.rideSummary)?.rideSummary ?? null;
        const calculatedDistance = calculateRouteDistanceKm(route);
        const calculatedMaxLoad = calculateMaxLoad(route);
        const summary = rideSummary
          ? {
              ...rideSummary,
              totalDistance:
                Number(rideSummary.totalDistance) > 0
                  ? rideSummary.totalDistance
                  : Math.round(calculatedDistance * 100) / 100,
              numberOfTrips:
                Number(rideSummary.numberOfTrips) > 0
                  ? rideSummary.numberOfTrips
                  : entries.length,
              maxLoad:
                Number(rideSummary.maxLoad) > 0
                  ? rideSummary.maxLoad
                  : calculatedMaxLoad,
              numberOfStops:
                Number(rideSummary.numberOfStops) > 0
                  ? rideSummary.numberOfStops
                  : route.length,
            }
          : null;
        console.log("[addMatchedData] ride route", {
          rideId,
          route: route.map((stop) => ({
            address: stop.point?.address ?? null,
            boarding: stop.boarding,
            alighting: stop.alighting,
          })),
          summary,
        });
        const availabilityNumber = firstEntry.availabilityNumber;
        const availability = await Availability.findOne({
          availabilityNumber,
        }).lean<{
          _id?: unknown;
          date?: string;
          matched?: boolean;
          status?: string;
        }>();
        const availabilityLookup =
          availability ??
          (firstEntry.driverUser?._id || firstEntry.trip?.driverId
            ? await Availability.findOne({
                driverId: firstEntry.driverUser?._id ?? firstEntry.trip?.driverId,
                date: firstEntry.trip?.date ?? "",
              }).lean<{
                _id?: unknown;
                date?: string;
                matched?: boolean;
                status?: string;
              }>()
            : null);

        const insertedRide = await Ride.create({
          rideNumber,
          availabilityId: availabilityLookup?._id ?? availability?._id ?? null,
          driverId: firstEntry.driverUser?._id ?? null,
          assignedDriver: firstEntry.driverSummary
            ? {
                name: firstEntry.driverSummary.name,
                phone: firstEntry.driverSummary.phone,
                profilePic: firstEntry.driverSummary.profilePicture,
                profilePicture: firstEntry.driverSummary.profilePicture,
                carBrand: firstEntry.driverSummary.carBrand,
                carModel: firstEntry.driverSummary.carModel,
                carType: firstEntry.driverSummary.carType,
                vehicleColor: firstEntry.driverSummary.vehicleColor,
                carCapacity: firstEntry.driverSummary.carCapacity,
                modelYear: firstEntry.driverSummary.modelYear,
                carImage: firstEntry.driverSummary.carImage,
                plate: [
                  firstEntry.driverDoc?.plateChar1,
                  firstEntry.driverDoc?.plateChar2,
                  firstEntry.driverDoc?.plateChar3,
                  firstEntry.driverDoc?.plateDigits,
                ]
                  .filter(Boolean)
                  .join(" "),
                plateChar1: firstEntry.driverDoc?.plateChar1,
                plateChar2: firstEntry.driverDoc?.plateChar2,
                plateChar3: firstEntry.driverDoc?.plateChar3,
                plateDigits: firstEntry.driverDoc?.plateDigits,
              }
            : null,
          date:
            firstEntry.trip?.date ??
            availabilityLookup?.date ??
            availability?.date ??
            "",
          rideType: firstEntry.rideType,
          vehicleType: firstEntry.vehicleType,
          route,
          pickupStation,
          dropoffStation,
          startTime: firstEntry.departureTime || "00:00",
          endTime: firstEntry.arrivalTime || "00:00",
          passengers,
          totalCost,
          summary,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        for (const entry of entries) {
          if (!entry.trip) continue;
          const tripSummary = (entry.trip.summary ?? {}) as Record<
            string,
            unknown
          >;
          const confirmedTime = normalizeTimeValue(
            getCellValue(entry.row, detailsIndexes, "Arrival"),
          );
          await Availability.updateOne(
            { _id: availabilityLookup?._id ?? availability?._id },
            {
              $set: {
                matched: true,
                rideId: insertedRide._id,
                status: "matched",
              },
            },
          );
          await Trip.collection.updateOne(
            {
              $or: [
                { tripNumber: entry.tripNumber },
                { tripNumber: String(entry.tripNumber) },
              ],
            },
            {
              $set: {
                rideId: insertedRide._id,
                driverId: entry.driverUser?._id ?? null,
                details: {
                  driver: entry.driverSummary,
                  seatNumber: getCellValue(entry.row, detailsIndexes, "Seat"),
                  pickupPoint: tripSummary.pickupPoint ?? null,
                  departureTime: tripSummary.departureTime ?? null,
                  dropoffPoint: tripSummary.dropoffPoint ?? null,
                  arrivalTime: tripSummary.arrivalTime ?? null,
                  stops: getCellValue(entry.row, detailsIndexes, "Stops"),
                },
                status: "matched",
              },
            },
          );
          if (entry.trip.userId) {
            await createNotification({
              userId: String(entry.trip.userId),
              type: "trip_submitted",
              title: "Trip matched",
              body: `Your trip has been matched and confirmed for ${confirmedTime || "the scheduled time"}.`,
              data: {
                tripNumber: entry.tripNumber,
                status: "matched",
                confirmedTime,
              },
            });
          }
          updatedTripIds.push(String(entry.tripNumber));
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
