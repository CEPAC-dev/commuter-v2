export type ChatTextFilterReason =
  | "phone_number"
  | "spelled_phone_number"
  | "url"
  | "email"
  | "handle"
  | "messaging_contact";

export type ChatTextFilterResult =
  | { ok: true }
  | { ok: false; reason: ChatTextFilterReason };

const ZERO_WIDTH_AND_DIACRITICS =
  /[\u0610-\u061A\u0640\u064B-\u065F\u0670\u06D6-\u06ED\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const DIGIT_SEPARATORS = String.raw`[\s().,_/-]*`;
const LONG_DIGIT_RUN = new RegExp(
  String.raw`(?<![\p{L}\d])\+?(?:\d${DIGIT_SEPARATORS}){6,}\d(?![\p{L}\d])`,
  "u",
);
const URL_OR_DOMAIN =
  /(?:https?:\/\/|www\.|(?:^|[\s([{])(?:[a-z0-9-]+\.)+(?:com|net|org|me|io|app|co|eg)\b|(?:^|[\s([{])(?:wa\.me|t\.me|bit\.ly)\b)/iu;
const EMAIL = /\b[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}\b/iu;
const HANDLE = /(?<![\p{L}\p{N}])@[\p{L}\p{N}_]+/u;
const MESSAGING_KEYWORDS =
  /(?<![\p{L}\p{N}])(?:whatsapp|واتس|واتساب|telegram|تيليجرام|signal|viber|فايبر|imo)(?![\p{L}\p{N}])/iu;

const SPELLED_DIGITS = new Set([
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "صفر",
  "واحد",
  "واحدة",
  "اثنان",
  "اثنين",
  "اتنين",
  "ثلاثة",
  "ثلاثه",
  "تلاتة",
  "تلاته",
  "أربعة",
  "اربعة",
  "أربعه",
  "اربعه",
  "خمسة",
  "خمسه",
  "ستة",
  "سته",
  "سبعة",
  "سبعه",
  "ثمانية",
  "ثمانيه",
  "تسعة",
  "تسعه",
]);

function normalizeChatText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[٠-٩۰-۹]/g, (digit) => {
      const code = digit.codePointAt(0)!;
      return String(
        code >= 0x06f0 && code <= 0x06f9
          ? code - 0x06f0
          : code - 0x0660,
      );
    })
    .replace(ZERO_WIDTH_AND_DIACRITICS, "")
    .toLowerCase();
}

function hasSpelledDigitRun(text: string): boolean {
  const words = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  let run = 0;
  for (const word of words) {
    run = SPELLED_DIGITS.has(word) ? run + 1 : 0;
    if (run >= 7) return true;
  }
  return false;
}

export function checkChatText(text: string): ChatTextFilterResult {
  const normalized = normalizeChatText(text);

  if (LONG_DIGIT_RUN.test(normalized)) {
    return { ok: false, reason: "phone_number" };
  }
  if (hasSpelledDigitRun(normalized)) {
    return { ok: false, reason: "spelled_phone_number" };
  }
  if (EMAIL.test(normalized)) return { ok: false, reason: "email" };
  if (HANDLE.test(normalized)) return { ok: false, reason: "handle" };
  if (URL_OR_DOMAIN.test(normalized)) return { ok: false, reason: "url" };
  if (
    MESSAGING_KEYWORDS.test(normalized) &&
    (normalized.match(/\d/g)?.length ?? 0) >= 4
  ) {
    return { ok: false, reason: "messaging_contact" };
  }
  return { ok: true };
}
