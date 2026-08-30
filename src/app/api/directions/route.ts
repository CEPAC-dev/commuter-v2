import { NextRequest, NextResponse } from "next/server";

export interface DirectionsResult {
  coordinates: [number, number][];
  distance_km: number;
  duration_minutes: number;
}

export interface DirectionsTableResult {
  distancesKm: Array<Array<number | null>>;
  durationsMinutes: Array<Array<number | null>>;
}

export type MatrixProvider =
  | "osrm"
  | "openrouteservice"
  | "valhalla"
  | "graphhopper"
  | "traveltime";
export type ValhallaDateTimeType = "current" | "depart_at" | "arrive_by";
export type TravelTimeTransportation = "driving" | "walking" | "cycling";

export interface MatrixOptions {
  valhalla?: {
    costing: "auto" | "taxi" | "bus";
    dateTimeType: ValhallaDateTimeType;
    dateTime?: string;
  };
  travelTime?: {
    transportation: TravelTimeTransportation;
    departureTime: string;
  };
}

type MatrixPoint = { lat: number; lng: number };
const GRAPHHOPPER_BATCH_SIZE = 10;
const GRAPHHOPPER_CONCURRENCY = 8;

export function isMatrixProvider(
  value: string | null,
): value is MatrixProvider {
  return (
    value === "osrm" ||
    value === "openrouteservice" ||
    value === "valhalla" ||
    value === "graphhopper" ||
    value === "traveltime"
  );
}

export async function fetchOsrmDirectionsTable(
  points: Array<{ lat: number; lng: number }>,
): Promise<DirectionsTableResult | null> {
  if (points.length < 2) return null;

  const coordinates = points.map(({ lat, lng }) => `${lng},${lat}`).join(";");
  const url = new URL(
    `https://router.project-osrm.org/table/v1/driving/${coordinates}`,
  );
  url.searchParams.set("annotations", "distance,duration");

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    code?: string;
    distances?: Array<Array<number | null>>;
    durations?: Array<Array<number | null>>;
  };

  if (data.code !== "Ok" || !data.distances || !data.durations) return null;

  return {
    distancesKm: data.distances.map((row) =>
      row.map((distance) =>
        typeof distance === "number" && distance >= 0
          ? Math.round((distance / 1000) * 10) / 10
          : null,
      ),
    ),
    durationsMinutes: data.durations.map((row) =>
      row.map((duration) =>
        typeof duration === "number" && duration >= 0
          ? Math.round(duration / 60)
          : null,
      ),
    ),
  };
}

export async function fetchOpenRouteServiceMatrix(
  points: MatrixPoint[],
): Promise<DirectionsTableResult | null> {
  if (points.length < 2) return null;

  const apiKey = process.env.ORS_API_KEY ?? process.env.NEXT_PUBLIC_ORS_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    "https://api.openrouteservice.org/v2/matrix/driving-car",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        locations: points.map(({ lat, lng }) => [lng, lat]),
        metrics: ["distance", "duration"],
      }),
      next: { revalidate: 60 },
    },
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    distances?: Array<Array<number | null>>;
    durations?: Array<Array<number | null>>;
  };

  if (!data.distances || !data.durations) return null;

  return {
    distancesKm: data.distances.map((row) =>
      row.map((distance) =>
        typeof distance === "number" && distance > 0
          ? Math.round((distance / 1000) * 10) / 10
          : null,
      ),
    ),
    durationsMinutes: data.durations.map((row) =>
      row.map((duration) =>
        typeof duration === "number" && duration > 0
          ? Math.round(duration / 60)
          : null,
      ),
    ),
  };
}

