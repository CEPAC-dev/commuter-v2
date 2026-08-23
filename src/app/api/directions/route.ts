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
  | "graphhopper";
export type ValhallaDateTimeType = "current" | "depart_at" | "arrive_by";

export interface MatrixOptions {
  valhalla?: {
    costing: "auto" | "taxi" | "bus";
    dateTimeType: ValhallaDateTimeType;
    dateTime?: string;
  };
}

type MatrixPoint = { lat: number; lng: number };

export function isMatrixProvider(
  value: string | null,
): value is MatrixProvider {
  return (
    value === "osrm" ||
    value === "openrouteservice" ||
    value === "valhalla" ||
    value === "graphhopper"
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
  if (points.length < 2) return null;

  const url = process.env.GRAPHHOPPER_URL?.trim();
  if (!url) return null;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      points: points.map(({ lat, lng }) => [lng, lat]),
      profile: "car",
      out_arrays: ["distances", "times"],
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    distances?: Array<Array<number | null>>;
    times?: Array<Array<number | null>>;
  };
  if (!data.distances || !data.times) return null;

  return {
    distancesKm: data.distances.map((row) =>
      row.map((distance) =>
        typeof distance === "number" && distance > 0
          ? Math.round((distance / 1000) * 10) / 10
          : null,
      ),
    ),
    durationsMinutes: data.times.map((row) =>
      row.map((duration) =>
        typeof duration === "number" && duration > 0
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
  if (!origin || !dest)
    return NextResponse.json({ error: "missing origin/dest" }, { status: 400 });

  const wps = req.nextUrl.searchParams.get("waypoints");
  const result = await fetchDirections(origin, dest, wps ?? undefined);
  return NextResponse.json(result);
}
