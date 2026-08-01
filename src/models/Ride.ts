import { Schema, model, models, Types, type InferSchemaType } from "mongoose";
import { PointSchema, StopSchema, StationSchema } from "./Trip";

export const AssignedDriverSchema = new Schema(
  {
    name: { type: String, required: false },
    phone: { type: String, required: false },
    profilePic: { type: String, required: false },
    carBrand: { type: String, required: false },
    carModel: { type: String, required: false },
    modelYear: { type: String, required: false },
    plate: { type: String, required: false },
  },
  { _id: false },
); // same shape as Trip's — extract this too if you want a single source of truth

const RidePassengerSchema = new Schema(
  {
    tripId: { type: Types.ObjectId, ref: "Trip", required: true, index: true },
    userId: { type: Types.ObjectId, ref: "User", required: true },
    pickup: { type: PointSchema, required: true },
    dropoff: { type: PointSchema, required: true },
    pickupOrder: { type: Number, required: true, min: 0 },
    dropoffOrder: { type: Number, required: true, min: 0 },
    numberOfPassengers: { type: Number, required: true, min: 1, default: 1 },
    tripCost: { type: Number, required: true, min: 0, default: 0 },
    pickupStation: { type: StationSchema, required: false },
    dropoffStation: { type: StationSchema, required: false },
    seatNumbers: { type: [Number], default: [] },
    status: {
      type: String,
      required: true,
      default: "waiting",
      enum: ["waiting", "picked_up", "dropped_off", "no_show", "cancelled"],
    },
  },
  { _id: false },
);

const RideSchema = new Schema(
  {
    rideNumber: {
      type: Number,
      required: true,
      unique: true,
      sparse: true,
      immutable: true,
    },
    availabilityId: {
      type: Types.ObjectId,
      ref: "availabilities",
      required: true,
    },
    driverId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedDriver: {
      type: AssignedDriverSchema,
      required: false,
      default: null,
    },
    date: { type: String, required: true, index: true },
    rideType: { type: String, required: true, enum: ["private", "shared"] },
    vehicleType: {
      type: String,
      required: true,
      enum: [
        "private_car",
        "taxi_private",
        "taxi_shared",
        "van_shared",
        "microbus_shared",
      ],
    },
    // combined, ordered pickup/dropoff sequence across all passengers on this ride
    route: { type: [StopSchema], default: [] },
    pickupStation: { type: StationSchema, required: false },
    dropoffStation: { type: StationSchema, required: false },
    driverOrigin: { type: PointSchema, required: false },
    driverDestination: { type: PointSchema, required: false },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    passengers: { type: [RidePassengerSchema], default: [] },
    totalCost: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      required: true,
      default: "matched",
      enum: ["matched", "confirmed", "active", "completed", "cancelled"],
    },
  },
  { timestamps: true, collection: "rides" },
);

RideSchema.index({ driverId: 1, date: -1 });
RideSchema.index({ availabilityId: 1 }); // add { unique: true } if one availability can only ever produce one ride
RideSchema.index({ "passengers.tripId": 1 });

export type RideDoc = InferSchemaType<typeof RideSchema>;
export const Ride = models.Ride || model("Ride", RideSchema);
