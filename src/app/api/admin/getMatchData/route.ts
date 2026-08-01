import ExcelJS from "exceljs";
import JSZip from "jszip";
import { NextResponse } from "next/server";
// import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { Driver } from "@/models/Driver";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";
import { Station } from "@/models/Station";
import { fetchDirections } from "@/app/api/directions/route";
import { haversineKm } from "@/lib/geo/stations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getTomorrowDate() {
  const today = new Date();
  today.setDate(today.getDate() - 1);

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

interface PrivateRow {
  rideId: number;
  passId: number | null;
  originStationNo: number | null;
  destinationStationNo: number | null;
  stop1Number: number | null;
  stop1Lat: number | null;
  stop1Long: number | null;
  stop1Address: string | null;
  stop1Alighting: number | null;
  stop1Boarding: number | null;
  stop1WaitingTime: number | null;
  stop2Number: number | null;
  stop2Lat: number | null;
  stop2Long: number | null;
  stop2Address: string | null;
  stop2Alighting: number | null;
  stop2Boarding: number | null;
  stop2WaitingTime: number | null;
  stop3Number: number | null;
  stop3Lat: number | null;
  stop3Long: number | null;
  stop3Address: string | null;
  stop3Alighting: number | null;
  stop3Boarding: number | null;
  stop3WaitingTime: number | null;
  stop4Number: number | null;
  stop4Lat: number | null;
  stop4Long: number | null;
  stop4Address: string | null;
  stop4Alighting: number | null;
  stop4Boarding: number | null;
  stop4WaitingTime: number | null;
  readyFrom: string;
  shouldArrivebefore: string;
  rideType: number;
  totalStartedPassengers: number;
}

interface SharedRow {
  rideId: number;
  passId: number | null;
  originNearestStationNo: number | null;
  destinationNearestStationNo: number | null;
  readyFrom: string;
  shouldArrivebefore: string;
  rideType: number;
  totalStartedPassengers: number;
}

interface AvailabilityRow {
  availabilityId: number;
  driverId: number | null;
  date: string;
  startStationNo: number | null;
  endStationNo: number | null;
  startTime: string;
  endTime: string;
  vehicleType: number;
}

interface StationInfo {
  objectId: number;
  name: string;
  lat: number;
  lng: number;
}

const PRIVATE_COLUMNS: (keyof PrivateRow)[] = [
  "rideId",
  "passId",
  "originStationNo",
  "destinationStationNo",
  "readyFrom",
  "shouldArrivebefore",
  "rideType",
  "totalStartedPassengers",
  "stop1Number",
  "stop1Alighting",
  "stop1Boarding",
  "stop1WaitingTime",
  "stop2Number",
  "stop2Alighting",
  "stop2Boarding",
  "stop2WaitingTime",
  "stop3Number",
  "stop3Alighting",
  "stop3Boarding",
  "stop3WaitingTime",
  "stop4Number",
  "stop4Alighting",
  "stop4Boarding",
  "stop4WaitingTime",
];

const SHARED_COLUMNS: (keyof SharedRow)[] = [
  "rideId",
  "passId",
  "originNearestStationNo",
  "destinationNearestStationNo",
  "readyFrom",
  "shouldArrivebefore",
  "rideType",
  "totalStartedPassengers",
];

const AVAILABILITY_COLUMNS: (keyof AvailabilityRow)[] = [
  "availabilityId",
  "driverId",
  "date",
  "startStationNo",
  "endStationNo",
  "startTime",
  "endTime",
  "vehicleType",
];

const CAR_TYPE_TO_VEHICLE_TYPE: Record<string, number> = {
  private: 1,
  taxi: 2,
  van: 3,
  microbus: 4,
};

function styleWorksheet(sheet: ExcelJS.Worksheet) {
  const thinBorder = {
    style: "thin" as ExcelJS.BorderStyle,
    color: { argb: "FF999999" },
  };
  const borderSet: Partial<ExcelJS.Borders> = {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: thinBorder,
  };

  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      if (typeof cell.value === "string") {
        cell.value = cell.value.trim().replace(/\s+/g, " ");
      }
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: false,
      };
      cell.border = borderSet;
      if (rowNumber === 1) {
        cell.font = { bold: true };
      }
    });
  });
}

