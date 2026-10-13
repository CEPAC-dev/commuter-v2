import type { Collection, Document } from "mongodb";

let ttlIndexAttempt: Promise<void> | undefined;

export function ensureTripSpacingLockTtlIndex<T extends Document>(
  collection: Collection<T>,
): Promise<void> {
  if (!ttlIndexAttempt) {
    ttlIndexAttempt = collection
      .createIndex(
        { updatedAt: 1 },
        {
          expireAfterSeconds: 30 * 24 * 60 * 60,
          name: "trip_spacing_locks_updatedAt_ttl",
        },
      )
      .then(() => undefined)
      .catch((error: unknown) => {
        console.warn(
          "Unable to ensure trip spacing lock TTL index:",
          error instanceof Error ? error.message : "unknown error",
        );
      });
  }
  return ttlIndexAttempt;
}
