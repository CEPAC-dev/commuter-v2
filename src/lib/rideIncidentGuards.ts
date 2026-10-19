export const RIDE_INCIDENT_TYPES = [
  "vehicle_breakdown",
  "accident",
  "emergency",
  "passenger_issue",
  "other",
] as const;

export type RideIncidentType = (typeof RIDE_INCIDENT_TYPES)[number];

export type RideIncidentReportDecision =
  | { kind: "allowed"; note: string | undefined }
  | { kind: "forbidden" }
  | { kind: "invalid_type" }
  | { kind: "invalid_note" }
  | { kind: "note_too_long" }
  | { kind: "status_conflict" }
  | { kind: "already_reported" };

export function getRideIncidentReportDecision(input: {
  isAssignedDriver: boolean;
  rideStatus: string;
  hasOpenIncident: boolean;
  type: unknown;
  note: unknown;
}): RideIncidentReportDecision {
  if (!input.isAssignedDriver) return { kind: "forbidden" };
  if (
    typeof input.type !== "string" ||
    !RIDE_INCIDENT_TYPES.includes(input.type as RideIncidentType)
  ) {
    return { kind: "invalid_type" };
  }
  const note =
    input.note === undefined || input.note === null
      ? undefined
      : typeof input.note === "string"
        ? input.note.trim() || undefined
        : null;
  if (note === null) return { kind: "invalid_note" };
  if (note && note.length > 300) return { kind: "note_too_long" };
  if (!["confirmed", "active"].includes(input.rideStatus)) {
    return { kind: "status_conflict" };
  }
  if (input.hasOpenIncident) return { kind: "already_reported" };
  return { kind: "allowed", note };
}

export function getRideIncidentWithdrawalDecision(input: {
  isAssignedDriver: boolean;
  incidentStatus: string | null;
  resolution?: string | null;
}):
  | { kind: "allowed" }
  | { kind: "forbidden" }
  | { kind: "no_open_incident" }
  | { kind: "already_withdrawn" } {
  if (!input.isAssignedDriver) return { kind: "forbidden" };
  if (input.incidentStatus === "open") return { kind: "allowed" };
  if (
    input.incidentStatus === "resolved" &&
    input.resolution === "withdrawn_by_driver"
  ) {
    return { kind: "already_withdrawn" };
  }
  return { kind: "no_open_incident" };
}
