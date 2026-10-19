import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { isMultiDayRequestsEnabled, shouldCreateRequestGroup } = await import(
  "../src/lib/config/featureFlags.ts"
);

const LISTED_USER = "64b000000000000000000001";
const UNLISTED_USER = "64b000000000000000000002";

function withRolloutEnv(enabled, allowedUserIds, work) {
  const previousFlag = process.env.MULTI_DAY_REQUESTS_ENABLED;
  const previousAllowedIds = process.env.MULTI_DAY_REQUESTS_ALLOWED_USER_IDS;
  if (enabled === null) delete process.env.MULTI_DAY_REQUESTS_ENABLED;
  else process.env.MULTI_DAY_REQUESTS_ENABLED = enabled;
  if (allowedUserIds === null) {
    delete process.env.MULTI_DAY_REQUESTS_ALLOWED_USER_IDS;
  } else {
    process.env.MULTI_DAY_REQUESTS_ALLOWED_USER_IDS = allowedUserIds;
  }
  try {
    return work();
  } finally {
    if (previousFlag === undefined) delete process.env.MULTI_DAY_REQUESTS_ENABLED;
    else process.env.MULTI_DAY_REQUESTS_ENABLED = previousFlag;
    if (previousAllowedIds === undefined) {
      delete process.env.MULTI_DAY_REQUESTS_ALLOWED_USER_IDS;
    } else {
      process.env.MULTI_DAY_REQUESTS_ALLOWED_USER_IDS = previousAllowedIds;
    }
  }
}

test("enabled allowlist permits listed users and leaves others on standalone batches", () => {
  withRolloutEnv("true", ` ${LISTED_USER},${LISTED_USER} `, () => {
    assert.equal(
      shouldCreateRequestGroup(
        isMultiDayRequestsEnabled(LISTED_USER),
        3,
      ),
      true,
    );
    assert.equal(
      shouldCreateRequestGroup(
        isMultiDayRequestsEnabled(UNLISTED_USER),
        3,
      ),
      false,
    );
    assert.equal(shouldCreateRequestGroup(false, 3), false);
  });
});

test("unset and whitespace-only allowlists permit everyone only when flag is on", () => {
  for (const allowedUserIds of [null, "  ,   , "]) {
    withRolloutEnv("true", allowedUserIds, () => {
      assert.equal(isMultiDayRequestsEnabled(LISTED_USER), true);
      assert.equal(isMultiDayRequestsEnabled(UNLISTED_USER), true);
    });
  }
  withRolloutEnv("false", null, () => {
    assert.equal(isMultiDayRequestsEnabled(LISTED_USER), false);
    assert.equal(isMultiDayRequestsEnabled(UNLISTED_USER), false);
  });
  withRolloutEnv(null, null, () => {
    assert.equal(isMultiDayRequestsEnabled(LISTED_USER), false);
  });
});

test("invalid allowlist entries are ignored without opening rollout to everyone", () => {
  withRolloutEnv("true", `not-an-id, ${LISTED_USER}, xyz`, () => {
    assert.equal(isMultiDayRequestsEnabled(LISTED_USER), true);
    assert.equal(isMultiDayRequestsEnabled(UNLISTED_USER), false);
  });
  withRolloutEnv("true", "not-an-id,xyz", () => {
    assert.equal(isMultiDayRequestsEnabled(LISTED_USER), false);
    assert.equal(isMultiDayRequestsEnabled(), false);
  });
});

test("creation API decides per user and falls back to standalone batch creation", async () => {
  const [route, page] = await Promise.all([
    readFile(new URL("../src/app/api/trips/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/create/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /isMultiDayRequestsEnabled\(userId\)/);
  assert.match(route, /groupResult \?\?[\s\S]*?createTripBatchWith/);
  assert.match(page, /isMultiDayRequestsEnabled\(session\.userId\)/);
});

test("multi-day logger emits one structured line with identifiers and counts", async () => {
  const { logMultiDayEvent } = await import("../src/lib/logging/multiday.ts");
  const originalInfo = console.info;
  const lines = [];
  console.info = (line) => lines.push(line);
  try {
    logMultiDayEvent({
      event: "group_created",
      requestId: "64b000000000000000000003",
      userId: LISTED_USER,
      counts: { dates: 2, trips: 2 },
    });
  } finally {
    console.info = originalInfo;
  }
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), {
    tag: "[multiday]",
    event: "group_created",
    requestId: "64b000000000000000000003",
    userId: LISTED_USER,
    counts: { dates: 2, trips: 2 },
  });
});
