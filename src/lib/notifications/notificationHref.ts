export function getNotificationHref(input: {
  data: Record<string, unknown>;
  type?: string;
}): string {
  const { data, type } = input;
  const linkUrl = data.linkUrl;
  if (typeof linkUrl === "string" && linkUrl.length > 0) return linkUrl;

  const tripId = data.tripId;
  if (typeof tripId === "string") return `/my-trips/${tripId}`;

  if (type === "referral_bonus") return "/wallet";
  if (type === "ride_offer") return "/ride-requests";
  return "/my-trips";
}
