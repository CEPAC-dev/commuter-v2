export const CHAT_REPORT_REASONS = [
  "abuse",
  "contact_sharing",
  "harassment",
  "other",
] as const;

export const CHAT_REPORT_OPEN_UNIQUE_INDEX = {
  keys: { reporterId: 1 as const, tripId: 1 as const },
  options: {
    unique: true as const,
    partialFilterExpression: { status: "open" as const },
  },
};

export type ChatReportReason = (typeof CHAT_REPORT_REASONS)[number];

export type ChatReportInput =
  | { ok: true; reason: ChatReportReason; note?: string }
  | { ok: false; errorCode: string };

export function isChatReportReason(value: unknown): value is ChatReportReason {
  return (
    typeof value === "string" &&
    CHAT_REPORT_REASONS.includes(value as ChatReportReason)
  );
}

export function validateChatReportInput(input: {
  reason?: unknown;
  note?: unknown;
}): ChatReportInput {
  if (!isChatReportReason(input.reason)) {
    return { ok: false, errorCode: "INVALID_REPORT_REASON" };
  }
  if (input.note !== undefined && typeof input.note !== "string") {
    return { ok: false, errorCode: "INVALID_REPORT_NOTE" };
  }
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > 300) {
    return { ok: false, errorCode: "REPORT_NOTE_TOO_LONG" };
  }
  return { ok: true, reason: input.reason, ...(note ? { note } : {}) };
}

export function isAlreadyReported(hasOpenReport: boolean): boolean {
  return hasOpenReport;
}

export function buildChatReportSnapshot<
  T extends {
    senderRole: "user" | "driver";
    kind: "text" | "preset";
    presetKey?: string;
    text?: string;
    createdAt: Date | string;
  },
>(messages: T[]) {
  return messages.map((message) => ({
    senderRole: message.senderRole,
    kind: message.kind,
    ...(message.presetKey ? { presetKey: message.presetKey } : {}),
    ...(message.text !== undefined ? { text: message.text } : {}),
    createdAt: message.createdAt,
  }));
}
