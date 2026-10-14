import test from "node:test";
import assert from "node:assert/strict";

const { checkChatText } = await import("../src/lib/chatTextFilter.ts");

const blockedExamples = [
  ["Egyptian mobile digits", "Call me 01012345678"],
  ["number with separators", "+20 (10) 1234-5678"],
  ["Arabic-Indic digits", "٠١٠١٢٣٤٥٦٧٨"],
  ["Extended Arabic-Indic digits", "۰۱۰۱۲۳۴۵۶۷۸"],
  ["digits separated by zero-width characters", "010\u200B123\u200D45678"],
  ["digits separated by tatweel and tashkeel", "٠١٠ـ١٢٣َ٤٥٦٧٨"],
  ["seven English digit words", "zero one zero one two three four"],
  ["seven Arabic digit words", "صفر واحد اثنين ثلاثة أربعة خمسة ستة"],
  ["HTTP URL", "Meet me at https://example.com/ride"],
  ["www URL", "www.example.net"],
  ["common-TLD domain", "Use example.co.eg please"],
  ["messaging domain", "Send it using wa.me"],
  ["email address", "Contact me at rider@example.org"],
  ["at-handle", "Message @rider_name"],
  ["messaging app with four digits", "WhatsApp 1234"],
  ["Arabic messaging app with four digits", "واتساب ١٢٣٤"],
];

for (const [description, text] of blockedExamples) {
  test(`blocks ${description}`, () => {
    assert.equal(checkChatText(text).ok, false);
  });
}

const allowedExamples = [
  ["a normal time", "I'll arrive at 10:30"],
  ["a short duration", "I'm running 5 minutes late"],
  ["a seat number", "I'm in seat 3"],
  ["a passenger number", "Passenger 2 is here"],
  ["a building number", "Wait outside building 1234"],
  ["a plate fragment with letters", "Blue car plate ABC 1234"],
  ["an ordinary ride update", "I'm at the pickup station now"],
];

for (const [description, text] of allowedExamples) {
  test(`allows ${description}`, () => {
    assert.deepEqual(checkChatText(text), { ok: true });
  });
}
