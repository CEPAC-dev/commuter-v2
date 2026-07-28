# Logs System Documentation

## Overview

The Logs system tracks all events and state changes for trips. Each log entry represents a point-in-time snapshot of what happened to a trip, created through "actions" (to be implemented).

## Log Schema

```typescript
{
  tripId: ObjectId          // Reference to trip
  userId: ObjectId          // Passenger/requester ID
  driverId?: ObjectId       // Driver ID (if applicable)
  status: string            // New status after this event
  previousStatus?: string   // Previous status
  action: string            // Action that triggered this log
  description: string       // Human-readable description
  metadata?: object         // Flexible additional data
  actorType: string         // 'system' | 'user' | 'driver' | 'admin'
  actorId?: ObjectId        // Who performed the action
  timestamps: {
    createdAt: Date        // When log was created
    updatedAt: Date
  }
}
```

## Valid Actions

```typescript
"created"; // Trip was created
"payment_initiated"; // Payment session started
"payment_completed"; // Payment successful
"payment_failed"; // Payment failed
"matched"; // Trip matched with driver
"driver_accepted"; // Driver accepted trip
"driver_rejected"; // Driver rejected trip
"driver_cancelled"; // Driver cancelled
"confirmed"; // Trip confirmed by system
"trip_started"; // Trip is active (driver en route)
"trip_completed"; // Trip finished
"trip_cancelled"; // Trip cancelled
"system_timeout"; // Trip timed out
"user_cancelled"; // User cancelled
"system_cancelled"; // System cancelled
"trip_modified"; // Trip details modified
"status_changed"; // Generic status change
"custom_action"; // Custom action (flexible)
```

## API Endpoints

### 1. Create Log

**POST** `/api/logs`

Requires authentication. Creates a new log entry for a trip.

**Request Body:**

```json
{
  "tripId": "ObjectId",
  "userId": "ObjectId",
  "driverId": "ObjectId?",
  "status": "active",
  "previousStatus": "confirmed",
  "action": "trip_started",
  "description": "Trip started - driver is on the way",
  "metadata": { "location": "Giza" },
  "actorType": "driver",
  "actorId": "ObjectId?"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    /* log object */
  }
}
```

### 2. Get All Logs (with filters)

**GET** `/api/logs?tripId=...&userId=...&action=...&limit=50&skip=0`

Query Parameters:

- `tripId` - Filter by trip ID
- `userId` - Filter by user ID
- `driverId` - Filter by driver ID
- `action` - Filter by action type
- `status` - Filter by status
- `limit` - Number of results (default: 50)
- `skip` - Pagination offset (default: 0)

**Response:**

```json
{
  "success": true,
  "data": [
    /* logs array */
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "skip": 0,
    "hasMore": true
  }
}
```

### 3. Get Logs for a Trip

**GET** `/api/logs/trip/:tripId?limit=100&skip=0`

Gets all logs for a specific trip in reverse chronological order.

### 4. Get Trip Log History

**GET** `/api/logs/trip/:tripId?limit=100&skip=0`

Gets all logs for a trip. Same as above.

### 5. Get Specific Log

**GET** `/api/logs/:logId`

Retrieves a single log entry by ID.

### 6. Get User Activity Logs

**GET** `/api/logs/user/:userId?limit=100&skip=0`

Requires authentication. Gets all activity logs for a user across all their trips.

### 7. Get Driver Activity Logs

**GET** `/api/logs/driver/:driverId?limit=100&skip=0`

Requires authentication. Gets all activity logs for a driver.

### 8. Delete Log

**DELETE** `/api/logs/:logId`

Requires authentication. Deletes a specific log entry.

## Service Methods (For Server-Side Use)

Import from `@/lib/services/logService.ts`:

### createLog(input)

```typescript
import { createLog } from "@/lib/services/logService";

const result = await createLog({
  tripId,
  userId,
  status: "active",
  previousStatus: "confirmed",
  action: "trip_started",
  description: "Trip started",
});
```

### getTripLogs(tripId, limit, skip)

