const fs = require("fs");
const { MongoClient } = require("mongodb");

const REGION_CODES = ["EG-CAIRO", "SA", "AE-ABU-DHABI"];
const REGION_ALIASES = { EG: "EG-CAIRO", KSA: "SA" };
const apply = process.argv.includes("--apply");

function loadEnv() {
    if (!fs.existsSync(".env.local")) return;
    for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
        if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
        }
    }
}

function canonicalRegion(user) {
    if (REGION_CODES.includes(user?.defaultRegionCode)) {
        return user.defaultRegionCode;
    }
    return REGION_ALIASES[user?.region] ??
        (REGION_CODES.includes(user?.region) ? user.region : "EG-CAIRO");
}

async function main() {
    loadEnv();
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
    const uriDatabase = new URL(process.env.MONGODB_URI).pathname.replace(/^\/+/, "");
    const dbName = process.env.DB_NAME || uriDatabase || undefined;
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();

    try {
        const db = client.db(dbName);
        const users = db.collection("users");
        const drivers = db.collection("drivers");
        const availability = db.collection("availabilities");
        const trips = db.collection("trips");
        const rides = db.collection("rides");

        const userRows = await users
            .find({})
            .project({ region: 1, defaultRegionCode: 1 })
            .toArray();
        const userRegionById = new Map(
            userRows.map((user) => [String(user._id), canonicalRegion(user)]),
        );

        const driverTypeRows = await drivers
            .find({ carType: "private" })
            .project({ _id: 1 })
            .toArray();
        const tripDriverTypeRows = await trips
            .find({ "assignedDriver.carType": "private" })
            .project({ _id: 1 })
            .toArray();
        const rideDriverTypeRows = await rides
            .find({ "assignedDriver.carType": "private" })
            .project({ _id: 1 })
            .toArray();
        const availabilityRows = await availability
            .find({ regionCode: { $nin: REGION_CODES } })
            .project({ _id: 1, driverId: 1 })
            .toArray();
        const tripRows = await trips
            .find({ regionCode: { $nin: REGION_CODES } })
            .project({ _id: 1, userId: 1 })
            .toArray();

        const allRides = await rides
            .find({ regionCode: { $nin: REGION_CODES } })
            .project({ _id: 1, driverId: 1, passengers: 1 })
            .toArray();
        const passengerTripIds = [
            ...new Map(
                allRides
                    .flatMap((ride) => ride.passengers ?? [])
                    .map((passenger) => [String(passenger.tripId), passenger.tripId]),
            ).values(),
        ];
        const passengerTrips = passengerTripIds.length
            ? await trips
                .find({ _id: { $in: passengerTripIds } })
                .project({ _id: 1, regionCode: 1, userId: 1 })
                .toArray()
            : [];
        const tripRegionById = new Map(
            passengerTrips.map((trip) => [
                String(trip._id),
                REGION_CODES.includes(trip.regionCode)
                    ? trip.regionCode
                    : userRegionById.get(String(trip.userId)),
            ]),
        );

        const availabilityOps = availabilityRows.flatMap((record) => {
            const regionCode = userRegionById.get(String(record.driverId));
            return regionCode
                ? [{ updateOne: { filter: { _id: record._id }, update: { $set: { regionCode } } } }]
                : [];
        });
        const tripOps = tripRows.flatMap((trip) => {
            const regionCode = userRegionById.get(String(trip.userId));
            return regionCode
                ? [{ updateOne: { filter: { _id: trip._id }, update: { $set: { regionCode } } } }]
                : [];
        });
        const rideOps = allRides.flatMap((ride) => {
            const passengerTrip = (ride.passengers ?? []).find((passenger) =>
                tripRegionById.has(String(passenger.tripId)),
            );
            const regionCode = passengerTrip
                ? tripRegionById.get(String(passengerTrip.tripId))
                : userRegionById.get(String(ride.driverId));
            return regionCode
                ? [{ updateOne: { filter: { _id: ride._id }, update: { $set: { regionCode } } } }]
                : [];
        });

        const plan = {
            mode: apply ? "apply" : "dry-run",
            driverCarTypesToRename: driverTypeRows.length,
            tripDriverSnapshotsToRename: tripDriverTypeRows.length,
            rideDriverSnapshotsToRename: rideDriverTypeRows.length,
            availabilityRegionsToBackfill: availabilityOps.length,
            tripRegionsToBackfill: tripOps.length,
            rideRegionsToBackfill: rideOps.length,
            availabilityWithoutOwnerRegion: availabilityRows.length - availabilityOps.length,
            tripsWithoutOwnerRegion: tripRows.length - tripOps.length,
            ridesWithoutInferableRegion: allRides.length - rideOps.length,
        };

        if (apply) {
            if (driverTypeRows.length) {
                await drivers.updateMany(
                    { carType: "private" },
                    { $set: { carType: "passenger_car" } },
                );
            }
            if (tripDriverTypeRows.length) {
                await trips.updateMany(
                    { "assignedDriver.carType": "private" },
                    { $set: { "assignedDriver.carType": "passenger_car" } },
                );
            }
            if (rideDriverTypeRows.length) {
                await rides.updateMany(
                    { "assignedDriver.carType": "private" },
                    { $set: { "assignedDriver.carType": "passenger_car" } },
                );
            }
            if (availabilityOps.length) await availability.bulkWrite(availabilityOps);
            if (tripOps.length) await trips.bulkWrite(tripOps);
            if (rideOps.length) await rides.bulkWrite(rideOps);
        }
        console.log(JSON.stringify(plan, null, 2));
    } finally {
        await client.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
