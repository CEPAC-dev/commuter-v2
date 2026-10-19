import mongoose from "mongoose";
import { loadEnvConfig } from "@next/env";
import { getVehiclePassengerCapacity } from "../src/lib/config/vehicles.ts";
import { getTripPassengerCount } from "../src/lib/rideCapacity.ts";

loadEnvConfig(process.cwd());

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is required to check vehicle capacity");
}

try {
  await mongoose.connect(uri);
  const rides = mongoose.connection.db.collection("rides");
  const trips = mongoose.connection.db.collection("trips");
  const [rideDocs, tripDocs] = await Promise.all([
    rides
      .find(
        {},
        {
          projection: {
            rideNumber: 1,
            vehicleType: 1,
            passengers: 1,
            passengersCount: 1,
            route: 1,
          },
        },
      )
      .toArray(),
    trips
      .find(
        {},
        {
          projection: {
            tripNumber: 1,
            vehicleType: 1,
            numberOfPassengers: 1,
            extraPassengers: 1,
          },
        },
      )
      .toArray(),
  ]);
  const tripPeopleById = new Map(
    tripDocs.map((trip) => [
      String(trip._id),
      getTripPassengerCount(
        trip.vehicleType ?? "",
        Math.max(1, Number(trip.numberOfPassengers ?? 1) || 1),
        Number(trip.extraPassengers ?? 0) || 0,
      ),
    ]),
  );

  const overCapacityRides = rideDocs.flatMap((ride) => {
    const peopleByTripId = new Map();
    const unattributedPassengers = [];
    const addPassenger = (passenger, includeUnattributed = true) => {
      const isObject = passenger !== null && typeof passenger === "object";
      const tripId = isObject
        ? passenger.tripId ?? passenger._id
        : passenger;
      if (tripId != null && String(tripId)) {
        const tripKey = String(tripId);
        const ridePassengerCount = Math.max(
          1,
          Number(isObject ? passenger.numberOfPassengers : undefined) || 1,
        );
        peopleByTripId.set(
          tripKey,
          Math.max(ridePassengerCount, tripPeopleById.get(tripKey) ?? 1),
        );
      } else if (
        includeUnattributed &&
        isObject &&
        passenger.numberOfPassengers != null
      ) {
        unattributedPassengers.push(
          Math.max(1, Number(passenger.numberOfPassengers) || 1),
        );
      }
    };
    for (const passenger of ride.passengers ?? []) addPassenger(passenger);
    for (const stop of ride.route ?? []) {
      for (const passenger of [
        ...(Array.isArray(stop.boarding) ? stop.boarding : []),
        ...(Array.isArray(stop.alighting) ? stop.alighting : []),
      ]) {
        addPassenger(passenger, false);
      }
    }
    const totalPeople =
      peopleByTripId.size || unattributedPassengers.length
        ? [...peopleByTripId.values(), ...unattributedPassengers].reduce(
            (total, count) => total + count,
            0,
          )
        : Number(ride.passengersCount ?? 0) || 0;
    const capacity = getVehiclePassengerCapacity(ride.vehicleType ?? "");
    return totalPeople > capacity
      ? [
          {
            rideId: String(ride._id),
            rideNumber: ride.rideNumber,
            vehicleType: ride.vehicleType,
            totalPeople,
            capacity,
          },
        ]
      : [];
  });
  const overCapacityTrips = tripDocs.flatMap((trip) => {
    const passengers = getTripPassengerCount(
      trip.vehicleType ?? "",
      Math.max(1, Number(trip.numberOfPassengers ?? 1) || 1),
      Number(trip.extraPassengers ?? 0) || 0,
    );
    const capacity = getVehiclePassengerCapacity(trip.vehicleType ?? "");
    return passengers > capacity
      ? [{ tripId: String(trip._id), tripNumber: trip.tripNumber, vehicleType: trip.vehicleType, passengers, capacity }]
      : [];
  });

  const sharedCarOverCapacityRides = overCapacityRides.filter(
    (ride) =>
      (ride.vehicleType === "shared_car" ||
        ride.vehicleType === "taxi_shared") &&
      ride.totalPeople > 3,
  );
  const sharedCarOverCapacityTrips = overCapacityTrips.filter(
    (trip) =>
      (trip.vehicleType === "shared_car" ||
        trip.vehicleType === "taxi_shared") &&
      trip.passengers > 3,
  );

  console.log(
    JSON.stringify(
      {
        overCapacityRides,
        overCapacityTrips,
        sharedCarOverCapacityRides,
        sharedCarOverCapacityTrips,
      },
      null,
      2,
    ),
  );
} finally {
  await mongoose.disconnect();
}
