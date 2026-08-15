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

function isNullValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "" ||
    normalized === "-" ||
    normalized === "0" ||
    normalized === "null"
  );
}

type StopLookupEntry = {
  lat: number;
  lng: number;
  address: string;
  id?: number;
  name?: string;
};

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
    // Details sheet's "Stop" cell holds the numeric Stop id â€” index by id too.
    if (entry.id != null) {
      map.set(String(entry.id), entry);
    }
  }

  return map;
}

type AvailabilityRecord = {
  _id: unknown;
  date?: string;
  startTime?: string;
  endTime?: string;
  startLocation?: { address?: string; lat?: number; lng?: number };
  driverId?: { _id?: unknown } | unknown;
};

async function adminGetJson<T>(
  req: NextRequest,
  path: string,
): Promise<T | null> {
  try {
    const url = new URL(path, req.nextUrl.origin);
    const res = await fetch(url.toString(), {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchAvailabilityByNumber(
  req: NextRequest,
  availabilityNumber: number,
): Promise<AvailabilityRecord | null> {
  const data = await adminGetJson<{ records?: AvailabilityRecord[] }>(
    req,
    `/api/admin/availability?availabilityNumber=${availabilityNumber}`,
  );
  return data?.records?.[0] ?? null;
}

type TripRecord = {
  _id: unknown;
  tripNumber: number;
  userId?: unknown;
  pickup?: { address?: string; lat?: number; lng?: number } | null;
  dropoff?: { address?: string; lat?: number; lng?: number } | null;
  numberOfPassengers?: number;
  summary?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
};

async function fetchTripByNumber(
  req: NextRequest,
  tripNumber: number,
): Promise<TripRecord | null> {
  const data = await adminGetJson<{ trips?: TripRecord[] }>(
    req,
    `/api/admin/trips?tripNumber=${tripNumber}`,
  );
  return data?.trips?.[0] ?? null;
}

function mapCarTypeToVehicle(carType: number | null): string {
  switch (carType) {
    case 1:
      return "private_car";
    case 2:
      return "taxi_shared";
    case 3:
      return "van_shared";
    case 4:
      return "microbus_shared";
    default:
      return "taxi_shared";
  }
}

function splitCommaRefs(raw: string): number[] {
  if (!raw || isNullValue(raw)) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part.replace(/[^0-9]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
}

async function getDriverBundleByUserId(userId: unknown) {
  if (!userId) return { driverSummary: null, driverDoc: null };
  const user = await User.findOne({ _id: userId })
    .select("name phone profilePic")
    .lean<{ name?: string; phone?: string; profilePic?: string }>();
  const driver = await Driver.findOne({ userId })
    .select(
      "carBrand carModel carType modelYear vehicleColor carCapacity documents plateChar1 plateChar2 plateChar3 plateDigits",
    )
    .lean<{
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
    }>();
  if (!user && !driver) return { driverSummary: null, driverDoc: null };
  return {
    driverSummary: {
      name: user?.name,
      phone: user?.phone,
      profilePicture: user?.profilePic ?? driver?.documents?.profilePic,
      carBrand: driver?.carBrand,
      carModel: driver?.carModel,
      carType: driver?.carType,
      modelYear: driver?.modelYear ? String(driver.modelYear) : undefined,
      vehicleColor: driver?.vehicleColor,
      carCapacity: driver?.carCapacity,
      carImage: driver?.documents?.carImage,
    },
    driverDoc: driver ?? null,
  };
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
      const detailsHeaderRow = tripsDetailsSheet.getRow(1);
      // Column layout: Trip_ID(1) Driver_ID(2) Car_Type(3) then repeating
      // [Stop, Arrival, Alighting, Boarding, Departure] blocks.
      const TRIP_ID_COL = 1;
      const CAR_TYPE_COL = 3;
      const stopColumnIndexes: number[] = [];
      detailsHeaderRow.eachCell((cell, colNumber) => {
        if (normalizeHeader(cell.value) === "stop") {
          stopColumnIndexes.push(colNumber);
        }
      });
      const detailsRows = getSheetRows(tripsDetailsSheet).filter(
        (row) => row.number > detailsHeaderRow.number,
      );
      console.log("[addMatchedData] details header", {
        rowNumber: detailsHeaderRow.number,
        stopColumnIndexes,
        dataRowNumbers: detailsRows.map((row) => row.number),
      });

      for (const row of detailsRows) {
        if (!row) continue;

        const availabilityNumber = parseTripNumber(
          getCellText(row.getCell(TRIP_ID_COL)),
        );
        if (availabilityNumber == null) continue;

        const availability = await fetchAvailabilityByNumber(
          req,
          availabilityNumber,
        );
        if (!availability) {
          console.log("[addMatchedData] no availability for row", {
            rowNumber: row.number,
            availabilityNumber,
          });
          continue;
        }

        const driverIdRaw =
          (availability.driverId as { _id?: unknown } | null)?._id ??
          (availability.driverId as unknown) ??
          null;
        const { driverSummary, driverDoc } =
          await getDriverBundleByUserId(driverIdRaw);

        const carTypeNumber = parseNumber(
          getCellText(row.getCell(CAR_TYPE_COL)),
        );
        const vehicleType = mapCarTypeToVehicle(carTypeNumber);
        const rideType: "private" | "shared" =
          normalizeRideType(driverSummary?.carType ?? "") === "private" ||
          carTypeNumber === 1
            ? "private"
            : "shared";

        type RoutePassenger = {
          tripId: unknown;
          userId: unknown;
          pickup: { address: string; lat: number; lng: number };
          dropoff: { address: string; lat: number; lng: number };
          pickupOrder: number;
          dropoffOrder: number;
          numberOfPassengers: number;
          tripCost: number;
          seatNumber?: number;
        };
        type RouteEntry = {
          point: { address: string; lat: number; lng: number };
          arrival: string;
          departure: string;
          waitingMinutes: number;
          boardingNumber: number;
          alightingNumber: number;
          boarding: RoutePassenger[];
          alighting: RoutePassenger[];
        };
        const route: RouteEntry[] = [];
        const boardingRefsPerStop: number[][] = [];
        const alightingRefsPerStop: number[][] = [];

        for (const stopCol of stopColumnIndexes) {
          const stopRaw = getCellText(row.getCell(stopCol));
          if (!stopRaw || isNullValue(stopRaw)) continue;

          const stopIdKey = String(parseNumber(stopRaw) ?? stopRaw);
          const stopEntry =
            stopLookup.get(stopIdKey) ??
            stopLookup.get(normalizeLookupKey(stopRaw));
          const point = stopEntry
            ? {
                address: stopEntry.name || stopEntry.address || stopRaw,
                lat: stopEntry.lat,
                lng: stopEntry.lng,
              }
            : { address: stopRaw, lat: 0, lng: 0 };

          const arrival = normalizeTimeValue(
            getCellText(row.getCell(stopCol + 1)),
          );
          const alightingCell = getCellText(row.getCell(stopCol + 2));
          const boardingCell = getCellText(row.getCell(stopCol + 3));
          const departure = normalizeTimeValue(
            getCellText(row.getCell(stopCol + 4)),
          );

          const alightingRefs = splitCommaRefs(alightingCell);
          const boardingRefs = splitCommaRefs(boardingCell);

          route.push({
            point,
            arrival,
            departure,
            waitingMinutes: 0,
            boardingNumber: boardingRefs.length,
            alightingNumber: alightingRefs.length,
            boarding: [],
            alighting: [],
          });
          boardingRefsPerStop.push(boardingRefs);
          alightingRefsPerStop.push(alightingRefs);
        }

        if (route.length === 0) {
          console.log("[addMatchedData] no route stops for row", {
            rowNumber: row.number,
            availabilityNumber,
          });
          continue;
        }

        // Pass 1: assign chronological pickup/dropoff order counters across all
        // boarding + alighting events in the row.
        const pickupOrderByTrip = new Map<number, number>();
        const dropoffOrderByTrip = new Map<number, number>();
        let orderCounter = 0;
        for (let i = 0; i < route.length; i++) {
          for (const ref of boardingRefsPerStop[i] ?? []) {
            orderCounter += 1;
            pickupOrderByTrip.set(ref, orderCounter);
          }
          for (const ref of alightingRefsPerStop[i] ?? []) {
            orderCounter += 1;
            dropoffOrderByTrip.set(ref, orderCounter);
          }
        }

        // Pass 2: resolve trips and materialize passenger objects on each stop.
        const tripRecordByNumber = new Map<number, TripRecord | null>();
        const resolveTrip = async (
          tripNumber: number,
        ): Promise<TripRecord | null> => {
          if (tripRecordByNumber.has(tripNumber)) {
            return tripRecordByNumber.get(tripNumber) ?? null;
          }
          const record = await fetchTripByNumber(req, tripNumber);
          tripRecordByNumber.set(tripNumber, record);
          return record;
        };

        const buildPassenger = (
          tripRecord: TripRecord | null,
          tripNumber: number,
        ): RoutePassenger | null => {
          if (!tripRecord) return null;
          const userIdRaw =
            (tripRecord.userId as { _id?: unknown } | null)?._id ??
            (tripRecord.userId as unknown) ??
            null;
          const pickup = tripRecord.pickup;
          const dropoff = tripRecord.dropoff;
          if (
            !pickup ||
            !dropoff ||
            pickup.lat == null ||
            pickup.lng == null ||
            dropoff.lat == null ||
            dropoff.lng == null
          ) {
            return null;
          }
          const summary = (tripRecord.summary ?? {}) as Record<string, unknown>;
          const details = (tripRecord.details ?? {}) as Record<string, unknown>;
          const rawSeat = details.seatNumber;
          const seatNumber =
            typeof rawSeat === "number"
              ? rawSeat
              : rawSeat != null
                ? Number(String(rawSeat).replace(/[^0-9-]/g, ""))
                : undefined;
          return {
            tripId: tripRecord._id,
            userId: userIdRaw,
            pickup: {
              address: pickup.address ?? "",
              lat: pickup.lat,
              lng: pickup.lng,
            },
            dropoff: {
              address: dropoff.address ?? "",
              lat: dropoff.lat,
              lng: dropoff.lng,
            },
            pickupOrder: pickupOrderByTrip.get(tripNumber) ?? 0,
            dropoffOrder: dropoffOrderByTrip.get(tripNumber) ?? 0,
            numberOfPassengers: Math.max(
              1,
              Number(tripRecord.numberOfPassengers ?? 1) || 1,
            ),
            tripCost: Number(summary.totalFees ?? 0) || 0,
            seatNumber:
              seatNumber != null && Number.isFinite(seatNumber)
                ? seatNumber
                : undefined,
          };
        };

        for (let i = 0; i < route.length; i++) {
          const stop = route[i]!;
          for (const ref of boardingRefsPerStop[i] ?? []) {
            const record = await resolveTrip(ref);
            const passenger = buildPassenger(record, ref);
            if (passenger) stop.boarding.push(passenger);
          }
          for (const ref of alightingRefsPerStop[i] ?? []) {
            const record = await resolveTrip(ref);
            const passenger = buildPassenger(record, ref);
            if (passenger) stop.alighting.push(passenger);
          }
        }

        const rideNumber = await nextSequence("rideNumber");
        const firstPoint = route[0]!.point;
        const lastPoint = route[route.length - 1]!.point;
        const startLoc = availability.startLocation;
        const summaryForRide = summaryByTripNumber.get(availabilityNumber);
        const totalCost =
          Number(summaryForRide?.totalFees ?? 0) > 0
            ? Number(summaryForRide?.totalFees)
            : 0;

        const insertedRide = await Ride.create({
          rideNumber,
          availabilityId: availability._id,
          driverId: driverIdRaw,
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
          date: availability.date ?? "",
          rideType,
          vehicleType,
          route,
          driverOrigin:
            startLoc && startLoc.lat != null && startLoc.lng != null
              ? {
                  address: startLoc.address ?? "",
                  lat: startLoc.lat,
                  lng: startLoc.lng,
                }
              : undefined,
          pickupStation: firstPoint,
          dropoffStation: lastPoint,
          startTime: availability.startTime ?? "00:00",
          endTime: availability.endTime ?? "00:00",
          passengers: [],
          totalCost,
          status: "active",
        });

        await Availability.updateOne(
          { _id: availability._id },
          {
            $set: {
              matched: true,
              rideId: insertedRide._id,
              status: "matched",
            },
          },
        );

        updatedTripIds.push(String(availabilityNumber));

        console.log("[addMatchedData] ride created", {
          rideNumber,
          availabilityNumber,
          routeStops: route.length,
          boardingRefsPerStop,
          alightingRefsPerStop,
        });
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
