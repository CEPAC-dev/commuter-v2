import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  CHAT_RETENTION_DAYS,
  CHAT_RETENTION_SECONDS,
  MESSAGE_RETENTION_TTL_INDEX,
  parseChatRetentionDays,
} = await import("../src/lib/chatRetention.ts");

test("chat retention defaults to 30 days and accepts positive whole days", () => {
  assert.equal(parseChatRetentionDays(undefined), 30);
  assert.equal(parseChatRetentionDays(""), 30);
  assert.equal(parseChatRetentionDays("14"), 14);
  assert.throws(() => parseChatRetentionDays("0"), /whole number/);
  assert.throws(() => parseChatRetentionDays("1.5"), /whole number/);
  assert.throws(() => parseChatRetentionDays("24856"), /between 1 and 24855/);
  assert.equal(CHAT_RETENTION_SECONDS, CHAT_RETENTION_DAYS * 24 * 60 * 60);
});

test("Message TTL index uses createdAt and the configured retention interval", () => {
  assert.deepEqual(MESSAGE_RETENTION_TTL_INDEX, {
    keys: { createdAt: 1 },
    options: {
      expireAfterSeconds: CHAT_RETENTION_DAYS * 24 * 60 * 60,
      name: "chat_messages_created_at_ttl",
    },
  });
});

test("index script checks and creates the Message TTL index outside request handlers", async () => {
  const source = await readFile(
    new URL("../scripts/ensureIndexes.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /if \(checkOnly\)/);
  assert.match(source, /indexesFor\("messages"\)/);
  assert.match(source, /listIndexes\(\)\.toArray\(\)/);
  assert.match(source, /messages\.createIndex\(/);
  assert.match(source, /chat_messages_created_at_ttl/);
});
