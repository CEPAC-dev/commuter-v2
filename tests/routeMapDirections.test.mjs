import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRouteCoordinates } from "../src/lib/routeMapDirections.ts";

describe("RouteMap route coordinates", () => {
  it("uses supplied routeCoordinates without requesting directions", async () => {
    const routeCoordinates = [
      { lat: 30, lng: 31 },
      { lat: 30.1, lng: 31.1 },
    ];
    let requests = 0;

    const result = await loadRouteCoordinates({
      routeCoordinates,
      fetcher: async () => {
        requests += 1;
        throw new Error("Unexpected directions request");
      },
    });

    assert.strictEqual(result, routeCoordinates);
    assert.equal(requests, 0);
  });

  it("requests and uses directions when routeCoordinates are absent", async () => {
    let requestedUrl;
    const routeCoordinates = [
      { lat: 30, lng: 31 },
      { lat: 30.1, lng: 31.1 },
    ];

    const result = await loadRouteCoordinates({
      pickup: { lat: 30, lng: 31 },
      dropoff: { lat: 30.2, lng: 31.2 },
      stops: [{ lat: 30.1, lng: 31.1 }],
      fetcher: async (url) => {
        requestedUrl = url;
        return {
          ok: true,
          json: async () => [
            { coordinates: routeCoordinates.map(({ lat, lng }) => [lat, lng]) },
          ],
        };
      },
    });

    const query = new URL(requestedUrl, "https://commuter.test").searchParams;
    assert.equal(query.get("origin"), "30,31");
    assert.equal(query.get("dest"), "30.2,31.2");
    assert.equal(query.get("waypoints"), "30.1,31.1");
    assert.deepEqual(result, routeCoordinates);
  });
});
