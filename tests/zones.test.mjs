import assert from "node:assert/strict";
import test from "node:test";
import {
    findZoneAtPoint,
    getZoneName,
    isPointInAnyZone,
} from "../src/lib/geo/zones.ts";

const zone = {
    type: "Feature",
    id: "ZONE 1",
    properties: { NAME: "Central zone" },
    geometry: {
        type: "Polygon",
        coordinates: [
            [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
            [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
        ],
    },
};

test("finds the containing zone and uses its mapped name", () => {
    const found = findZoneAtPoint([2, 3], [zone]);

    assert.equal(found, zone);
    assert.equal(getZoneName(found), "Central zone");
    assert.equal(isPointInAnyZone([2, 3], [zone]), true);
});

test("rejects points outside service zones and inside polygon holes", () => {
    assert.equal(findZoneAtPoint([20, 20], [zone]), undefined);
    assert.equal(findZoneAtPoint([5, 5], [zone]), undefined);
    assert.equal(isPointInAnyZone([5, 5], [zone]), false);
});

test("uses the map feature id when a zone name is unavailable", () => {
    assert.equal(getZoneName({ type: "Feature", id: "ZONE 1" }), "ZONE 1");
});
