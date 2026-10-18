const MAX_CHAT_RETENTION_DAYS = Math.floor(2_147_483_647 / (24 * 60 * 60));

export function parseChatRetentionDays(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 30;
  const days = Number(value);
  if (
    !Number.isSafeInteger(days) ||
    days < 1 ||
    days > MAX_CHAT_RETENTION_DAYS
  ) {
    throw new Error(
      `CHAT_RETENTION_DAYS must be a whole number between 1 and ${MAX_CHAT_RETENTION_DAYS}.`,
    );
  }
  return days;
}

export const CHAT_RETENTION_DAYS = parseChatRetentionDays(
  process.env.CHAT_RETENTION_DAYS,
);
export const CHAT_RETENTION_SECONDS = CHAT_RETENTION_DAYS * 24 * 60 * 60;

export const MESSAGE_RETENTION_TTL_INDEX = {
  keys: { createdAt: 1 as const },
  options: {
    expireAfterSeconds: CHAT_RETENTION_SECONDS,
    name: "chat_messages_created_at_ttl",
  },
};
