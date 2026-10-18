import { getTripChatAccess } from "./tripChatAccess.ts";

export type ChatUnreadRole = "passenger" | "driver";
export type ChatUnreadSenderRole = "user" | "driver";

export type ChatUnreadCandidate = {
  trip: {
    _id: unknown;
    userId: unknown;
    rideId?: unknown;
    status: string;
  };
  ride: {
    _id: unknown;
    driverId?: unknown;
    status: string;
    completedAt?: Date | string | null;
    passengers?: Array<{
      tripId?: unknown;
      status?: string | null;
    }>;
  } | null;
  lastReadAt: Date | null;
};

export function parseChatTripIds(value: string | null): {
  ids: string[];
  tooMany: boolean;
} {
  if (!value) return { ids: [], tooMany: false };
  const rawIds = value.split(",").map((id) => id.trim()).filter(Boolean);
  if (rawIds.length > 10) return { ids: [], tooMany: true };
  return {
    ids: [...new Set(rawIds.filter((id) => /^[\da-f]{24}$/i.test(id)))],
    tooMany: false,
  };
}

export function unreadSenderRoleFor(
  callerRole: ChatUnreadRole,
): ChatUnreadSenderRole {
  return callerRole === "driver" ? "user" : "driver";
}

export function isUnreadChatMessage(
  message: {
    tripId: unknown;
    senderRole: string;
    createdAt: Date | string;
  },
  input: {
    tripId: string;
    callerRole: ChatUnreadRole;
    lastReadAt: Date | null;
  },
): boolean {
  if (String(message.tripId) !== input.tripId) return false;
  if (message.senderRole !== unreadSenderRoleFor(input.callerRole)) return false;
  if (!input.lastReadAt) return true;
  return new Date(message.createdAt).getTime() > input.lastReadAt.getTime();
}

export function countUnreadChatMessages<
  T extends { tripId: unknown; senderRole: string; createdAt: Date | string },
>(
  messages: T[],
  input: {
    tripId: string;
    callerRole: ChatUnreadRole;
    lastReadAt: Date | null;
  },
): number {
  return messages.filter((message) => isUnreadChatMessage(message, input)).length;
}

export function getUnreadParticipants({
  session,
  candidates,
}: {
  session: { userId: string; role: "passenger" | "driver" | "admin" };
  candidates: ChatUnreadCandidate[];
}): Array<{
  tripId: string;
  role: ChatUnreadRole;
  lastReadAt: Date | null;
}> {
  const participants: Array<{
    tripId: string;
    role: ChatUnreadRole;
    lastReadAt: Date | null;
  }> = [];
  for (const candidate of candidates) {
    const access = getTripChatAccess({
      session,
      trip: candidate.trip,
      ride: candidate.ride,
    });
    if (
      !access.allowed ||
      access.role === "admin" ||
      (access.role !== "passenger" && access.role !== "driver")
    ) {
      continue;
    }
    participants.push({
      tripId: String(candidate.trip._id),
      role: access.role,
      lastReadAt: candidate.lastReadAt,
    });
  }
  return participants;
}

export function buildUnreadMessageMatch(
  participants: Array<{
    tripId: string;
    role: ChatUnreadRole;
    lastReadAt: Date | null;
  }>,
) {
  return participants.map((participant) => ({
    tripId: participant.tripId,
    senderRole: unreadSenderRoleFor(participant.role),
    ...(participant.lastReadAt
      ? { createdAt: { $gt: participant.lastReadAt } }
      : {}),
  }));
}
