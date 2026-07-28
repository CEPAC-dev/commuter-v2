"use client";

export interface ChatMessage {
  id: string;
  message: string;
  is_mine: boolean;
  sender?: { name: string };
  created_at: string;
}

export async function getTripMessages(
  tripId: string,
): Promise<{ data: ChatMessage[] }> {
  const res = await fetch(`/api/trips/${tripId}/chat`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}

export async function sendMessage(
  tripId: string,
  text: string,
): Promise<{ data: ChatMessage }> {
  const res = await fetch(`/api/trips/${tripId}/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}
