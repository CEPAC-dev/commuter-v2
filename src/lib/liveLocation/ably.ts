import "server-only";
import Ably from "ably";

let client: Ably.Rest | null = null;

function getClient(): Ably.Rest {
  const key = process.env.ABLY_API_KEY?.trim();
  if (!key) throw new Error("ABLY_API_KEY is not configured.");
  if (!client) client = new Ably.Rest({ key });
  return client;
}

export function tripLocationChannel(tripId: string): string {
  return `trip:${tripId}`;
}

export async function createTripLocationTokenRequest(
  tripId: string,
  clientId: string,
) {
  const capability = JSON.stringify({
    [tripLocationChannel(tripId)]: ["subscribe"],
  });
  return getClient().auth.createTokenRequest({
    clientId,
    capability,
    ttl: 60_000,
  });
}

export async function publishTripDriverLocation(
  tripIds: string[],
  location: {
    lat: number;
    lng: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
    recordedAt: string;
    receivedAt: string;
  },
): Promise<void> {
  const ably = getClient();
  await Promise.all(
    [...new Set(tripIds)].map((tripId) =>
      ably.channels
        .get(tripLocationChannel(tripId))
        .publish({ name: "driver-location", data: location }),
    ),
  );
}

export async function publishTripDriverLocationStopped(
  tripIds: string[],
  stoppedAt: string,
): Promise<void> {
  const ably = getClient();
  await Promise.all(
    [...new Set(tripIds)].map((tripId) =>
      ably.channels
        .get(tripLocationChannel(tripId))
        .publish({ name: "driver-location-stopped", data: { stoppedAt } }),
    ),
  );
}
