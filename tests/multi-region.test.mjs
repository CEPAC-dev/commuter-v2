import assert from "node:assert/strict";
import test from "node:test";
import {
    getCurrencyConfig,
    getRegionBySlug,
    normalizeRegion,
} from "../src/lib/config/regions.ts";
import { formatMoney } from "../src/lib/money.ts";
import { validateStationGeoJson } from "../src/lib/stations/validateGeoJson.ts";
import { diffStationDataset } from "../src/lib/stations/diffDataset.ts";
import { diffStationDatasetDetailed } from "../src/lib/stations/diffDataset.ts";
import { vehicleForRegion } from "../src/lib/vehicles/regionConfig.ts";

test("normalizes legacy region aliases", () => {
    assert.equal(normalizeRegion("EG"), "EG-CAIRO");
    assert.equal(normalizeRegion("KSA"), "SA");
    assert.equal(getRegionBySlug("ae")?.code, "AE-ABU-DHABI");
});

test("resolves regional currencies", () => {
    assert.equal(getCurrencyConfig("EG-CAIRO").code, "EGP");
    assert.equal(getCurrencyConfig("SA").code, "SAR");
    assert.equal(getCurrencyConfig("AE-ABU-DHABI").code, "AED");
});

test("resolves city-specific vehicle settings without changing Region currency", () => {
    const vehicle = {
        key: "private_car",
        label: "Private Car",
        rate: 6,
        additional_rate: 0,
        ride: "private",
        vehicle_type: 1,
        trip_type: 1,
        buffer: 20,
        window: 10,
        capacity: 4,
        occupancy: 4,
        min_occupancy: 1,
        minimum_charge: 75,
        regionCodes: ["EG-CAIRO"],
        regionConfigs: [
            {
                regionCode: "EG-CAIRO",
                cityCode: "cairo",
                currencyCode: "EGP",
                pricingConfigured: true,
                active: true,
                rate: 6,
                additional_rate: 0,
                buffer: 20,
                window: 10,
                capacity: 4,
                occupancy: 4,
                min_occupancy: 1,
                minimum_charge: 75,
                vehicle_type: 1,
                trip_type: 1,
                sortOrder: 0,
            },
            {
                regionCode: "EG-CAIRO",
                cityCode: "alexandria",
                currencyCode: "EGP",
                pricingConfigured: true,
                active: true,
                rate: 8,
                additional_rate: 0,
                buffer: 20,
                window: 10,
                capacity: 4,
                occupancy: 4,
                min_occupancy: 1,
                minimum_charge: 90,
                vehicle_type: 1,
                trip_type: 1,
                sortOrder: 0,
            },
        ],
    };

    assert.equal(
        vehicleForRegion(vehicle, "EG-CAIRO", "alexandria")?.rate,
        8,
    );
    assert.equal(
        vehicleForRegion(vehicle, "EG-CAIRO", "alexandria")?.currencyCode,
        "EGP",
    );
});

test("validates supported station GeoJSON", () => {
    const result = validateStationGeoJson(
        {
            type: "FeatureCollection",
            features: [
                {
                    id: 1,
                    geometry: { type: "Point", coordinates: [31.2357, 30.0444] },
                    properties: { name: "Station One", station_type: "1" },
                },
            ],
        },
        "EG-CAIRO",
    );
    assert.equal(result.validCount, 1);
    assert.equal(result.invalidCount, 0);
});

test("rejects duplicate source ids and invalid coordinates", () => {
    const result = validateStationGeoJson(
        {
            type: "FeatureCollection",
            features: [
                {
                    id: 1,
                    geometry: { type: "Point", coordinates: [31.2357, 30.0444] },
                    properties: { name: "One", station_type: "1" },
                },
                {
                    id: 1,
                    geometry: { type: "Point", coordinates: [200, 95] },
                    properties: { name: "Two", station_type: "1" },
                },
            ],
        },
        "EG-CAIRO",
    );
    assert.equal(result.validCount, 1);
    assert.equal(result.invalidCount, 1);
    assert.ok(result.errors.some((issue) => issue.code === "DUPLICATE_SOURCE_ID"));
    assert.ok(result.errors.some((issue) => issue.code === "INVALID_COORDINATES"));
});

test("computes actual station dataset changes", () => {
    const base = {
        direction: "",
        zones: "",
        description: "",
        landmark: "",
        stationType: "1",
        lat: 30,
        lng: 31,
    };
    const diff = diffStationDataset(
        [
            { ...base, objectId: 1, name: "Changed" },
            { ...base, objectId: 2, name: "New" },
        ],
        [
            { ...base, objectId: 1, name: "Old" },
            { ...base, objectId: 3, name: "Removed" },
        ],
    );
    assert.deepEqual(diff, {
        newCount: 1,
        updatedCount: 1,
        unchangedCount: 0,
        removedCount: 1,
    });
});

test("formats money using the regional currency", () => {
    assert.match(formatMoney("en", 125, "EG-CAIRO"), /EGP/);
    assert.match(formatMoney("en", 125, "SA"), /SAR/);
    assert.match(formatMoney("en", 125, "AE-ABU-DHABI"), /AED/);
});

test("includes changed source fields in station dataset previews", () => {
    const base = { direction: "N", zones: "Z", description: "", landmark: "", stationType: "1", lat: 30, lng: 31 };
    const detail = diffStationDatasetDetailed(
        [{ ...base, objectId: 1, name: "New name", lat: 30.1 }],
        [{ ...base, objectId: 1, name: "Old name" }],
    );
    assert.equal(detail.updated.length, 1);
    assert.deepEqual(detail.updated[0].changedFields, ["name", "lat"]);
});
