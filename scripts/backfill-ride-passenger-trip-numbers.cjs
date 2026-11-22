const mongoose = require("mongoose");
const { loadEnvConfig } = require("@next/env");

async function main() {
  loadEnvConfig(process.cwd());
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.DB_NAME,
  });
  const db = mongoose.connection.db;
  const rides = db.collection("rides");
  const trips = db.collection("trips");
  const cursor = rides.find(
    {},
    {
      projection: {
        passengers: 1,
        "route.boarding": 1,
        "route.alighting": 1,
      },
    },
  );

  let operations = [];
  let updatedRides = 0;
  let assignedNumbers = 0;

  for await (const ride of cursor) {
    const passengers = Array.isArray(ride.passengers) ? ride.passengers : [];
    const route = Array.isArray(ride.route) ? ride.route : [];
    const tripIds = new Map();
    for (const passenger of passengers) {
      if (passenger?.tripId) {
        const tripId = String(passenger.tripId);
        tripIds.set(
          tripId,
          mongoose.Types.ObjectId.isValid(tripId)
            ? new mongoose.Types.ObjectId(tripId)
            : passenger.tripId,
        );
      }
    }
    for (const stop of route) {
      for (const direction of ["boarding", "alighting"]) {
        for (const passenger of Array.isArray(stop?.[direction]) ? stop[direction] : []) {
          if (passenger?.tripId) {
            const tripId = String(passenger.tripId);
            tripIds.set(
              tripId,
              mongoose.Types.ObjectId.isValid(tripId)
                ? new mongoose.Types.ObjectId(tripId)
                : passenger.tripId,
            );
          }
        }
      }
    }
    if (tripIds.size === 0) continue;

    const tripDocuments = await trips
      .find({ _id: { $in: [...tripIds.values()] } }, { projection: { tripNumber: 1 } })
      .toArray();
    const tripNumbers = new Map(
      tripDocuments
        .filter((trip) => typeof trip.tripNumber === "number")
        .map((trip) => [String(trip._id), trip.tripNumber]),
    );
    const fields = {};
    for (const [index, passenger] of passengers.entries()) {
      const number = tripNumbers.get(String(passenger?.tripId));
      if (number != null && passenger.tripNumber == null) {
        fields[`passengers.${index}.tripNumber`] = number;
      }
    }
    for (const [stopIndex, stop] of route.entries()) {
      for (const direction of ["boarding", "alighting"]) {
        const entries = Array.isArray(stop?.[direction]) ? stop[direction] : [];
        for (const [passengerIndex, passenger] of entries.entries()) {
          const number = tripNumbers.get(String(passenger?.tripId));
          if (number != null && passenger.tripNumber == null) {
            fields[`route.${stopIndex}.${direction}.${passengerIndex}.tripNumber`] =
              number;
          }
        }
      }
    }
    if (Object.keys(fields).length === 0) continue;

    assignedNumbers += Object.keys(fields).length;
    updatedRides += 1;
    operations.push({
      updateOne: {
        filter: { _id: ride._id },
        update: { $set: fields },
      },
    });
    if (operations.length >= 500) {
      await rides.bulkWrite(operations, { ordered: false });
      operations = [];
    }
  }

  if (operations.length > 0) {
    await rides.bulkWrite(operations, { ordered: false });
  }
  console.log(
    `rides updated: ${updatedRides}; passenger trip numbers assigned: ${assignedNumbers}`,
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
