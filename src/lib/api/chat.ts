"use client";

export type ChatMessage = {
  id: string;
  kind: "text" | "preset";
  presetKey?: string;
  text: string;
  senderRole: "user" | "driver";
  isMine: boolean;
  createdAt: string;
};

export type ChatSnapshot = {
  open: boolean;
  canWrite: boolean;
  freeTextAllowed: boolean;
  messages: ChatMessage[];
};

export class ChatRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ChatRequestError";
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ChatRequestError(
      typeof result.errorCode === "string" ? result.errorCode : "CHAT_ERROR",
      typeof result.error === "string" ? result.error : "Chat request failed.",
    );
  }
  return result as T;
}

export async function getTripMessages(
  tripId: string,
  after?: string,
): Promise<ChatSnapshot> {
  const query = after ? `?after=${encodeURIComponent(after)}` : "";
  const res = await fetch(`/api/trips/${tripId}/chat${query}`, {
    credentials: "include",
    cache: "no-store",
  });
  return parseResponse<ChatSnapshot>(res);
}

export async function sendMessage(
  tripId: string,
  body: { kind: "text"; text: string } | { kind: "preset"; presetKey: string },
): Promise<{ message: ChatMessage }> {
  const res = await fetch(`/api/trips/${tripId}/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<{ message: ChatMessage }>(res);
}

export async function submitChatReport(
  tripId: string,
  body: { reason: "abuse" | "contact_sharing" | "harassment" | "other"; note?: string },
): Promise<{ reportId: string; status: "open" }> {
  const res = await fetch(`/api/trips/${tripId}/chat/report`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse<{ reportId: string; status: "open" }>(res);
}

export async function markTripChatRead(
  tripId: string,
): Promise<{ lastReadAt: string }> {
  const res = await fetch(`/api/trips/${tripId}/chat/read`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });
  return parseResponse<{ lastReadAt: string }>(res);
}

export async function getChatUnreadCounts(
  tripIds: string[],
): Promise<Record<string, number>> {
  const query = new URLSearchParams({ tripIds: tripIds.join(",") });
  const res = await fetch(`/api/chat/unread?${query.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  return parseResponse<Record<string, number>>(res);
}