function adjustWorksheetSizing(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((column) => {
    const values = Array.isArray(column.values)
      ? (column.values as ReadonlyArray<unknown>)
      : [];
    const maxLength = values.reduce((max: number, value: unknown) => {
      const text =
        value == null ? "" : String(value).trim().replace(/\s+/g, " ");
      return Math.max(max, text.length);
    }, 10);
    column.width = maxLength + 2;
  });
}

function formatTime12Hour(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return trimmed;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return trimmed;

  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function formatWaitingMinutes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  const totalMinutes = Math.max(0, Math.floor(Number(value)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getDisplayValueForColumn<T extends PrivateRow | SharedRow>(
  row: T,
  column: keyof T,
): string | number | null {
  if (
    (column === "readyFrom" || column === "shouldArrivebefore") &&
    typeof row[column] === "string"
  ) {
    return formatTime12Hour(row[column] as string | null | undefined);
  }

  if (
    typeof column === "string" &&
    /^(stop\d+WaitingTime)$/.test(column) &&
    (row as PrivateRow)[column as keyof PrivateRow] != null
  ) {
    return formatWaitingMinutes(
      (row as PrivateRow)[column as keyof PrivateRow] as number | null,
    );
  }

  return row[column] as string | number | null;
}

export async function GET() {
  //   const auth = await adminAuth(req);
  //   if (!auth.authorized) return auth.response;

  await connectDB();

  const today = getTomorrowDate();

  const privateTrips = await Trip.find({
    date: today,
    status: "submitted",
    paymentStatus: "paid",
    vehicleType: { $in: ["private_car", "taxi_private"] },
  }).lean<
    {
      tripNumber: number;
      userId: unknown;
      pickup?: { lat: number; lng: number };
      dropoff?: { lat: number; lng: number };
      pickupStation?: { id: number };
      dropoffStation?: { id: number };
      stops?: {
        point?: { address: string; lat: number; lng: number };
        alighting?: number;
        boarding?: number;
        waitingMinutes?: number;
      }[];
      pickupTime: string;
      arrivalTime: string;
      vehicleType: string;
      numberOfPassengers: number;
    }[]
  >();

  const sharedTrips = await Trip.find({
    date: today,
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

  const availabilities = await Availability.find({
    date: today,
  }).lean<
    {
      availabilityNumber: number;
      driverId: unknown;
      date: string;
      startLocation: { lat: number; lng: number };
      endLocation: { lat: number; lng: number };
      startNearestStation?: { id: number };
      endNearestStation?: { id: number };
      startTime: string;
      endTime: string;
    }[]
  >();

  const userIds = Array.from(
    new Set([
      ...privateTrips.map((t) => String(t.userId)),
      ...sharedTrips.map((t) => String(t.userId)),
      ...availabilities.map((a) => String(a.driverId)),
    ]),
  );

  const users = await User.find({ _id: { $in: userIds } })
    .select("userNumber")
    .lean<{ _id: unknown; userNumber: number }[]>();
  const userNumberMap = new Map(
    users.map((u) => [String(u._id), u.userNumber]),
  );

  const drivers = await Driver.find({ userId: { $in: userIds } })
    .select("userId carType")
    .lean<{ userId: unknown; carType?: string }[]>();
  const carTypeMap = new Map(
    drivers.map((driver) => [String(driver.userId), driver.carType]),
  );

  let nextStopNumber = 5000;
  let nextPrivateStationNumber = 7000;
  let nextAvailabilityStationNumber = 8000;
  const syntheticStations: StationInfo[] = [];

  function addSyntheticStation(
    objectId: number,
    point:
      | { lat: number; lng: number; address?: string | null }
      | null
      | undefined,
  ): number | null {
    if (point?.lat == null || point?.lng == null) return null;
    syntheticStations.push({
      objectId,
      name: point.address ?? "",
      lat: point.lat,
      lng: point.lng,
    });
    return objectId;
  }

  const privateRows: PrivateRow[] = privateTrips.map((trip) => {
    const s = trip.stops ?? [];
    const originStationNo = addSyntheticStation(
      nextPrivateStationNumber,
      trip.pickup,
    )
      ? nextPrivateStationNumber++
      : null;
    const destinationStationNo = addSyntheticStation(
      nextPrivateStationNumber,
      trip.dropoff,
    )
      ? nextPrivateStationNumber++
      : null;
    const row: PrivateRow = {
      rideId: trip.tripNumber,
      passId: userNumberMap.get(String(trip.userId)) ?? null,
      originStationNo,
      destinationStationNo,
      stop1Number: null,
      stop1Lat: null,
      stop1Long: null,
      stop1Address: null,
      stop1Alighting: null,
      stop1Boarding: null,
      stop1WaitingTime: null,
      stop2Number: null,
      stop2Lat: null,
      stop2Long: null,
      stop2Address: null,
      stop2Alighting: null,
      stop2Boarding: null,
      stop2WaitingTime: null,
      stop3Number: null,
      stop3Lat: null,
      stop3Long: null,
      stop3Address: null,
      stop3Alighting: null,
      stop3Boarding: null,
      stop3WaitingTime: null,
      stop4Number: null,
      stop4Lat: null,
      stop4Long: null,
      stop4Address: null,
      stop4Alighting: null,
      stop4Boarding: null,
      stop4WaitingTime: null,
      readyFrom: trip.pickupTime,
      shouldArrivebefore: trip.arrivalTime,
      rideType: trip.vehicleType === "private_car" ? 1 : 2,
      totalStartedPassengers: trip.numberOfPassengers,
    };

    const assignStop = (
      index: number,
      stop: (typeof s)[number] | undefined,
    ) => {
      const point = stop?.point;
      const stopKey = `stop${index}` as const;
      const numberKey = `${stopKey}Number` as keyof PrivateRow;
      const latKey = `${stopKey}Lat` as keyof PrivateRow;
      const longKey = `${stopKey}Long` as keyof PrivateRow;
      const addressKey = `${stopKey}Address` as keyof PrivateRow;
      const alightingKey = `${stopKey}Alighting` as keyof PrivateRow;
      const boardingKey = `${stopKey}Boarding` as keyof PrivateRow;
      const waitingKey = `${stopKey}WaitingTime` as keyof PrivateRow;

      if (point?.lat != null && point?.lng != null) {
        row[numberKey] = nextStopNumber as never;
        row[latKey] = point.lat as never;
        row[longKey] = point.lng as never;
        row[addressKey] = (point.address ?? null) as never;
        syntheticStations.push({
          objectId: nextStopNumber,
          name: point.address ?? "",
          lat: point.lat,
          lng: point.lng,
        });
        nextStopNumber += 1;
      } else {
        row[numberKey] = 0 as never;
        row[latKey] = 0 as never;
        row[longKey] = 0 as never;
        row[addressKey] = null as never;
      }

      row[alightingKey] = (stop?.alighting ?? 0) as never;
      row[boardingKey] = (stop?.boarding ?? 0) as never;
      row[waitingKey] = (stop?.waitingMinutes ?? 0) as never;
    };

    assignStop(1, s[0]);
    assignStop(2, s[1]);
    assignStop(3, s[2]);
    assignStop(4, s[3]);

    return row;
  });

  const sharedRows: SharedRow[] = sharedTrips.map((trip) => ({
    rideId: trip.tripNumber,
    passId: userNumberMap.get(String(trip.userId)) ?? null,
    originNearestStationNo: trip.pickupStation?.id ?? null,
    destinationNearestStationNo: trip.dropoffStation?.id ?? null,
    readyFrom: trip.pickupTime,
    shouldArrivebefore: trip.arrivalTime,
    rideType:
      trip.vehicleType === "taxi_shared"
        ? 3
        : trip.vehicleType === "van_shared"
          ? 4
          : 5,
    totalStartedPassengers: trip.extraPassengers + 1,
  }));

  const availabilityRows: AvailabilityRow[] = availabilities.map(
    (availability) => {
      const carType = carTypeMap.get(String(availability.driverId));
      const startStationNo = addSyntheticStation(
        nextAvailabilityStationNumber,
        availability.startLocation,
      )
        ? nextAvailabilityStationNumber++
        : null;
      const endStationNo = addSyntheticStation(
        nextAvailabilityStationNumber,
        availability.endLocation,
      )
        ? nextAvailabilityStationNumber++
        : null;
      return {
        availabilityId: availability.availabilityNumber,
        driverId: userNumberMap.get(String(availability.driverId)) ?? null,
        date: availability.date,
        startStationNo,
        endStationNo,
        startTime: availability.startTime,
        endTime: availability.endTime,
        vehicleType: carType ? (CAR_TYPE_TO_VEHICLE_TYPE[carType] ?? 0) : 0,
      };
    },
  );

  const stationIds = Array.from(
    new Set(
      [
        ...privateRows
          .map((row) => [row.originStationNo, row.destinationStationNo])
          .flat(),
        ...sharedRows
          .map((row) => [
            row.originNearestStationNo,
            row.destinationNearestStationNo,
          ])
          .flat(),
        ...availabilityRows
          .map((row) => [row.startStationNo, row.endStationNo])
          .flat(),
        ...syntheticStations.map((station) => station.objectId),
      ].filter(
        (id): id is number => typeof id === "number" && Number.isFinite(id),
      ),
    ),
  );

  const stations = await Station.find({ objectId: { $in: stationIds } })
    .select("objectId name lat lng")
    .lean<StationInfo[]>();

  const stationMap = new Map(
    stations.map((station) => [station.objectId, station]),
  );
  const syntheticStationMap = new Map(
    syntheticStations.map((station) => [station.objectId, station]),
  );
  const stationsSheetRows = stationIds
    .map((id) => stationMap.get(id) ?? syntheticStationMap.get(id))
    .filter((station): station is StationInfo => Boolean(station));

  const routeCache = new Map<
    string,
    { distance_km: number; duration_minutes: number }
  >();

  async function fetchRouteMetrics(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ) {
    const key = `${from.lat},${from.lng}->${to.lat},${to.lng}`;
    const cached = routeCache.get(key);
    if (cached) return cached;
    if (from.lat === to.lat && from.lng === to.lng) {
      const same = { distance_km: 0, duration_minutes: 0 };
      routeCache.set(key, same);
      return same;
    }

    const origin = `${from.lat},${from.lng}`;
    const dest = `${to.lat},${to.lng}`;
    const result = await fetchDirections(origin, dest);
    const directDistanceKm = haversineKm(from.lat, from.lng, to.lat, to.lng);
    const estimatedDurationMinutes = Math.max(
      1,
      Math.round((directDistanceKm / 35) * 60),
    );

    const metrics = {
      distance_km:
        result[0] &&
        Number.isFinite(result[0].distance_km) &&
        result[0].distance_km > 0
          ? Math.round(result[0].distance_km * 10) / 10
          : Math.round(directDistanceKm * 10) / 10,
      duration_minutes:
        result[0] &&
        Number.isFinite(result[0].duration_minutes) &&
        result[0].duration_minutes > 0
          ? result[0].duration_minutes
          : estimatedDurationMinutes,
    };

    routeCache.set(key, metrics);
    return metrics;
  }

  const wb = new ExcelJS.Workbook();

  const stationsSheet = wb.addWorksheet("Stations");
  stationsSheet.addRow(["District Id", "lat", "lng", "District Name"]);
  for (const station of stationsSheetRows) {
    stationsSheet.addRow([
      station.objectId,
      station.lat,
      station.lng,
      station.name || "",
    ]);
  }
  styleWorksheet(stationsSheet);
  adjustWorksheetSizing(stationsSheet);

  const matrixDistance = wb.addWorksheet("StationMatrixDistance");
  matrixDistance.getCell("A1").value = "District Name";
  matrixDistance.getCell("B2").value = "District Id";

  const matrixDuration = wb.addWorksheet("StationMatrixDuration");
  matrixDuration.getCell("A1").value = "District Name";
  matrixDuration.getCell("B2").value = "District Id";

  stationsSheetRows.forEach((station, index) => {
    const column = index + 3;
    const label = station.name || String(station.objectId);

    matrixDistance.getRow(1).getCell(column).value = label;
    matrixDistance.getRow(2).getCell(column).value = station.objectId;
    matrixDistance.getRow(index + 3).getCell(1).value = label;
    matrixDistance.getRow(index + 3).getCell(2).value = station.objectId;

    matrixDuration.getRow(1).getCell(column).value = label;
    matrixDuration.getRow(2).getCell(column).value = station.objectId;
    matrixDuration.getRow(index + 3).getCell(1).value = label;
    matrixDuration.getRow(index + 3).getCell(2).value = station.objectId;
  });

  for (let rowIndex = 0; rowIndex < stationsSheetRows.length; rowIndex++) {
    for (let colIndex = 0; colIndex < stationsSheetRows.length; colIndex++) {
      const originStation = stationsSheetRows[rowIndex];
      const destStation = stationsSheetRows[colIndex];
      const metrics = await fetchRouteMetrics(
        { lat: originStation.lat, lng: originStation.lng },
        { lat: destStation.lat, lng: destStation.lng },
      );
      matrixDistance.getRow(rowIndex + 3).getCell(colIndex + 3).value =
        metrics.distance_km;
      matrixDuration.getRow(rowIndex + 3).getCell(colIndex + 3).value =
        metrics.duration_minutes;
    }
  }
  styleWorksheet(matrixDistance);
  adjustWorksheetSizing(matrixDistance);
  styleWorksheet(matrixDuration);
  adjustWorksheetSizing(matrixDuration);

  const privateSheet = wb.addWorksheet("PrivateRideRequests");
  privateSheet.addRow(PRIVATE_COLUMNS.map((column) => column));
  for (const row of privateRows) {
    privateSheet.addRow(
      PRIVATE_COLUMNS.map((column) => getDisplayValueForColumn(row, column)),
    );
  }
  styleWorksheet(privateSheet);
  adjustWorksheetSizing(privateSheet);

  const sharedSheet = wb.addWorksheet("SharedRideRequests");
  sharedSheet.addRow(SHARED_COLUMNS);
  for (const row of sharedRows) {
    sharedSheet.addRow(
      SHARED_COLUMNS.map((column) => getDisplayValueForColumn(row, column)),
    );
  }
  styleWorksheet(sharedSheet);
  adjustWorksheetSizing(sharedSheet);

  const availabilitySheet = wb.addWorksheet("Availability");
  availabilitySheet.addRow(AVAILABILITY_COLUMNS);
  for (const row of availabilityRows) {
    availabilitySheet.addRow(AVAILABILITY_COLUMNS.map((column) => row[column]));
  }
  styleWorksheet(availabilitySheet);
  adjustWorksheetSizing(availabilitySheet);

  const outputJson = {
    privateRideRequests: privateRows,
    sharedRideRequests: sharedRows,
    availability: availabilityRows,
    stations: stationsSheetRows,
    stationMatrixDistance: stationsSheetRows.map((origin) =>
      stationsSheetRows.map((dest) => {
        const key = `${origin.lat},${origin.lng}->${dest.lat},${dest.lng}`;
        return routeCache.get(key)?.distance_km ?? 0;
      }),
    ),
    stationMatrixDuration: stationsSheetRows.map((origin) =>
      stationsSheetRows.map((dest) => {
        const key = `${origin.lat},${origin.lng}->${dest.lat},${dest.lng}`;
        return routeCache.get(key)?.duration_minutes ?? 0;
      }),
    ),
  };

  const zip = new JSZip();
  zip.file("match-data.json", JSON.stringify(outputJson, null, 2));
  zip.file("match-data.xlsx", Buffer.from(await wb.xlsx.writeBuffer()));

  const body = await zip.generateAsync({ type: "blob" });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="match-data.zip"',
    },
  });
}
