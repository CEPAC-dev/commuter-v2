import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

export const PointSchema = new Schema(
  {
    address: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false },
);

const PassengerDetailSchema = new Schema(
  {
    sameAsMain: { type: Boolean, required: true, default: true },
    pickup: { type: PointSchema, required: false },
    dropoff: { type: PointSchema, required: false },
  },
  { _id: false },
);

export const StationSchema = new Schema(
  {
    id: { type: Number, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    name: { type: String, required: true },
  },
  { _id: false },
);

const StationOptionSchema = new Schema(
  {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    distanceKm: { type: Number, required: true, min: 0 },
    walkingMin: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

export const StopSchema = new Schema(
  {
    point: { type: PointSchema, required: true },
    alighting: { type: Number, required: true, min: 0 },
    boarding: { type: Number, required: true, min: 0 },
    waitingMinutes: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const AssignedDriverSchema = new Schema(
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
);

const TripSchema = new Schema(
  {
    tripNumber: {
      type: Number,
      required: true,
      unique: true,
      sparse: true,
      immutable: true,
    },
    requestId: {
      type: Types.ObjectId,
      ref: "Request",
      required: true,
      index: true,
    },
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    driverId: {
      type: Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    assignedDriver: {
      type: AssignedDriverSchema,
      required: false,
      default: null,
    },
    date: { type: String, required: true, index: true },
    cycleIndex: { type: Number, required: true, min: 0 },
    pickup: { type: PointSchema, required: true },
    dropoff: { type: PointSchema, required: true },
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
    rideType: { type: String, required: true, enum: ["private", "shared"] },
    arrivalTime: { type: String, required: true },
    pickupTime: { type: String, required: true },
    distanceKm: { type: Number, required: true },
    durationMinutes: { type: Number, required: true },
    priceEgp: { type: Number, required: true },
    extraPassengers: { type: Number, default: 0, min: 0, max: 9 },
    passengers: { type: [PassengerDetailSchema], default: [] },
    numberOfPassengers: { type: Number, default: 1, min: 1 },
    stops: { type: [StopSchema], default: [] },
    pickupStation: { type: StationSchema, required: false },
    dropoffStation: { type: StationSchema, required: false },
    pickupStationOptions: { type: [StationOptionSchema], default: [] },
    dropoffStationOptions: { type: [StationOptionSchema], default: [] },
    walkingMinToStation: { type: Number, min: 0 },
    walkingMinFromStation: { type: Number, min: 0 },
    paymentStatus: {
      type: String,
      required: true,
      default: "pending",
      enum: ["pending", "paid", "failed", "refunded", "expired"],
    },
    status: {
      type: String,
      required: true,
      default: "pending_payment",
      enum: [
        "pending_payment",
        "submitted",
        "matched",
        "confirmed",
        "active",
        "completed",
        "cancelled",
        "time_out",
      ],
    },
    rideId: {
      type: Types.ObjectId,
      ref: "Ride",
      required: false,
      index: true,
      default: null,
    },
  },
  { timestamps: true, collection: "trips" },
);

TripSchema.index({ requestId: 1, date: 1 });
TripSchema.index({ userId: 1, date: -1 });
TripSchema.index({ driverId: 1, date: -1 });

// const existingTripModel = models.Trip;
// if (existingTripModel && !existingTripModel.schema.path("tripNumber")) {
//   existingTripModel.schema.add({ tripNumber: TripSchema.obj.tripNumber });
// }

export type TripDoc = InferSchemaType<typeof TripSchema>;
export const Trip = models.Trip || model("Trip", TripSchema);
