import { getVehiclePassengerCapacity } from "./config/vehicles.ts";

export interface SeatGridCell {
  seatNumber: number | null;
  isDriverSeat?: boolean;
  row: number;
  col: number;
}

export function getVehicleSeatGrid(vType: string): {
  rows: SeatGridCell[][];
  totalSeats: number;
  label: string;
  labelKey: string;
} {
  const isCarOrTaxi = [
    "private_car",
    "shared_car",
    "taxi_private",
    "taxi_shared",
  ].includes(vType);
  const isVan = vType === "van_shared";
  const isMiniBus = vType === "mini_bus";
  const capacity = getVehiclePassengerCapacity(vType);
  const rearSeatsPerRow = isCarOrTaxi ? 3 : isVan ? 2 : 3;
  const rows: SeatGridCell[][] = [
    [
      { seatNumber: null, isDriverSeat: true, row: 0, col: 0 },
      { seatNumber: 1, row: 0, col: 1 },
    ],
  ];

  for (let seatNumber = 2; seatNumber <= capacity; ) {
    const rowIndex = rows.length;
    const row: SeatGridCell[] = [];
    for (
      let col = 0;
      col < rearSeatsPerRow && seatNumber <= capacity;
      col += 1, seatNumber += 1
    ) {
      row.push({ seatNumber, row: rowIndex, col });
    }
    rows.push(row);
  }

  return {
    label: isCarOrTaxi
      ? "Private Car / Taxi"
      : isVan
        ? "Van"
        : isMiniBus
          ? "Mini Bus"
          : "Microbus",
    labelKey: isCarOrTaxi
      ? "vehicle_seating.vehicle_type_private"
      : isVan
        ? "vehicle_seating.vehicle_type_van"
        : isMiniBus
          ? "vehicle_seating.vehicle_type_mini_bus"
          : "vehicle_seating.vehicle_type_microbus",
    totalSeats: capacity,
    rows,
  };
}
