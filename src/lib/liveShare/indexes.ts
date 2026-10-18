export const TRIP_SHARE_ACTIVE_INDEX = {
  keys: { tripId: 1, userId: 1 },
  options: {
    unique: true,
    partialFilterExpression: { active: true },
    name: "trip_user_one_active_share",
  },
} as const;

export const TRIP_SHARE_DELETE_AT_INDEX = {
  keys: { deleteAt: 1 },
  options: {
    expireAfterSeconds: 0,
    name: "trip_share_delete_at_ttl",
  },
} as const;
