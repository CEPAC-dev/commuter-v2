# Action Center Documentation

## Overview

The Action Center manages the real-time flow of driver actions during a ride. It orchestrates the progression through stations/stops, manages boarding/alighting, and creates detailed logs for every action.

## Architecture

### Components

1. **Log Model** - Extended to track ride-specific data:
   - `rideId` - Reference to the ride
   - `stationIndex` - Which station in the route
   - `boardingCount` / `alightingCount` - Passenger counts
   - `actionTimestamp` - Explicit action timestamp

2. **Ride Action Helpers** (`logActionHelpers.ts`) - Pre-built logging functions for:
   - Shared ride flows (station arrivals, boarding/alighting)
   - Private ride flows (pickups, no-shows, stops)

3. **Action Center Endpoint** (`/api/actions/ride/:rideId`) - Determines next action and processes driver inputs

## Flow for Shared Rides

```
Ride Matched
    ↓
[GET] Next Action → {type: "start_ride"}
    ↓
[POST] action="start_ride" → Ride starts, timer begins
    ↓
[GET] Next Action → {type: "station_arrived", stationIndex: 0, stationName: "..."}
    ↓
[POST] action="station_arrived" → Logs arrival
    ↓
[GET] Next Action → {type: "boarding_alighting", stationIndex: 0}
    ↓
[POST] action="boarding_alighting", boardingCount=5, alightingCount=0 → Logs counts
    ↓
[GET] Next Action → {type: "station_arrived", stationIndex: 1, stationName: "..."} (next station)
    ↓
... (repeat for each station)
    ↓
[GET] Next Action → {type: "end_ride"} (at last station)
    ↓
[POST] action="end_ride" → Ride completed, timer stops
```

## Flow for Private Rides (Simple)

```
Ride Matched
    ↓
[GET] Next Action → {type: "start_ride"}
    ↓
[POST] action="start_ride" → Ride starts
    ↓
[GET] Next Action → {type: "pickup_arrived", pickupAddress: "..."}
    ↓
[POST] action="pickup_arrived" → Logs pickup arrival
    ↓
[GET] Next Action → Options: ["Passenger picked up", "No show"]
    ↓
IF "Passenger picked up":
  [POST] action="passenger_picked_up", boardingCount=1
    ↓
  [GET] Next Action → {type: "end_ride"}
    ↓
  [POST] action="end_ride"

IF "No show":
  [POST] action="no_show" → Trip cancelled
    ↓
  [GET] Next Action → (next passenger if exists, else end_ride)
```

## Flow for Private Rides (With Stops)

```
Ride Matched
    ↓
[GET] Next Action → {type: "start_ride"}
    ↓
[POST] action="start_ride"
    ↓
[GET] Next Action → {type: "pickup_arrived"}
    ↓
[POST] action="pickup_arrived"
    ↓
[POST] action="passenger_picked_up"
    ↓
[GET] Next Action → {type: "stop_point_arrived", stationIndex: 0} (first stop)
    ↓
[POST] action="stop_point_arrived"
    ↓
[GET] Next Action → {type: "boarding_alighting", stationIndex: 0}
    ↓
[POST] action="boarding_alighting", boardingCount=X, alightingCount=Y
    ↓
... (repeat for each stop)
    ↓
[GET] Next Action → {type: "end_ride"}
    ↓
[POST] action="end_ride"
```

## API Endpoints

### Get Next Action

**GET** `/api/actions/ride/:rideId/next`

Determines what the driver should do next based on ride state.

**Auth Required:** Yes (driver must own the ride)

**Response (Shared Ride - Start):**

```json
{
  "success": true,
  "rideId": "...",
  "currentStatus": "matched",
  "rideType": "shared",
  "nextAction": {
    "type": "start_ride",
    "label": "Start Ride",
    "description": "Press to begin the ride",
    "timestamp": "2026-07-26T10:30:00Z"
  }
}
```

**Response (Shared Ride - Station):**

```json
{
  "success": true,
  "rideId": "...",
  "currentStatus": "active",
  "rideType": "shared",
  "nextAction": {
    "type": "station_arrived",
    "stationIndex": 1,
    "stationName": "Helwan Station",
    "requiresBoardingAlighting": true,
    "allowBoarding": true,
    "allowAlighting": true,
    "nextStationIndex": 1,
    "timestamp": "2026-07-26T10:35:00Z"
  }
}
```

