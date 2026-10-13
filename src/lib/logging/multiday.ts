type MultiDayEvent =
  | "group_created"
  | "group_create_rejected"
  | "day_cancelled"
  | "request_cancelled"
  | "cancel_blocked"
  | "settlement_amount_mismatch";

export function logMultiDayEvent(input: {
  event: MultiDayEvent;
  requestId: string | null;
  userId: string | null;
  counts: Record<string, number>;
  reason?: string;
}) {
  console.info(
    JSON.stringify({
      tag: "[multiday]",
      event: input.event,
      requestId: input.requestId,
      userId: input.userId,
      counts: input.counts,
      ...(input.reason ? { reason: input.reason } : {}),
    }),
  );
}
