import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VEHICLES,
  priceFor,
  finalPrice,
  computeTripPriceEgp,
  computePrivateTripPriceEgp,
  priceForSelectedDates,
  privateRoutePrice,
  waitingCostEgp,
} from '../src/lib/config/vehicles.ts';
import { bookingWindow } from '../src/lib/time/bookingDates.ts';

test('shared rides derive the final price from the distance-based base price', () => {
  const basePrice = priceFor(10, 'taxi_shared', VEHICLES);
  const expected = finalPrice(basePrice, 1, 'taxi_shared', VEHICLES);
  const actual = computeTripPriceEgp({
    distanceKm: 10,
    vehicleType: 'taxi_shared',
    extraPassengers: 1,
    vehiclesMap: VEHICLES,
  });

  assert.equal(actual, expected);
});

test('full-week selection discounts only the seventh day', () => {
  const dates = bookingWindow();

  assert.equal(priceForSelectedDates(100, dates), 695);
});

test('private route fare includes per-leg passenger price, waiting, and minimum charge', () => {
  const legs = [{ distanceKm: 10, passengers: 2 }];
  const expected = Math.max(
    VEHICLES.private_car.minimum_charge,
    privateRoutePrice(legs, 'private_car', VEHICLES) +
      waitingCostEgp(60, 'private_car', VEHICLES),
  );

  assert.equal(
    computePrivateTripPriceEgp(legs, 60, 'private_car', VEHICLES),
    expected,
  );
});
