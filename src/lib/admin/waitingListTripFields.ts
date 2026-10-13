export type WaitingListTripFields = {
  pickup: string;
  dropoff: string;
  pickupTime: string;
  arrivalTime: string;
  numberOfPassengers: number;
  preferedGender: "male" | "female" | null;
};

export type WaitingListTripField = keyof WaitingListTripFields;

const fields: WaitingListTripField[] = [
  "pickup",
  "dropoff",
  "pickupTime",
  "arrivalTime",
  "numberOfPassengers",
  "preferedGender",
];

export function groupIdenticalWaitingListTripFields(
  trips: readonly WaitingListTripFields[],
): {
  sharedFields: WaitingListTripField[];
  perTripFields: { index: number; fields: WaitingListTripField[] }[];
} {
  const sharedFields = fields.filter(
    (field) =>
      trips.length > 0 &&
      trips.every((trip) => trip[field] === trips[0][field]),
  );
  const perTripFields = trips.map((_, index) => ({
    index,
    fields: fields.filter((field) => !sharedFields.includes(field)),
  }));
  return { sharedFields, perTripFields };
}
