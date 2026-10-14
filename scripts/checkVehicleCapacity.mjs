import mongoose from "mongoose";
import { loadEnvConfig } from "@next/env";
import { getVehiclePassengerCapacity } from "../src/lib/config/vehicles.ts";

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
    rides.find({}, { projection: { rideNumber: 1, vehicleType: 1, passengers: 1 } }).toArray(),
    trips.find({}, { projection: { tripNumber: 1, vehicleType: 1, numberOfPassengers: 1 } }).toArray(),
  ]);

  const overCapacityRides = rideDocs.flatMap((ride) => {
    const totalPeople = (ride.passengers ?? []).reduce(
      (total, passenger) =>
        total + Math.max(1, Number(passenger.numberOfPassengers ?? 1) || 1),
      0,
    );
    const capacity = getVehiclePassengerCapacity(ride.vehicleType ?? "");
    return totalPeople > capacity
      ? [{ rideId: String(ride._id), rideNumber: ride.rideNumber, vehicleType: ride.vehicleType, totalPeople, capacity }]
      : [];
  });
  const overCapacityTrips = tripDocs.flatMap((trip) => {
    const passengers = Math.max(1, Number(trip.numberOfPassengers ?? 1) || 1);
    const capacity = getVehiclePassengerCapacity(trip.vehicleType ?? "");
    return passengers > capacity
      ? [{ tripId: String(trip._id), tripNumber: trip.tripNumber, vehicleType: trip.vehicleType, passengers, capacity }]
      : [];
  });

  console.log(JSON.stringify({ overCapacityRides, overCapacityTrips }, null, 2));
} finally {
  await mongoose.disconnect();
}
