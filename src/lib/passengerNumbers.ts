export type PassengerNumberEntry = {
  passengerNumber?: unknown;
};

export function assignMissingPassengerNumbers<T extends PassengerNumberEntry>(
  passengers: readonly T[],
  passengerNumberSequence = 0,
): { passengers: Array<T & { passengerNumber: number }>; sequence: number } {
  const normalizedSequence =
    Number.isSafeInteger(passengerNumberSequence) && passengerNumberSequence > 0
      ? passengerNumberSequence
      : 0;
  const used = new Set<number>();
  for (const passenger of passengers) {
    const number = passenger.passengerNumber;
    if (
      typeof number === "number" &&
      Number.isSafeInteger(number) &&
      number > 0
    ) {
      used.add(number);
    }
  }

  const hadAssignedNumbers = used.size > 0 || normalizedSequence > 0;
  let nextNumber = Math.max(normalizedSequence, ...used, 0);
  const assigned = passengers.map((passenger, index) => {
    const current = passenger.passengerNumber;
    if (
      typeof current === "number" &&
      Number.isSafeInteger(current) &&
      current > 0
    ) {
      return { ...passenger, passengerNumber: current };
    }

    let assignedNumber = hadAssignedNumbers ? nextNumber + 1 : index + 1;
    while (used.has(assignedNumber)) assignedNumber += 1;
    used.add(assignedNumber);
    nextNumber = Math.max(nextNumber, assignedNumber);
    return { ...passenger, passengerNumber: assignedNumber };
  });

  return {
    passengers: assigned,
    sequence: Math.max(normalizedSequence, nextNumber, ...used, 0),
  };
}

export function getNextPassengerNumber(
  passengers: readonly PassengerNumberEntry[],
  passengerNumberSequence = 0,
): number {
  const currentNumbers = passengers
    .map((passenger) => passenger.passengerNumber)
    .filter(
      (number): number is number =>
        typeof number === "number" && Number.isSafeInteger(number) && number > 0,
    );
  return Math.max(passengerNumberSequence, ...currentNumbers, 0) + 1;
}
