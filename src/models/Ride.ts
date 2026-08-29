import { Schema, model, models, Types, type InferSchemaType } from "mongoose";
import { PointSchema, StationSchema } from "./Trip";

export const AssignedDriverSchema = new Schema(
  {
    name: { type: String, required: false },
    phone: { type: String, required: false },
    profilePic: { type: String, required: false },
    profilePicture: { type: String, required: false },
    carBrand: { type: String, required: false },
    carModel: { type: String, required: false },
    carType: { type: String, required: false },
    vehicleColor: { type: String, required: false },
    carCapacity: { type: Number, required: false },
    modelYear: { type: String, required: false },
    carImage: { type: String, required: false },
    plate: { type: String, required: false },
    plateChar1: { type: String, required: false },
    plateChar2: { type: String, required: false },
    plateChar3: { type: String, required: false },
    plateDigits: { type: String, required: false },
  },
  { _id: false },
); // same shape as Trip's — extract this too if you want a single source of truth

const RidePassengerSchema = new Schema(
  {
    tripId: { type: Types.ObjectId, ref: "Trip", required: true },
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
      enum: [
        "waiting",
        "boarding",
        "on_board",
        "picked_up",
        "dropped_off",
        "no_show",
        "cancelled",
      ],
    },
  },
  { _id: false },
);

// Append-only audit trail of every driver action/status change on this ride.
const RideLogEntrySchema = new Schema(
  {
    action: { type: String, required: true },
    tripId: { type: Types.ObjectId, ref: "Trip", required: false },
    userId: { type: Types.ObjectId, ref: "User", required: false },
    stationIndex: { type: Number, required: false },
    stationName: { type: String, required: false },
    previousStatus: { type: String, required: false },
    newStatus: { type: String, required: false },
    metadata: { type: Schema.Types.Mixed, required: false, default: {} },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const RideRouteStopSchema = new Schema(
  {
    point: { type: PointSchema, required: true },
    arrival: { type: String, required: false },
    departure: { type: String, required: false },
    waitingMinutes: { type: Number, required: false, default: 0 },
    boardingNumber: { type: Number, required: true, default: 0, min: 0 },
    alightingNumber: { type: Number, required: true, default: 0, min: 0 },
    boarding: { type: Schema.Types.Mixed, default: [] },
    alighting: { type: Schema.Types.Mixed, default: [] },
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
      ref: "Availability",
      required: false,
      default: null,
    },
    driverId: {
      type: Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
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
        "shared_car",
        "van_shared",
        "microbus_shared",
      ],
    },
    // combined, ordered pickup/dropoff sequence across all passengers on this ride
    route: { type: [RideRouteStopSchema], default: [] },
    pickupStation: { type: StationSchema, required: false },
    dropoffStation: { type: StationSchema, required: false },
    driverOrigin: { type: PointSchema, required: false },
    driverDestination: { type: PointSchema, required: false },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    passengers: { type: [RidePassengerSchema], default: [] },
    totalCost: { type: Number, required: true, default: 0 },
    additionalFees: { type: Number, required: false, default: 0 },
    kmRate: { type: Number, required: false, default: 0 },
    hrRate: { type: Number, required: false, default: 0 },
    // Audit trail of every action/status change made on this ride.
    logs: { type: [RideLogEntrySchema], default: [] },
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
RideSchema.index({ availabilityId: 1 });
RideSchema.index({ "passengers.tripId": 1 });

export type RideDoc = InferSchemaType<typeof RideSchema>;
export const Ride = models.Ride || model("Ride", RideSchema);