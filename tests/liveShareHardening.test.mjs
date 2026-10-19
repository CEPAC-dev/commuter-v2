import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { recoverDuplicateShare } = await import(
  "../src/lib/liveShare/duplicateShare.ts"
);
const { validateLiveShareConsent, LIVE_SHARE_CONSENT_VERSION } = await import(
  "../src/lib/liveShare/consent.ts"
);
const { buildLocationUpdateFilter } = await import(
  "../src/lib/liveShare/locationFilter.ts"
);
const { resolveLiveTileUrl } = await import("../src/lib/liveShare/tileUrl.ts");
const { buildLiveSharePrivacyContactParagraph } = await import(
  "../src/lib/legal/liveSharePrivacy.ts"
);
const { en } = await import("../src/lib/i18n/messages/en.ts");
const { ar } = await import("../src/lib/i18n/messages/ar.ts");

test("live tile URLs require HTTPS and all tile placeholders", () => {
  const fallback = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const valid = "https://tiles.example/{z}/{x}/{y}.png";
  assert.equal(resolveLiveTileUrl(valid, fallback), valid);
  assert.equal(
    resolveLiveTileUrl("http://tiles.example/{z}/{x}/{y}.png", fallback),
    fallback,
  );
  assert.equal(
    resolveLiveTileUrl("https://tiles.example/{z}/{x}.png", fallback),
    fallback,
  );
  assert.equal(resolveLiveTileUrl("not a URL/{z}/{x}/{y}", fallback), fallback);
  assert.equal(resolveLiveTileUrl(undefined, fallback), fallback);
});

test("new shares require current explicit consent and return fields for storage", async () => {
  const acceptedAt = new Date("2026-10-12T08:00:00.000Z");
  assert.deepEqual(validateLiveShareConsent({}, acceptedAt), {
    valid: false,
    errorCode: "LIVE_SHARE_CONSENT_REQUIRED",
  });
  assert.deepEqual(
    validateLiveShareConsent(
      { consent: true, consentVersion: "older-version" },
      acceptedAt,
    ),
    { valid: false, errorCode: "LIVE_SHARE_CONSENT_VERSION_MISMATCH" },
  );
  assert.deepEqual(
    validateLiveShareConsent(
      { consent: true, consentVersion: LIVE_SHARE_CONSENT_VERSION },
      acceptedAt,
    ),
    {
      valid: true,
      consentAt: acceptedAt,
      consentVersion: "2026-10-v2",
    },
  );

  const route = await readFile(
    new URL("../src/app/api/trips/[id]/share/route.ts", import.meta.url),
    "utf8",
  );
  const model = await readFile(
    new URL("../src/models/TripShare.ts", import.meta.url),
    "utf8",
  );
  const control = await readFile(
    new URL("../src/components/trips/LiveShareControl.tsx", import.meta.url),
    "utf8",
  );
  assert.match(route, /consentAt:\s*consent\.consentAt/);
  assert.match(route, /consentVersion:\s*consent\.consentVersion/);
  assert.match(model, /consentAt:\s*\{\s*type:\s*Date,\s*required:\s*true\s*\}/);
  assert.match(model, /consentVersion:\s*\{\s*type:\s*String,\s*required:\s*true\s*\}/);
  assert.doesNotMatch(control, /localStorage|commuter-live-share-consent/);
});

test("privacy and consent translations have matching keys and no bracket placeholders", () => {
  const englishKeys = Object.keys(en).filter(
    (key) => key.startsWith("live_share.consent_") || key.startsWith("privacy."),
  );
  const arabicKeys = Object.keys(ar).filter(
    (key) => key.startsWith("live_share.consent_") || key.startsWith("privacy."),
  );
  assert.deepEqual(arabicKeys.sort(), englishKeys.sort());
  assert.ok(englishKeys.length > 0);
  for (const key of englishKeys) {
    assert.equal(en[key].includes("["), false, `${key} English`);
    assert.equal(ar[key].includes("["), false, `${key} Arabic`);
  }
});

test("consent version is current and privacy contact section is optional", async () => {
  assert.equal(LIVE_SHARE_CONSENT_VERSION, "2026-10-v2");
  assert.equal(buildLiveSharePrivacyContactParagraph(undefined), null);
  assert.equal(buildLiveSharePrivacyContactParagraph("   "), null);
  assert.deepEqual(buildLiveSharePrivacyContactParagraph("help@example.com"), {
    headingKey: "privacy.contact_heading",
    bodyKey: "privacy.contact_body",
    email: "help@example.com",
  });
});

test("duplicate active-share key races recover an active share or return conflict", async () => {
  const duplicate = Object.assign(new Error("duplicate"), { code: 11000 });
  const active = { id: "existing-share" };
  assert.deepEqual(
    await recoverDuplicateShare(duplicate, async () => active),
    { kind: "active", share: active },
  );
  assert.deepEqual(
    await recoverDuplicateShare(duplicate, async () => null),
    { kind: "conflict" },
  );
  await assert.rejects(
    recoverDuplicateShare(new Error("database failure"), async () => null),
    /database failure/,
  );
});

test("location update filter excludes ended, revoked, inactive and expired shares", () => {
  const now = new Date("2026-10-12T08:00:00.000Z");
  const filter = buildLocationUpdateFilter({
    shareId: "share-id",
    tripId: "trip-id",
    userId: "user-id",
    now,
    earliestReceivedAt: new Date(now.getTime() - 3_000),
  });
  assert.equal(filter.active, true);
  assert.equal(filter.revokedAt, null);
  assert.equal(filter.endedAt, null);
  assert.deepEqual(filter.expiresAt, { $gt: now });
});

test("public route verifies the token before connecting to Mongo", async () => {
  const route = await readFile(
    new URL("../src/app/api/live/[token]/route.ts", import.meta.url),
    "utf8",
  );
  assert.ok(
    route.indexOf("verifyShareToken(token, secret)") <
      route.indexOf("await connectDB()"),
  );
});

test("directions logging contains only provider and outcome, never request coordinates", async () => {
  const route = await readFile(
    new URL("../src/app/api/directions/route.ts", import.meta.url),
    "utf8",
  );
  const logCalls = [
    ...route.matchAll(/console\.(?:log|warn|error|info|debug)\s*\(([\s\S]*?)\);/g),
  ];
  assert.ok(logCalls.length > 0);
  for (const [, args] of logCalls) {
    assert.match(
      args.trim(),
      /^["'`]?\[api\/directions\] provider=[a-z]+ outcome=[a-z_]+["'`]?$/,
    );
  }
  assert.doesNotMatch(route, /req\.url|request payload|errorBody|data\.message/);
});

test("public live page response has a no-store header", async () => {
  const config = await readFile(
    new URL("../next.config.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    config,
    /source:\s*"\/live\/:path\*"[,\s\S]*?key:\s*"Cache-Control",\s*value:\s*"no-store"/,
  );
});