**Response (Private Ride - Pickup):**

```json
{
  "success": true,
  "rideId": "...",
  "currentStatus": "active",
  "rideType": "private",
  "nextAction": {
    "type": "pickup_arrived",
    "pickupAddress": "123 Main St, Cairo",
    "passengerIndex": 0,
    "requiresPickupConfirmation": true,
    "options": ["Passenger picked up", "No show"],
    "timestamp": "2026-07-26T10:40:00Z"
  }
}
```

### Process Action

**POST** `/api/actions/ride/:rideId`

Processes a driver action and creates log entries.

**Auth Required:** Yes (driver must own the ride)

**Request Body (Start Ride):**

```json
{
  "action": "start_ride",
  "metadata": {
    "startLocation": { "lat": 30.123, "lng": 31.456 }
  }
}
```

**Request Body (Station Arrival):**

```json
{
  "action": "station_arrived",
  "stationIndex": 1,
  "stationName": "Helwan Station",
  "metadata": { "actualArrivalTime": "2026-07-26T10:35:00Z" }
}
```

**Request Body (Boarding/Alighting):**

```json
{
  "action": "boarding_alighting",
  "tripId": "...",
  "stationIndex": 1,
  "stationName": "Helwan Station",
  "boardingCount": 3,
  "alightingCount": 1,
  "metadata": { "notes": "One customer delayed" }
}
```

**Request Body (Pickup Arrival - Private):**

```json
{
  "action": "pickup_arrived",
  "tripId": "...",
  "stationName": "123 Main St, Cairo",
  "metadata": { "coordinates": { "lat": 30.123, "lng": 31.456 } }
}
```

**Request Body (Passenger Picked Up - Private):**

```json
{
  "action": "passenger_picked_up",
  "tripId": "...",
  "boardingCount": 2,
  "metadata": { "confirmation": "Passenger confirmed" }
}
```

**Request Body (No Show - Private):**

```json
{
  "action": "no_show",
  "tripId": "...",
  "metadata": { "reason": "Passenger not at pickup location" }
}
```

**Request Body (Stop Point Arrival - Private):**

```json
{
  "action": "stop_point_arrived",
  "tripId": "...",
  "stationIndex": 0,
  "stationName": "City Center Stop",
  "metadata": { "coordinates": { "lat": 30.123, "lng": 31.456 } }
}
```

**Request Body (End Ride):**

```json
{
  "action": "end_ride",
  "metadata": { "endLocation": { "lat": 30.123, "lng": 31.456 } }
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Action processed",
  "action": "station_arrived",
  "nextAction": "boarding_alighting"
}
```

**Response (Error):**

```json
{
  "success": false,
  "error": "Missing tripId"
}
```

## Log Schema Extensions for Actions

When actions are logged, the Log document includes:

```typescript
{
  tripId: ObjectId,           // Associated trip
  rideId: ObjectId,           // Associated ride (new)
  userId: ObjectId,           // Passenger
  driverId: ObjectId,         // Driver
  status: string,             // Trip status after action
  action: string,             // Action type
  description: string,        // Human-readable description
  stationIndex?: number,      // Which station (new)
  stationName?: string,       // Station name (new)
  boardingCount?: number,     // Passengers boarding (new)
  alightingCount?: number,    // Passengers alighting (new)
  actionTimestamp: Date,      // When action occurred (new, required)
  metadata: object,           // Flexible additional data
  actorType: string,          // "driver"
  actorId: ObjectId,          // Driver ID
  createdAt: Date,            // Log creation time
  updatedAt: Date
}
```

## New Action Types

Added to Log schema `action` enum:

- `ride_started` - Ride has started
- `station_arrived` - Arrived at a station (shared)
- `boarding_alighting` - Logged boarding/alighting counts
- `pickup_arrived` - Arrived at pickup location (private)
- `passenger_picked_up` - Passenger confirmed pickup (private)
- `no_show` - Passenger no-show (private)
- `stop_point_arrived` - Arrived at a stop point (private)
- `ride_completed` - Ride finished

