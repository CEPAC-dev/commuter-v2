import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  buildChatReportSnapshot,
  CHAT_REPORT_OPEN_UNIQUE_INDEX,
  isAlreadyReported,
  validateChatReportInput,
  validateChatReportReviewInput,
} = await import("../src/lib/chatReports.ts");

test("chat report validation permits supported reasons and trims optional notes", () => {
  assert.deepEqual(
    validateChatReportInput({ reason: "contact_sharing", note: "  Details  " }),
    { ok: true, reason: "contact_sharing", note: "Details" },
  );
  assert.deepEqual(
    validateChatReportInput({ reason: "other", note: "  " }),
    { ok: true, reason: "other" },
  );
});

test("chat report validation rejects invalid reasons and notes over 300 characters", () => {
  assert.deepEqual(
    validateChatReportInput({ reason: "unknown" }),
    { ok: false, errorCode: "INVALID_REPORT_REASON" },
  );
  assert.deepEqual(
    validateChatReportInput({ reason: "abuse", note: 12 }),
    { ok: false, errorCode: "INVALID_REPORT_NOTE" },
  );
  assert.deepEqual(
    validateChatReportInput({ reason: "abuse", note: "x".repeat(301) }),
    { ok: false, errorCode: "REPORT_NOTE_TOO_LONG" },
  );
});

test("only an existing open report triggers the duplicate-report rule", () => {
  assert.equal(isAlreadyReported(true), true);
  assert.equal(isAlreadyReported(false), false);

  assert.deepEqual(CHAT_REPORT_OPEN_UNIQUE_INDEX, {
    keys: { reporterId: 1, tripId: 1 },
    options: {
      unique: true,
      partialFilterExpression: { status: "open" },
      name: "chat_reporter_trip_one_open",
    },
  });
});

test("report snapshots contain only the approved message evidence fields", () => {
  const snapshot = buildChatReportSnapshot([
    {
      _id: "message-id",
      senderId: "private-user-id",
      senderRole: "driver",
      kind: "text",
      text: "I'll wait at the pickup.",
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
    },
    {
      _id: "preset-message-id",
      senderId: "private-driver-id",
      senderRole: "user",
      kind: "preset",
      presetKey: "at_pickup",
      createdAt: new Date("2026-04-01T10:01:00.000Z"),
    },
  ]);

  assert.deepEqual(snapshot, [
    {
      senderRole: "driver",
      kind: "text",
      text: "I'll wait at the pickup.",
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
    },
    {
      senderRole: "user",
      kind: "preset",
      presetKey: "at_pickup",
      createdAt: new Date("2026-04-01T10:01:00.000Z"),
    },
  ]);
  assert.equal("senderId" in snapshot[0], false);
  assert.equal("_id" in snapshot[0], false);
});

test("admin review accepts only reviewed or dismissed and trims notes", () => {
  assert.deepEqual(
    validateChatReportReviewInput({ status: "reviewed", adminNote: "  checked  " }),
    { ok: true, status: "reviewed", adminNote: "checked" },
  );
  assert.deepEqual(
    validateChatReportReviewInput({ status: "open" }),
    { ok: false, errorCode: "INVALID_REVIEW_STATUS" },
  );
  assert.deepEqual(
    validateChatReportReviewInput({ status: "dismissed", adminNote: "x".repeat(1001) }),
    { ok: false, errorCode: "ADMIN_NOTE_TOO_LONG" },
  );
});

test("both admin chat-report routes reject requests denied by adminAuth", async () => {
  const routes = [
    "../src/app/api/admin/chat-reports/route.ts",
    "../src/app/api/admin/chat-reports/[id]/route.ts",
  ];
  for (const path of routes) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /const authorization = await adminAuth\(\);/);
    assert.match(
      source,
      /if \(!authorization\.authorized\) return authorization\.response;/,
    );
  }
  const authSource = await readFile(
    new URL("../src/lib/middleware/adminAuth.ts", import.meta.url),
    "utf8",
  );
  assert.match(authSource, /user\.role !== "admin"/);
});
