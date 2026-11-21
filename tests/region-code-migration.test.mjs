import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { rewriteDocument } = require("../scripts/migrate-region-codes.cjs");

test("migrates region identifiers at top level and in nested configuration", () => {
  const source = {
    regionCode: "EG-CAIRO",
    defaultRegionCode: "AE-ABU-DHABI",
    region: "SA",
    allowedRegionCodes: ["EG-CAIRO", "EG", "KSA", "AE-ABU-DHABI", "AE"],
    vehicle: {
      regionConfigs: [
        { regionCode: "SA", cityCode: "riyadh" },
        { regionCode: "AE-ABU-DHABI", cityCode: "abu-dhabi" },
      ],
    },
    countryCode: "SA",
  };

  const result = rewriteDocument(source);
  assert.deepEqual(result.document, {
    regionCode: "EGY",
    defaultRegionCode: "UAE",
    region: "KSA",
    allowedRegionCodes: ["EGY", "KSA", "UAE"],
    vehicle: {
      regionConfigs: [
        { regionCode: "KSA", cityCode: "riyadh" },
        { regionCode: "UAE", cityCode: "abu-dhabi" },
      ],
    },
    countryCode: "SA",
  });
  assert.deepEqual(result.changedRoots.sort(), [
    "allowedRegionCodes",
    "defaultRegionCode",
    "region",
    "regionCode",
    "vehicle",
  ]);
});

test("deduplicates region access codes after canonicalizing aliases", () => {
  const result = rewriteDocument({
    regionCodes: ["EG-CAIRO", "EG", "SA", "KSA", "AE", "UAE"],
  });

  assert.deepEqual(result.document.regionCodes, ["EGY", "KSA", "UAE"]);
});