```typescript
const result = await getTripLogs(tripId, 100, 0);
```

### getTripLogHistory(tripId)

```typescript
// Returns logs in chronological order
const result = await getTripLogHistory(tripId);
```

### getUserActivityLogs(userId, limit, skip)

```typescript
const result = await getUserActivityLogs(userId, 100, 0);
```

### getDriverActivityLogs(driverId, limit, skip)

```typescript
const result = await getDriverActivityLogs(driverId, 100, 0);
```

### getLogs(filter, limit, skip)

```typescript
const result = await getLogs({ action: "payment_completed" }, 50, 0);
```

### getLogById(logId)

```typescript
const result = await getLogById(logId);
```

### deleteLog(logId)

```typescript
const result = await deleteLog(logId);
```

## Action Helpers (For Common Logging Patterns)

Import from `@/lib/services/logActionHelpers.ts`:

```typescript
import {
  logPaymentInitiated,
  logPaymentCompleted,
  logPaymentFailed,
  logDriverAccepted,
  logDriverRejected,
  logDriverCancelled,
  logUserCancelled,
  logTripMatched,
  logTripStarted,
  logTripCompleted,
  logTripTimeout,
  logTripCreated,
  logCustomAction,
} from "@/lib/services/logActionHelpers";

// Examples:
await logPaymentCompleted(tripId, userId, { transactionId: "..." });
await logDriverAccepted(tripId, userId, driverId, { acceptedAt: Date.now() });
await logTripStarted(tripId, userId, driverId, { location: { lat, lng } });
await logCustomAction(
  tripId,
  userId,
  "trip_modified",
  "Trip details updated",
  "submitted",
);
```

## Usage Example in an Action

```typescript
// server/actions/trips.ts
"use server";

import { logTripCreated } from "@/lib/services/logActionHelpers";

export async function submitTrip(tripData) {
  // Create trip...
  const trip = await Trip.create(tripData);

  // Log the creation
  await logTripCreated(trip._id, tripData.userId, {
    vehicleType: trip.vehicleType,
    pickupLocation: trip.pickup.address,
    dropoffLocation: trip.dropoff.address,
  });

  return trip;
}
```

## Usage Example in Payment Webhook

```typescript
// api/payments/webhook
export async function POST(request) {
  const data = await request.json();
  const isValid = validateKashierSignature(data);

  if (isValid && data.status === "successful") {
    // Update booking
    const booking = await Booking.findByIdAndUpdate(data.orderId, {
      paymentStatus: "paid",
      paidAt: new Date(),
    });

    // Log payment
    await logPaymentCompleted(booking.tripId, booking.userId, {
      kashierTransactionId: data.id,
      amount: data.amount,
    });
  }
}
```

## Log Query Examples

```typescript
// Get all payment failures
GET /api/logs?action=payment_failed

// Get user's trip history
GET /api/logs/user/:userId?limit=100

// Get driver's completed trips
GET /api/logs/driver/:driverId?action=trip_completed

// Get specific trip timeline
GET /api/logs/trip/:tripId

// Get logs in a date range (via metadata or createdAt)
GET /api/logs?tripId=123&limit=50
```

## Best Practices

1. **Always create a log when status changes** - Every significant state transition should be logged
2. **Include metadata** - Add relevant context (amounts, locations, reasons, etc.)
3. **Set correct actorType** - Identify who triggered the action
4. **Use action helpers** - Leverage pre-built functions for common patterns
5. **Immutable logs** - Logs represent historical truth; avoid updating them
6. **Timestamp order** - Logs are sorted by `createdAt` for audit trails

## Indexing for Performance

The Log schema has the following indexes:

- `{ tripId: 1, createdAt: -1 }` - Fast trip history retrieval
- `{ userId: 1, createdAt: -1 }` - Fast user activity retrieval
- `{ driverId: 1, createdAt: -1 }` - Fast driver activity retrieval
- `{ action: 1, createdAt: -1 }` - Fast action filtering
- `{ createdAt: -1 }` - Fast chronological queries
