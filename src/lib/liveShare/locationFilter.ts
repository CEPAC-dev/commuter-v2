export function buildLocationUpdateFilter(input: {
  shareId: string;
  tripId: unknown;
  userId: string;
  now: Date;
  earliestReceivedAt: Date;
}) {
  return {
    _id: input.shareId,
    tripId: input.tripId,
    userId: input.userId,
    active: true,
    revokedAt: null,
    endedAt: null,
    expiresAt: { $gt: input.now },
    $or: [
      { "lastLocation.receivedAt": { $exists: false } },
      { "lastLocation.receivedAt": null },
      {
        "lastLocation.receivedAt": {
          $lte: input.earliestReceivedAt,
        },
      },
    ],
  };
}
