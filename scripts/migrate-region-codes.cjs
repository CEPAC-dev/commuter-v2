/* eslint-disable @typescript-eslint/no-require-imports */
const { loadEnvConfig } = require("@next/env");
const { MongoClient } = require("mongodb");

const REGION_CODE_MAP = {
    "EG-CAIRO": "EGY",
    EG: "EGY",
    SA: "KSA",
    "AE-ABU-DHABI": "UAE",
    AE: "UAE",
};
const REGION_VALUE_FIELDS = new Set(["regionCode", "defaultRegionCode", "region"]);
const REGION_ARRAY_FIELDS = new Set(["allowedRegionCodes", "regionCodes"]);
const REGION_INDEX_FIELDS = new Set([
    ...REGION_VALUE_FIELDS,
    ...REGION_ARRAY_FIELDS,
]);
const COUNTER_PREFIX = "station-dataset:";

function mapRegionCode(value) {
    return typeof value === "string" &&
        Object.prototype.hasOwnProperty.call(REGION_CODE_MAP, value)
        ? REGION_CODE_MAP[value]
        : value;
}

function rewriteDocument(document) {
    const changedPaths = new Set();
    const changedRoots = new Set();

    function rewrite(value, key, path, rootKey) {
        if (REGION_VALUE_FIELDS.has(key) && typeof value === "string") {
            const mapped = mapRegionCode(value);
            if (mapped !== value) {
                changedPaths.add(path);
                changedRoots.add(rootKey);
            }
            return mapped;
        }

        if (Array.isArray(value)) {
            let changed = false;
            let rewritten = value.map((item, index) => {
                if (REGION_ARRAY_FIELDS.has(key)) {
                    const mapped = mapRegionCode(item);
                    if (mapped !== item) {
                        changed = true;
                        changedPaths.add(path);
                    }
                    return mapped;
                }
                const child = rewrite(item, String(index), `${path}[${index}]`, rootKey);
                if (child !== item) changed = true;
                return child;
            });
            if (REGION_ARRAY_FIELDS.has(key)) {
                const uniqueValues = [...new Set(rewritten)];
                if (uniqueValues.length !== rewritten.length) {
                    changed = true;
                    changedPaths.add(path);
                }
                rewritten = uniqueValues;
            }
            if (changed) changedRoots.add(rootKey);
            return rewritten;
        }

        if (
            !value ||
            typeof value !== "object" ||
            value instanceof Date ||
            value._bsontype ||
            Buffer.isBuffer(value)
        ) {
            return value;
        }

        return Object.fromEntries(
          Object.entries(value).map(([childKey, childValue]) => {
            const childPath = path ? `${path}.${childKey}` : childKey;
            return [
              childKey,
              rewrite(
                childValue,
                childKey,
                childPath,
                rootKey || childKey,
              ),
            ];
          }),
        );
    }

    const rewritten = rewrite(document, "", "", "");
    return {
        document: rewritten,
        changedPaths: [...changedPaths],
        changedRoots: [...changedRoots],
    };
}

function getPath(document, path) {
    return path.split(".").reduce((value, part) => value?.[part], document);
}

function matchesPartialFilter(document, filter) {
    for (const [key, expected] of Object.entries(filter ?? {})) {
        if (key === "$and") {
            if (!expected.every((part) => matchesPartialFilter(document, part))) {
                return false;
            }
        } else if (
            expected &&
            typeof expected === "object" &&
            !Array.isArray(expected)
        ) {
            if ("$eq" in expected) {
                if (getPath(document, key) !== expected.$eq) return false;
            } else if ("$exists" in expected) {
                if ((getPath(document, key) !== undefined) !== expected.$exists) {
                    return false;
                }
            } else {
                throw new Error(
                    `Unsupported partial index filter while checking ${key}.`,
                );
            }
        } else if (getPath(document, key) !== expected) {
            return false;
        }
    }
    return true;
}

function indexValue(value) {
    if (value === undefined) return null;
    if (value && typeof value.toHexString === "function") return value.toHexString();
    if (value instanceof Date) return value.toISOString();
    return value;
}

function getUniqueIndexCollision(index, document) {
    if (
        Object.keys(index.key).some(
            (path) =>
                path.includes("regionConfigs") ||
                path.includes("allowedRegionCodes") ||
                path.includes("regionCodes"),
        )
    ) {
        throw new Error(
            `Cannot safely preflight unique multikey index ${index.name}.`,
        );
    }
    if (index.partialFilterExpression &&
        !matchesPartialFilter(document, index.partialFilterExpression)) {
        return null;
    }
    const paths = Object.keys(index.key);
    const values = paths.map((path) => getPath(document, path));
    if (index.sparse && values.every((value) => value === undefined)) return null;
    if (values.some(Array.isArray)) {
        throw new Error(
            `Cannot safely preflight unique multikey index ${index.name}.`,
        );
    }
    return JSON.stringify(values.map(indexValue));
}

function findVehicleConfigDuplicates(document) {
    const duplicates = [];
    function visit(value, path) {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) {
            if (
                value.every(
                    (item) =>
                        item &&
                        typeof item === "object" &&
                        typeof item.regionCode === "string" &&
                        typeof item.cityCode === "string",
                )
            ) {
                const seen = new Set();
                for (const item of value) {
                    const key = `${item.regionCode}:${item.cityCode}`;
                    if (seen.has(key)) duplicates.push(`${path} (${key})`);
                    seen.add(key);
                }
            }
            value.forEach((item, index) => visit(item, `${path}[${index}]`));
            return;
        }
        if (value._bsontype || value instanceof Date) return;
        for (const [key, child] of Object.entries(value)) {
            visit(child, path ? `${path}.${key}` : key);
        }
    }
    visit(document, "");
    return duplicates;
}

