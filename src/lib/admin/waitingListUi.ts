export type WaitingListErrorKey =
  | "waitingListErrorBadRequest"
  | "waitingListErrorUnauthorized"
  | "waitingListErrorForbidden"
  | "waitingListErrorNotFound"
  | "waitingListErrorConflict"
  | "waitingListErrorPastTrip"
  | "waitingListErrorServer"
  | "waitingListErrorNetwork";

export function formatWaitingListAge(
  createdAt: string,
  nowMs = Date.now(),
): { unit: "justNow" | "minutes" | "hours" | "days"; count: number } {
  const createdMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdMs)) return { unit: "justNow", count: 0 };
  const elapsedMinutes = Math.max(0, Math.floor((nowMs - createdMs) / 60000));
  if (elapsedMinutes < 1) return { unit: "justNow", count: 0 };
  if (elapsedMinutes < 60) return { unit: "minutes", count: elapsedMinutes };
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return { unit: "hours", count: elapsedHours };
  return { unit: "days", count: Math.floor(elapsedHours / 24) };
}

export function waitingListErrorKey(
  status: number | null,
  errorCode?: string,
): WaitingListErrorKey {
  if (errorCode === "WAITING_LIST_TRIP_IN_PAST") return "waitingListErrorPastTrip";
  if (status === 400) return "waitingListErrorBadRequest";
  if (status === 401) return "waitingListErrorUnauthorized";
  if (status === 403) return "waitingListErrorForbidden";
  if (status === 404) return "waitingListErrorNotFound";
  if (status === 409) return "waitingListErrorConflict";
  if (status !== null && status >= 500) return "waitingListErrorServer";
  return "waitingListErrorNetwork";
}

export function waitingListErrorMessageKey(errorKey: WaitingListErrorKey): string {
  const keys: Record<WaitingListErrorKey, string> = {
    waitingListErrorBadRequest: "error_bad_request",
    waitingListErrorUnauthorized: "error_unauthorized",
    waitingListErrorForbidden: "error_forbidden",
    waitingListErrorNotFound: "error_not_found",
    waitingListErrorConflict: "conflict",
    waitingListErrorPastTrip: "past_error",
    waitingListErrorServer: "error_server",
    waitingListErrorNetwork: "error_network",
  };
  return keys[errorKey];
}

export function formatAdminBadgeCount(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > 99 ? "99+" : String(Math.floor(count));
}
