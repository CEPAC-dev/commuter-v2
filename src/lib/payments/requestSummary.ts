const FINAL_TRIP_STATUSES = new Set([
  "cancelled",
  "no_show",
  "refunded",
  "completed",
]);

export function buildRequestSummaryUpdate(input: {
  tripStatuses: readonly string[];
  paymentOverallStatus?: string;
}): { status?: string; paymentStatus?: string } {
  const update: { status?: string; paymentStatus?: string } = {};
  if (
    input.paymentOverallStatus === "paid" ||
    input.paymentOverallStatus === "partially_refunded" ||
    input.paymentOverallStatus === "refunded" ||
    input.paymentOverallStatus === "failed"
  ) {
    update.paymentStatus = input.paymentOverallStatus;
  }
  if (
    input.tripStatuses.length > 0 &&
    input.tripStatuses.every((status) => FINAL_TRIP_STATUSES.has(status))
  ) {
    update.status = input.tripStatuses.every((status) => status === "completed")
      ? "completed"
      : "cancelled";
  }
  return update;
}