export async function fetchValhallaMatrix(
  points: MatrixPoint[],
  options: NonNullable<MatrixOptions["valhalla"]>,
): Promise<DirectionsTableResult | null> {
  if (points.length < 2) return null;

  const baseUrl = process.env.VALHALLA_URL?.replace(/\/+$/, "");
  if (!baseUrl) return null;

  const dateTimeType =
    options.dateTimeType === "depart_at"
      ? 1
      : options.dateTimeType === "arrive_by"
        ? 2
        : 0;
  const dateTime =
    dateTimeType === 0
      ? { type: dateTimeType }
      : { type: dateTimeType, value: options.dateTime };

  const res = await fetch(`${baseUrl}/sources_to_targets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sources: points.map(({ lat, lng }) => ({ lat, lon: lng })),
      targets: points.map(({ lat, lng }) => ({ lat, lon: lng })),
      costing: options.costing,
      units: "kilometers",
      date_time: dateTime,
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    sources_to_targets?: Array<
      Array<{ distance?: number; time?: number | null } | null>
    >;
  };
  const matrix = data.sources_to_targets;
  if (!matrix || matrix.length !== points.length) return null;

  return {
    distancesKm: matrix.map((row) =>
      row.map((cell) =>
        typeof cell?.distance === "number" && cell.distance > 0
          ? Math.round(cell.distance * 10) / 10
          : null,
      ),
    ),
    durationsMinutes: matrix.map((row) =>
      row.map((cell) =>
        typeof cell?.time === "number" && cell.time > 0
          ? Math.round(cell.time / 60)
          : null,
      ),
    ),
  };
}

export async function fetchGraphHopperMatrix(
  points: MatrixPoint[],
): Promise<DirectionsTableResult | null> {
  if (points.length < 2) {
    console.warn("[GraphHopper matrix] Skipped: fewer than two points.");
    return null;
  }

  const baseUrl = process.env.GRAPHHOPPER_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    console.error("[GraphHopper matrix] Skipped: GRAPHHOPPER_URL is unset.");
    return null;
  }

  const url = `${baseUrl}/matrix`;
  const groups = Array.from(
    { length: Math.ceil(points.length / GRAPHHOPPER_BATCH_SIZE) },
    (_, index) => {
      const start = index * GRAPHHOPPER_BATCH_SIZE;
      return {
        start,
        points: points.slice(start, start + GRAPHHOPPER_BATCH_SIZE),
      };
    },
  );
  const distancesKm = Array.from({ length: points.length }, () =>
    Array<number | null>(points.length).fill(null),
  );
  const durationsMinutes = Array.from({ length: points.length }, () =>
    Array<number | null>(points.length).fill(null),
  );

  const batches = groups.flatMap((sourceGroup, sourceGroupIndex) =>
    groups.slice(sourceGroupIndex).map((targetGroup, offset) => ({
      sourceGroup,
      sourceGroupIndex,
      targetGroup,
      targetGroupIndex: sourceGroupIndex + offset,
    })),
  );
  let nextBatchIndex = 0;

  async function processBatches() {
    while (nextBatchIndex < batches.length) {
      const batchIndex = nextBatchIndex++;
      const { sourceGroup, sourceGroupIndex, targetGroup, targetGroupIndex } =
        batches[batchIndex];
      const batchLabel = `${sourceGroupIndex + 1}-${targetGroupIndex + 1}`;
      const isSameGroup = sourceGroupIndex === targetGroupIndex;
      const combinedPoints = isSameGroup
        ? sourceGroup.points
        : [...sourceGroup.points, ...targetGroup.points];
      const payload = {
        points: combinedPoints.map(({ lat, lng }) => [lng, lat]),
        profile: "car",
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      if (!res.ok) {
        const errorBody = await res.text();
        console.error(
          `[GraphHopper matrix] Batch ${batchLabel} ${res.status} ${res.statusText}: ${errorBody}`,
        );
        continue;
      }

      const data = (await res.json()) as {
        distances?: Array<Array<number | null>>;
        times?: Array<Array<number | null>>;
      };
      const isCombinedResponse =
        data.distances?.length === combinedPoints.length &&
        data.times?.length === combinedPoints.length &&
        data.distances.every((row) => row.length === combinedPoints.length) &&
        data.times.every((row) => row.length === combinedPoints.length);
      if (
        !data.distances ||
        !data.times ||
        !isCombinedResponse
      ) {
        console.error(
          `[GraphHopper matrix] Batch ${batchLabel} returned invalid dimensions: ${data.distances?.length ?? 0}x${data.distances?.[0]?.length ?? 0}.`,
        );
        continue;
      }

      sourceGroup.points.forEach((_, rowIndex) => {
        targetGroup.points.forEach((_, colIndex) => {
          const responseColumnIndex = !isSameGroup
            ? sourceGroup.points.length + colIndex
            : colIndex;
          const distance = data.distances?.[rowIndex]?.[responseColumnIndex];
          const duration = data.times?.[rowIndex]?.[responseColumnIndex];
          const originIndex = sourceGroup.start + rowIndex;
          const destinationIndex = targetGroup.start + colIndex;
          distancesKm[originIndex][destinationIndex] =
            typeof distance === "number" && distance >= 0
              ? Math.round((distance / 1000) * 10) / 10
              : null;
          durationsMinutes[originIndex][destinationIndex] =
            typeof duration === "number" && duration >= 0
              ? Math.round(duration / 60)
              : null;
        });
      });

      if (!isSameGroup) {
        targetGroup.points.forEach((_, rowIndex) => {
          sourceGroup.points.forEach((_, colIndex) => {
            const responseRowIndex = sourceGroup.points.length + rowIndex;
            const distance = data.distances?.[responseRowIndex]?.[colIndex];
            const duration = data.times?.[responseRowIndex]?.[colIndex];
            const originIndex = targetGroup.start + rowIndex;
            const destinationIndex = sourceGroup.start + colIndex;
            distancesKm[originIndex][destinationIndex] =
              typeof distance === "number" && distance >= 0
                ? Math.round((distance / 1000) * 10) / 10
                : null;
            durationsMinutes[originIndex][destinationIndex] =
              typeof duration === "number" && duration >= 0
                ? Math.round(duration / 60)
                : null;
          });
        });
      }

      if ((batchIndex + 1) % 100 === 0 || batchIndex + 1 === batches.length) {
        console.log(
          `[GraphHopper matrix] Completed ${batchIndex + 1}/${batches.length} batches.`,
        );
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(GRAPHHOPPER_CONCURRENCY, batches.length) },
      () => processBatches(),
    ),
  );

  console.log(
    "[GraphHopper matrix] Completed",
    JSON.stringify({
      pointCount: points.length,
      batchSize: GRAPHHOPPER_BATCH_SIZE,
      batchCount: batches.length,
      concurrency: GRAPHHOPPER_CONCURRENCY,
    }),
  );
  return { distancesKm, durationsMinutes };
}

export async function fetchTravelTimeMatrix(
  points: MatrixPoint[],
  options: NonNullable<MatrixOptions["travelTime"]>,
): Promise<DirectionsTableResult | null> {
  if (points.length < 2) return null;

  const baseUrl = process.env.TRAVELTIME_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    console.error("[TravelTime matrix] Skipped: TRAVELTIME_URL is unset.");
    return null;
  }

  const serviceApiKey = process.env.TRAVELTIME_SERVICE_API_KEY?.trim();
  const response = await fetch(`${baseUrl}/matrix`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(serviceApiKey ? { "X-Service-Key": serviceApiKey } : {}),
    },
    body: JSON.stringify({
      points: points.map(({ lat, lng }) => [lng, lat]),
      transportation: options.transportation,
      departureTime: options.departureTime,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error(
      `[TravelTime matrix] ${response.status} ${response.statusText}: ${detail}`,
    );
    return null;
  }

  const data = (await response.json()) as {
    distances?: Array<Array<number | null>>;
    times?: Array<Array<number | null>>;
  };
  if (
    !data.distances ||
    !data.times ||
    data.distances.length !== points.length ||
    data.times.length !== points.length
  ) {
    console.error("[TravelTime matrix] Invalid matrix dimensions.");
    return null;
  }

  return {
    distancesKm: data.distances.map((row) =>
      row.map((distance) =>
        typeof distance === "number" && distance >= 0
          ? Math.round((distance / 1000) * 10) / 10
          : null,
      ),
    ),
    durationsMinutes: data.times.map((row) =>
      row.map((duration) =>
        typeof duration === "number" && duration >= 0
          ? Math.round(duration / 60)
          : null,
      ),
    ),
  };
}

export function fetchDirectionsMatrix(
  provider: MatrixProvider,
  points: MatrixPoint[],
  options: MatrixOptions = {},
): Promise<DirectionsTableResult | null> {
  if (provider === "openrouteservice") {
    return fetchOpenRouteServiceMatrix(points);
  }

  if (provider === "valhalla") {
    return fetchValhallaMatrix(points, {
      costing: "auto",
      dateTimeType: "current",
      ...options.valhalla,
    });
  }

  if (provider === "graphhopper") {
    return fetchGraphHopperMatrix(points);
  }

  if (provider === "traveltime") {
    return fetchTravelTimeMatrix(points, {
      transportation: "driving",
      departureTime: new Date().toISOString(),
      ...options.travelTime,
    });
  }

  return fetchOsrmDirectionsTable(points);
}

/** Fetch driving directions from OSRM without exposing provider credentials. */
/** Fetch driving directions from OSRM in the given waypoint order. */
export async function fetchDirections(
  origin: string,
  dest: string,
  waypoints?: string,
): Promise<DirectionsResult[]> {
  const coordinates = [origin, ...(waypoints ? waypoints.split("|") : []), dest]
    .map((point) => point.trim())
    .filter(Boolean)
    .map((point) => {
      const [lat, lng] = point.split(",").map((value) => Number(value.trim()));
      return { lat, lng };
    })
    .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng))
    .map(({ lat, lng }) => `${lng},${lat}`);

  if (coordinates.length < 2) {
    return [];
  }

  const url = new URL(
    `https://router.project-osrm.org/route/v1/driving/${coordinates.join(";")}`,
  );
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    code?: string;
    message?: string;
    routes?: Array<{
      distance: number;
      duration: number;
      geometry?: { coordinates: [number, number][] };
    }>;
  };

  if (data.code && data.code !== "Ok") {
    console.error("[api/directions]", data.code, data.message);
  }

  const route = data.routes?.[0];
  if (!route) return [];

  const coords = (route.geometry?.coordinates ?? []).map(
    ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
  );

  return [
    {
      coordinates: coords,
      distance_km: Math.round(((route.distance ?? 0) / 1000) * 10) / 10,
      duration_minutes: Math.round((route.duration ?? 0) / 60),
    },
  ];
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin");
  const dest = req.nextUrl.searchParams.get("dest");
  const wps = req.nextUrl.searchParams.get("waypoints");

  console.log("[api/directions] request payload", {
    url: req.url,
    origin,
    dest,
    waypoints: wps,
  });

  if (!origin || !dest)
    return NextResponse.json({ error: "missing origin/dest" }, { status: 400 });

  const result = await fetchDirections(origin, dest, wps ?? undefined);
  return NextResponse.json(result);
}
