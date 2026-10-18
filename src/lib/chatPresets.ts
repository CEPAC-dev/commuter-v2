export const CHAT_PRESETS = {
  driver: [
    "arrived",
    "running_late_2",
    "running_late_5",
    "where_are_you",
    "cant_find_you",
    "waiting",
    "starting_now",
  ],
  passenger: [
    "on_my_way",
    "at_pickup",
    "running_late",
    "cant_see_you",
    "thanks",
  ],
} as const;

export type ChatSenderRole = keyof typeof CHAT_PRESETS;
export type ChatPresetKey =
  | (typeof CHAT_PRESETS.driver)[number]
  | (typeof CHAT_PRESETS.passenger)[number];

export function isChatPreset(
  role: ChatSenderRole,
  key: unknown,
): key is ChatPresetKey {
  return (
    typeof key === "string" &&
    (CHAT_PRESETS[role] as readonly string[]).includes(key)
  );
}

export function getChatPresets(role: ChatSenderRole): readonly ChatPresetKey[] {
  return CHAT_PRESETS[role];
}

export function isChatFreeTextEnabled(
  value = process.env.CHAT_FREE_TEXT_ENABLED,
): boolean {
  return value === "true";
}
