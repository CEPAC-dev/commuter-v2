import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  LIVE_VIEWER_POLL_INTERVAL_MS,
  LIVE_VIEWER_RETRY_MAX_MS,
  deriveLiveViewerState,
  getLiveViewerPollDelayMs,
  isUnavailableLiveViewerStatus,
  parsePublicLiveShare,
  retryAfterHeaderMs,
} = await import("../src/lib/liveShare/viewer.ts");
const { en } = await import("../src/lib/i18n/messages/en.ts");
const { ar } = await import("../src/lib/i18n/messages/ar.ts");

function livePayload(overrides = {}) {
  return {
    state: "live",
    tripStatus: "active",
    pickup: { lat: 30.1, lng: 31.2 },
    dropoff: { lat: 30.2, lng: 31.3 },
    location: {
      lat: 30.15,
      lng: 31.25,
      accuracy: 17,
      heading: 90,
      recordedAt: "2026-10-12T11:00:00.000Z",
      ageSeconds: 0,
    },
    driver: {
      firstName: "Driver",
      vehicle: { make: "Make", model: "Model", color: "Blue", plate: "A B C 1234" },
    },
    serverTime: "2026-10-12T11:00:00.000Z",
    ...overrides,
  };
}

test("viewer state uses server age at 44, 45 and 46 seconds", () => {
  const data = livePayload({
    location: { ...livePayload().location, ageSeconds: 44 },
  });
  assert.equal(deriveLiveViewerState(data), "live");
  assert.equal(deriveLiveViewerState(data, 999), "live");
  assert.equal(deriveLiveViewerState(data, 1_000), "stale");
  assert.equal(
    deriveLiveViewerState({
      ...data,
      location: { ...data.location, ageSeconds: 46 },
    }),
    "stale",
  );
});

test("viewer staleness ignores client wall-clock skew and GPS recordedAt", () => {
  const base = livePayload({
    location: {
      ...livePayload().location,
      recordedAt: "2099-01-01T00:00:00.000Z",
      ageSeconds: 44,
    },
    serverTime: "2026-10-12T11:00:00.000Z",
  });
  assert.equal(deriveLiveViewerState(base), "live");
  assert.equal(deriveLiveViewerState(base, 1_000), "stale");
  assert.equal(
    deriveLiveViewerState({
      ...base,
      location: { ...base.location, recordedAt: "2000-01-01T00:00:00.000Z" },
    }),
    "live",
  );
});

test("viewer state handles loading, waiting, ended, unavailable and connection", () => {
  assert.equal(deriveLiveViewerState(null, 0, { loading: true }), "loading");
  assert.equal(deriveLiveViewerState(livePayload({ state: "waiting", location: null })), "waiting");
  assert.equal(deriveLiveViewerState(livePayload({ state: "ended" })), "ended");
  assert.equal(deriveLiveViewerState(null, 0, { unavailable: true }), "unavailable");
  assert.equal(deriveLiveViewerState(livePayload(), 0, { connection: true }), "connection");
});

test("viewer polling uses ten seconds, honors retry hints and caps exponential backoff", () => {
  assert.equal(
    getLiveViewerPollDelayMs({ failureCount: 0 }),
    LIVE_VIEWER_POLL_INTERVAL_MS,
  );
  assert.equal(
    getLiveViewerPollDelayMs({ failureCount: 0, nextAfterMs: 15_000 }),
    15_000,
  );
  assert.equal(
    getLiveViewerPollDelayMs({ failureCount: 1 }),
    LIVE_VIEWER_POLL_INTERVAL_MS * 2,
  );
  assert.equal(
    getLiveViewerPollDelayMs({ failureCount: 20 }),
    LIVE_VIEWER_RETRY_MAX_MS,
  );
  assert.equal(
    getLiveViewerPollDelayMs({ failureCount: 0, retryAfterMs: 20_000 }),
    20_000,
  );
  assert.equal(
    getLiveViewerPollDelayMs({ failureCount: 0, retryAfterMs: 90_000 }),
    LIVE_VIEWER_RETRY_MAX_MS,
  );
  assert.equal(getLiveViewerPollDelayMs({ failureCount: 0, paused: true }), null);
  assert.equal(getLiveViewerPollDelayMs({ failureCount: 0, terminal: true }), null);
});

