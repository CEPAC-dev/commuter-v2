# Multi-seat boarding

A Ride passenger entry represents one Trip, even when that Trip has multiple
people. The passenger PIN and the driver-facing “Passenger N (K people)” label
remain per Trip; there is no partial boarding in this flow.

When a driver confirms arrival and the Trip's PIN is valid, the server assigns
the Trip exactly `numberOfPassengers` free seats as one all-or-nothing operation.
Seats are held while the Trip is boarding or onboard. Alighting makes the seats
available at that stop while retaining the alighted seat display until the next
stop; no-show clears seats immediately, and passenger cancellation removes the
Ride passenger entry. A later Trip can reuse seats released by those transitions.

If the Ride does not have enough free seats for the whole Trip, boarding is not
started and the API returns HTTP 409 `SEATS_UNAVAILABLE`. No-show remains
available to the driver. Concurrent station actions use a Ride version check
when committing the passenger seat assignments, so only one allocation based
on a given Ride version can be persisted.

`src/lib/config/vehicles.ts` is the single source for passenger capacity.
`getVehiclePassengerCapacity` supplies the limit used by booking validation,
matching, boarding allocation, and the seat-map layout; the grid renders exactly
that many passenger positions. `maxExtraPassengers` is derived as capacity minus
the booker. A private Trip's people count is its `numberOfPassengers`. A shared
Trip's people count is the greater of its stored `numberOfPassengers` and one
booker plus `extraPassengers`; `getTripPassengerCount` applies this definition
at booking, matching, Ride creation, audit, and cancellation. New Trips above
capacity are rejected, and over-capacity matching groups remain unmatched
rather than creating a Ride. Existing records are not rewritten automatically.

| Vehicle type | Capacity | Grid passenger seats | Max people per booking |
| --- | ---: | ---: | ---: |
| `private_car` | 4 | 4 | 4 |
| `shared_car` | 3 | 3 | 3 |
| `taxi_private` | 4 | 4 | 4 |
| `taxi_shared` | 3 | 3 | 3 |
| `van_shared` | 5 | 5 | 5 |
| `microbus_shared` | 9 | 9 | 9 |
| `mini_bus` | 14 | 14 | 14 |

The admin vehicle editor keeps the configured capacity and occupancy fixed for
these built-in vehicle types. To update existing database occupancy values for
`shared_car` and `taxi_shared`, first review the dry-run output, then run
`node scripts/updateSharedCarCapacity.mjs --apply`. The script only changes
those two keys.

For legacy Ride data whose active Trip has fewer stored seats than people, the
seat map fills missing display positions from unused seats when possible. If
there are not enough unused display positions, it shows the seats already
stored rather than failing or assigning the same fallback seat twice.

The Ride `passengersCount` field counts people, not RidePassenger entries. Ride
creation initializes it from each Trip's `numberOfPassengers`; cancelling a
Trip subtracts that Trip's full group size using a version-checked atomic update
and clamps the result at zero.

To inspect existing data without modifying it, run
`node scripts/checkVehicleCapacity.mjs` in an environment with `MONGODB_URI`
set. The script reports Rides whose combined passenger count exceeds capacity
and Trips whose own group exceeds their vehicle capacity. It was not run as part
of this change.
