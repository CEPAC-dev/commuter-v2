export const CHAT_FREE_TEXT_STRIKE_LIMIT = 3;
export const CHAT_FREE_TEXT_STRIKE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isChatFreeTextSuspended(blockedCount: number): boolean {
  return blockedCount >= CHAT_FREE_TEXT_STRIKE_LIMIT;
}

export function isChatFreeTextAllowed({
  enabled,
  canWrite,
  blockedCount,
}: {
  enabled: boolean;
  canWrite: boolean;
  blockedCount: number;
}): boolean {
  return enabled && canWrite && !isChatFreeTextSuspended(blockedCount);
}