test("Retry-After supports seconds and server dates using an injectable clock", () => {
  assert.equal(retryAfterHeaderMs("12", 1_000), 12_000);
  assert.equal(
    retryAfterHeaderMs("Mon, 12 Oct 2026 11:00:10 GMT", Date.parse("2026-10-12T11:00:00Z")),
    10_000,
  );
  assert.equal(retryAfterHeaderMs(null, 0), null);
});

test("HTTP 429 remains retryable and only 404 means unavailable", () => {
  assert.equal(isUnavailableLiveViewerStatus(404), true);
  assert.equal(isUnavailableLiveViewerStatus(429), false);
  assert.equal(
    getLiveViewerPollDelayMs({ failureCount: 1, retryAfterMs: 90_000 }),
    LIVE_VIEWER_RETRY_MAX_MS,
  );
});

test("public response validation requires the public API shape", () => {
  assert.equal(parsePublicLiveShare(livePayload())?.state, "live");
  assert.equal(
    parsePublicLiveShare(livePayload({ state: "waiting", location: null }))?.state,
    "waiting",
  );
  assert.equal(parsePublicLiveShare({ error: "Not found" }), null);
});

test("public response parser strips everything outside the explicit projection", () => {
  const response = livePayload({
    passengerName: "Private Passenger",
    passengerPhone: "+201000000000",
    paymentData: { amount: 10 },
    pickup: {
      ...livePayload().pickup,
      address: "Private origin address",
      passengerEmail: "private@example.com",
    },
    dropoff: { ...livePayload().dropoff, address: "Private destination address" },
    driver: {
      ...livePayload().driver,
      phone: "+201111111111",
      nationalId: "private-id",
    },
  });
  const parsed = parsePublicLiveShare(response);
  assert.ok(parsed);
  assert.deepEqual(Object.keys(parsed).sort(), [
    "dropoff",
    "driver",
    "location",
    "pickup",
    "serverTime",
    "state",
    "tripStatus",
  ].sort());
  assert.deepEqual(Object.keys(parsed.pickup).sort(), ["lat", "lng"]);
  assert.deepEqual(Object.keys(parsed.dropoff).sort(), ["lat", "lng"]);
  assert.deepEqual(Object.keys(parsed.driver.vehicle).sort(), [
    "color",
    "make",
    "model",
    "plate",
  ]);
  assert.equal("phone" in parsed.driver, false);
  assert.equal("paymentData" in parsed, false);
});

test("English and Arabic viewer translation keys match", () => {
  const englishKeys = Object.keys(en).filter((key) => key.startsWith("live_viewer."));
  const arabicKeys = Object.keys(ar).filter((key) => key.startsWith("live_viewer."));
  assert.deepEqual(arabicKeys.sort(), englishKeys.sort());
  assert.ok(englishKeys.length > 0);
});

test("viewer page and component only read public projection fields", async () => {
  const page = await readFile(
    new URL("../src/app/(public-live)/live/[token]/page.tsx", import.meta.url),
    "utf8",
  );
  const component = await readFile(
    new URL("../src/components/live/LiveLocationViewer.tsx", import.meta.url),
    "utf8",
  );
  const helper = await readFile(
    new URL("../src/lib/liveShare/viewer.ts", import.meta.url),
    "utf8",
  );
  const source = `${page}\n${component}\n${helper}`;
  const topLevelReads = [...source.matchAll(/\bdata\??\.(\w+)/g)].map((match) => match[1]);
  assert.deepEqual(
    [...new Set(topLevelReads)].sort(),
    ["driver", "dropoff", "location", "pickup", "state"].sort(),
  );
  assert.match(source, /serverTime/);
  assert.doesNotMatch(
    source,
    /\b(?:passengerName|passengerId|phone|email|paymentStatus|paymentData|nationalId|payout|userId|_id)\b/,
  );
  assert.doesNotMatch(source, /localStorage|sessionStorage|console\.(?:log|warn|error)/);
  assert.match(component, /href="\/privacy"[\s\S]*?target="_blank"[\s\S]*?rel="noopener noreferrer"/);
  assert.doesNotMatch(component, /href=\{[^}]*token/);
});
