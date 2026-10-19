import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile(
  new URL("../src/app/api/actions/ride/[rideId]/route.ts", import.meta.url),
  "utf8",
);

test("both no-show transition paths enforce the persisted-arrival wait", () => {
  assert.match(route, /case "confirm_no_show_arrival"/);
  assert.match(route, /case "station_arrived":[\s\S]*?canMarkNoShow\(/);
  assert.match(route, /case "no_show":[\s\S]*?canMarkNoShow\(/);
  assert.match(route, /errorCode: "NO_SHOW_TOO_EARLY"/);
  assert.match(route, /arrivedAt: null/);
});