## Frontend Integration Examples

### React Component Pattern

```typescript
const ActionCenter = ({ rideId, onActionComplete }: Props) => {
  const [nextAction, setNextAction] = useState(null);
  const [loading, setLoading] = useState(false);

  // Get next action on mount
  useEffect(() => {
    fetchNextAction();
  }, []);

  const fetchNextAction = async () => {
    const res = await fetch(`/api/actions/ride/${rideId}/next`);
    const data = await res.json();
    setNextAction(data.nextAction);
  };

  const submitAction = async (action: string, payload: any) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/actions/ride/${rideId}`, {
        method: "POST",
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await res.json();

      if (result.success) {
        // Fetch next action
        await fetchNextAction();
        onActionComplete?.(result);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!nextAction) return <div>Loading...</div>;

  return (
    <div>
      {nextAction.type === "start_ride" && (
        <button onClick={() => submitAction("start_ride", {})}>
          {nextAction.label}
        </button>
      )}

      {nextAction.type === "station_arrived" && (
        <div>
          <h3>{nextAction.stationName}</h3>
          <button onClick={() => submitAction("station_arrived", nextAction)}>
            Station Arrived
          </button>
        </div>
      )}

      {nextAction.type === "boarding_alighting" && (
        <BoardingForm
          stationName={nextAction.stationName}
          onSubmit={(boardingCount, alightingCount) =>
            submitAction("boarding_alighting", {
              boardingCount,
              alightingCount,
              stationIndex: nextAction.stationIndex,
              stationName: nextAction.stationName,
            })
          }
        />
      )}

      {nextAction.type === "end_ride" && (
        <button onClick={() => submitAction("end_ride", {})}>
          {nextAction.label}
        </button>
      )}
    </div>
  );
};
```

## Database Indexes

The Log model has these indexes for performance:

- `{ rideId: 1, createdAt: -1 }` - Fast ride action history
- `{ tripId: 1, createdAt: -1 }` - Fast trip action history
- `{ driverId: 1, createdAt: -1 }` - Fast driver activity
- `{ action: 1, createdAt: -1 }` - Fast action filtering

## Error Handling

Common errors from the action endpoint:

| Error                            | Status | Cause                                    |
| -------------------------------- | ------ | ---------------------------------------- |
| Unauthorized                     | 401    | No session or user not authenticated     |
| Forbidden                        | 403    | Driver does not own this ride            |
| Ride not found                   | 404    | Invalid rideId                           |
| Missing tripId                   | 400    | Action requires tripId but none provided |
| Missing stationIndex/stationName | 400    | Station action missing required fields   |
| Failed to process action         | 500    | Database or internal error               |

## Testing the Flow

### Test Shared Ride Flow

```bash
# 1. Get next action
curl -X GET "http://localhost:3000/api/actions/ride/[rideId]/next" \
  -H "Authorization: Bearer [token]"

# 2. Start ride
curl -X POST "http://localhost:3000/api/actions/ride/[rideId]" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{"action":"start_ride"}'

# 3. Arrive at station
curl -X POST "http://localhost:3000/api/actions/ride/[rideId]" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{
    "action":"station_arrived",
    "stationIndex":0,
    "stationName":"Cairo Station"
  }'

# 4. Log boarding/alighting
curl -X POST "http://localhost:3000/api/actions/ride/[rideId]" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{
    "action":"boarding_alighting",
    "tripId":"[tripId]",
    "stationIndex":0,
    "stationName":"Cairo Station",
    "boardingCount":5,
    "alightingCount":0
  }'
```

## Audit Trail

All actions are fully logged and can be queried:

```bash
# Get all actions for a ride
curl -X GET "http://localhost:3000/api/logs/ride/[rideId]"

# Get all actions for a driver
curl -X GET "http://localhost:3000/api/logs/driver/[driverId]"

# Get specific action
curl -X GET "http://localhost:3000/api/logs/[logId]"
```

## Notes

- Every action creates an immutable log entry
- Timestamps are set to the exact moment the action is logged
- The `actionTimestamp` field captures when the driver pressed the button
- Metadata is flexible and can store any additional context
- All timestamps are ISO 8601 format in UTC
