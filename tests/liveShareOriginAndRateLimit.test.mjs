import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { validateMutationRequest } = await import(
  "../src/lib/security/request.ts"
);

function request(url, { origin, contentType } = {}) {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  if (contentType) headers.set("content-type", contentType);
  return { url, headers };
}

test("share mutation routes use the existing origin validator", async () => {
  process.env.APP_URL = "https://commuter.example";
  const shareRoute = await readFile(
    new URL("../src/app/api/trips/[id]/share/route.ts", import.meta.url),
    "utf8",
  );
  const locationRoute = await readFile(
    new URL("../src/app/api/trips/[id]/share/location/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(shareRoute, /export async function POST\(request: NextRequest/);
  assert.match(shareRoute, /validateMutationRequest\(request\)/);
  assert.match(
    shareRoute,
    /export async function DELETE\(request: NextRequest[\s\S]*?validateMutationRequest\(request,\s*\{\s*requireJson:\s*false\s*\}\)/,
  );
  assert.match(locationRoute, /export async function POST\(request: NextRequest/);
  assert.match(locationRoute, /validateMutationRequest\(request\)/);

  const rejected = validateMutationRequest(
    request("https://commuter.example/api/trips/id/share", {
      origin: "https://attacker.example",
      contentType: "application/json",
    }),
  );
  assert.equal(rejected.status, 403);
});

test("same-origin sender POST and share DELETE pass mutation validation", () => {
  process.env.APP_URL = "https://commuter.example";
  const post = validateMutationRequest(
    request("https://commuter.example/api/trips/id/share/location", {
      origin: "https://commuter.example",
      contentType: "application/json",
    }),
  );
  const deleteRequest = validateMutationRequest(
    request("https://commuter.example/api/trips/id/share", {
      origin: "https://commuter.example",
    }),
    { requireJson: false },
  );
  assert.equal(post, null);
  assert.equal(deleteRequest, null);
});

test("anonymous directions rate limit executes before provider routing", async () => {
  const route = await readFile(
    new URL("../src/app/api/directions/route.ts", import.meta.url),
    "utf8",
  );
  const handler = route.slice(route.indexOf("export async function GET"));
  const sessionLookup = handler.indexOf("await getSession()");
  const limiter = handler.indexOf('enforceRateLimit(req, "directions"');
  const providerCall = handler.indexOf("await fetchDirections(origin, dest");
  assert.ok(sessionLookup >= 0 && limiter > sessionLookup);
  assert.ok(providerCall > limiter);
  assert.match(handler, /limit:\s*60,\s*windowMs:\s*60_000/);
  assert.match(handler, /if \(limited\) return limited/);
});
