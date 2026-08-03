import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VEHICLES,
  priceFor,
  finalPrice,
  computeTripPriceEgp,
} from '../src/lib/config/vehicles.ts';

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