async function inspectCollections(db) {
    const collectionNames = (await db.listCollections().toArray())
        .filter((item) => item.type === "collection")
        .map((item) => item.name)
        .filter((name) => !name.startsWith("system."));
    const plans = [];
    const collisions = [];

    for (const name of collectionNames) {
        const collection = db.collection(name);
        const indexes = await collection.indexes().catch((error) => {
            if (error.codeName === "NamespaceNotFound") return [];
            throw error;
        });
        const uniqueIndexes = indexes.filter(
            (index) =>
                index.unique &&
                Object.keys(index.key).some((path) =>
                    path.split(".").some((part) => REGION_INDEX_FIELDS.has(part)),
                ),
        );
        const seenByIndex = new Map(
            uniqueIndexes.map((index) => [index.name, new Map()]),
        );
        const summary = { collection: name, documents: 0, changed: 0, fields: {} };
        const cursor = collection.find({});

        for await (const document of cursor) {
            summary.documents += 1;
            const { document: rewritten, changedPaths } = rewriteDocument(document);
            const changedConfigs = changedPaths.some(
                (path) => path.includes("regionConfigs") && path.endsWith(".regionCode"),
            );
            const duplicates = changedConfigs
                ? findVehicleConfigDuplicates(rewritten)
                : [];
            if (duplicates.length) {
                collisions.push(
                    `${name}/${document._id}: duplicate region/city configs: ${duplicates.join(", ")}`,
                );
            }
            if (changedPaths.length) {
                summary.changed += 1;
                for (const path of changedPaths) {
                    summary.fields[path] = (summary.fields[path] ?? 0) + 1;
                }
            }

            for (const index of uniqueIndexes) {
                const key = getUniqueIndexCollision(index, rewritten);
                if (key === null) continue;
                const seen = seenByIndex.get(index.name);
                const previousId = seen.get(key);
                if (previousId !== undefined && String(previousId) !== String(document._id)) {
                    collisions.push(
                        `${name}.${index.name}: ${previousId} and ${document._id} collide after code migration`,
                    );
                } else {
                    seen.set(key, document._id);
                }
            }
        }
        plans.push(summary);
    }

    return { plans, collisions };
}

async function applyCollectionChanges(db, collectionName) {
    const collection = db.collection(collectionName);
    const operations = [];

    async function flush() {
        if (!operations.length) return;
        await collection.bulkWrite(operations, { ordered: true });
        operations.length = 0;
    }

    for await (const document of collection.find({})) {
        const { document: rewritten, changedRoots } = rewriteDocument(document);
        if (!changedRoots.length) continue;
        const set = Object.fromEntries(
            changedRoots.map((key) => [key, rewritten[key]]),
        );
        operations.push({
            updateOne: { filter: { _id: document._id }, update: { $set: set } },
        });
        if (operations.length >= 500) await flush();
    }
    await flush();
}

async function migrateStationDatasetCounters(db, apply) {
    const counters = db.collection("counters");
    const oldIds = Object.keys(REGION_CODE_MAP).map(
        (code) => `${COUNTER_PREFIX}${code}:`,
    );
    const documents = await counters
        .find({ _id: { $type: "string", $regex: `^${COUNTER_PREFIX}` } })
        .toArray();
    const plans = [];

    for (const document of documents) {
        const oldPrefix = oldIds.find((prefix) => document._id.startsWith(prefix));
        if (!oldPrefix) continue;
        const oldRegionCode = document._id
            .slice(COUNTER_PREFIX.length)
            .split(":")[0];
        const suffix = document._id.slice(
            COUNTER_PREFIX.length + oldRegionCode.length,
        );
        const newId = `${COUNTER_PREFIX}${REGION_CODE_MAP[oldRegionCode]}${suffix}`;
        const existing = await counters.findOne({ _id: newId });
        plans.push({ oldId: document._id, newId, value: document.value });
        if (apply) {
            await counters.updateOne(
                { _id: newId },
                { $max: { value: document.value ?? 0 } },
                { upsert: true },
            );
            await counters.deleteOne({ _id: document._id });
        }
        if (existing) plans[plans.length - 1].mergesWithExisting = true;
    }
    return plans;
}

async function main() {
    loadEnvConfig(process.cwd());
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");

    const apply = process.argv.includes("--apply");
    const uri = process.env.MONGODB_URI;
    const uriDatabase = new URL(uri).pathname.replace(/^\/+/, "").split("?")[0];
    const dbName = process.env.DB_NAME || decodeURIComponent(uriDatabase) || undefined;
    const client = new MongoClient(uri);
    await client.connect();
    try {
        const db = client.db(dbName);
        const { plans, collisions } = await inspectCollections(db);
        console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", plans }, null, 2));
        if (collisions.length) {
            console.error("Migration stopped; resolve these conflicts first:");
            for (const collision of collisions) console.error(`- ${collision}`);
            process.exitCode = 1;
            return;
        }

        const counters = await migrateStationDatasetCounters(db, false);
        console.log(JSON.stringify({ stationDatasetCounters: counters }, null, 2));
        if (!apply) {
            console.log("Dry run only. Re-run with --apply after reviewing the plan and creating a verified backup.");
            return;
        }

        for (const { collection, changed } of plans) {
            if (changed) await applyCollectionChanges(db, collection);
        }
        await migrateStationDatasetCounters(db, true);
        console.log("Region codes migrated. Old aliases remain accepted for legacy reads but are no longer canonical.");
    } finally {
        await client.close();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}

module.exports = { mapRegionCode, rewriteDocument };
