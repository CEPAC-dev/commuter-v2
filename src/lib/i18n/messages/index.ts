import type { Locale } from "../config";
import { en, type MessageKey } from "./en";
import { ar } from "./ar";

export type { MessageKey } from "./en";

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, ar };
