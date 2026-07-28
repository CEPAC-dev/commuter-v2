/** Fraction of trip price credited to the driver (platform keeps the rest). */
export const DRIVER_EARNINGS_RATE = Number(
  process.env.DRIVER_EARNINGS_RATE ?? "0.85",
);

export const MIN_WITHDRAWAL_EGP = 50;
export const MAX_WITHDRAWAL_EGP = 10_000;

export function driverEarningFromTrip(priceEgp: number): number {
  return Math.round(priceEgp * DRIVER_EARNINGS_RATE);
}
