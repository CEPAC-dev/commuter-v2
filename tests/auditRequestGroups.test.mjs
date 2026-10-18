import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../scripts/audit-request-groups.mjs", import.meta.url),
  "utf8",
);

test("Request-group audit script contains no database write operations", () => {
  assert.doesNotMatch(
    source,
    /\.(?:updateOne|updateMany|insertOne|insertMany|deleteOne|deleteMany|bulkWrite|save|findOneAndUpdate|findOneAndDelete|replaceOne)\s*\(/,
  );
});

test("Request-group audit script emits each of the seven reports once", () => {
  const reports = [...source.matchAll(/report:\s*(\d+)/g)].map((match) =>
    Number(match[1]),
  );
  assert.deepEqual(reports, [1, 2, 3, 4, 5, 6, 7]);
  assert.match(source, /request_payment_manual_review/);
  assert.match(source, /process\.exitCode = reports\.every/);
});
