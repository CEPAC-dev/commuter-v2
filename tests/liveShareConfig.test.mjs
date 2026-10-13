import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { assertLiveShareSecret, createShareToken } = await import(
  "../src/lib/liveShare/token.ts"
);
const { getLiveShareBaseUrl } = await import("../src/lib/liveShare/url.ts");
const { LiveShareConfigError, logLiveShareFailure } = await import(
  "../src/lib/liveShare/errors.ts"
);

function assertConfigError(fn, code, inputValues = []) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof LiveShareConfigError);
    assert.equal(error.name, "LiveShareConfigError");
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    for (const value of inputValues) {
      assert.equal(error.message.includes(value), false);
    }
    return true;
  });
}

test("live-share secret config errors are coded and do not contain input values", () => {
  const secret = "sensitive-test-secret-value-that-is-too-short";
  assertConfigError(
    () => assertLiveShareSecret(""),
    "LIVE_SHARE_SECRET_MISSING",
    [secret],
  );
  assertConfigError(
    () => assertLiveShareSecret("x".repeat(31)),
    "LIVE_SHARE_SECRET_TOO_SHORT",
    ["x".repeat(31)],
  );
  assertConfigError(
    () => assertLiveShareSecret(`"${"x".repeat(32)}"`),
    "LIVE_SHARE_SECRET_INVALID_FORMAT",
    ["x".repeat(32)],
  );
  assert.equal(assertLiveShareSecret(`  ${"x".repeat(32)}  `), "x".repeat(32));
});

test("share token creation reports a stable config code without exposing its secret", () => {
  const secret = "secret-short";
  assertConfigError(
    () => createShareToken("0123456789abcdef01234567", secret),
    "LIVE_SHARE_SECRET_TOO_SHORT",
    [secret],
  );
});

test("APP_URL config errors distinguish missing and invalid values without exposing them", () => {
  const names = ["APP_URL", "NODE_ENV", "APP_ENV", "KASHIER_MODE"];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    delete process.env.APP_URL;
    process.env.NODE_ENV = "development";
    process.env.APP_ENV = "development";
    process.env.KASHIER_MODE = "test";
    assertConfigError(
      () => getLiveShareBaseUrl(),
      "LIVE_SHARE_APP_URL_MISSING",
    );

    const invalidUrl = "https://private.example/?private=value";
    process.env.APP_URL = invalidUrl;
    assertConfigError(
      () => getLiveShareBaseUrl(),
      "LIVE_SHARE_APP_URL_INVALID",
      [invalidUrl, "private.example", "private=value"],
    );

    process.env.APP_URL = "http://localhost:3000";
    assert.equal(getLiveShareBaseUrl(), "http://localhost:3000");
    process.env.APP_ENV = "production";
    assertConfigError(
      () => getLiveShareBaseUrl(),
      "LIVE_SHARE_APP_URL_INVALID",
      ["http://localhost:3000"],
    );
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test("live-share catch blocks log only route, error name, and config code", async () => {
  const paths = [
    "../src/app/api/trips/[id]/share/route.ts",
    "../src/app/api/trips/[id]/share/location/route.ts",
    "../src/app/api/live/[token]/route.ts",
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /error\.message|request\.url|req\.url|params\.token/);
    assert.match(source, /logLiveShareFailure\(/);
  }
});

test("safe diagnostic logs include config code but omit arbitrary error messages", () => {
  const originalError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    logLiveShareFailure(
      "POST /api/trips/[id]/share",
      new LiveShareConfigError("LIVE_SHARE_SECRET_TOO_SHORT"),
    );
    logLiveShareFailure(
      "POST /api/trips/[id]/share",
      new Error("database URI contains private information"),
    );
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(logs, [
    [
      "POST /api/trips/[id]/share",
      "LiveShareConfigError",
      "LIVE_SHARE_SECRET_TOO_SHORT",
    ],
    ["POST /api/trips/[id]/share", "Error"],
  ]);
});
