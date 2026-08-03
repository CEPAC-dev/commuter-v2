import { connectDB } from "@/lib/db/mongoose";
import { Log } from "@/models/Log";
import { Trip } from "@/models/Trip";
import type { Types } from "mongoose";

export interface CreateLogInput {
  tripId: Types.ObjectId | string;
  userId: Types.ObjectId | string | null;
  driverId?: Types.ObjectId | string | null;
  status: string;
  previousStatus?: string | null;
  action: string;
  description: string;
  stationIndex?: number | null;
  stationName?: string | null;
  boardingCount?: number | null;
  alightingCount?: number | null;
  metadata?: Record<string, any>;
  actorType?: "system" | "user" | "driver" | "admin";
  actorId?: Types.ObjectId | string | null;
}

/**
 * Create a log entry for a trip
 * This is the main service method used by actions and other handlers
 */
export async function createLog(input: CreateLogInput) {
  try {
    await connectDB();

    const {
      tripId,
      userId,
      driverId = null,
      status,
      previousStatus = null,
      action,
      description,
      metadata = {},
      actorType = "system",
      actorId = null,
    } = input;

    // Verify trip exists
    const trip = await Trip.findById(tripId);
    if (!trip) {
      throw new Error(`Trip not found: ${tripId}`);
    }

    // Create log
    const log = await Log.create({
      tripId,
      userId,
      driverId,
      status,
      previousStatus,
      action,
      description,
      metadata,
      actorType,
      actorId,
    });

    return {
      success: true,
      data: log,
    };
  } catch (error) {
    console.error("[createLog]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create log",
    };
  }
}

/**
 * Get all logs for a trip
 */
export async function getTripLogs(
  tripId: string | Types.ObjectId,
  limit = 100,
  skip = 0,
) {
  try {
    await connectDB();

    const logs = await Log.find({ tripId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Log.countDocuments({ tripId });

    return {
      success: true,
      data: logs,
      total,
      limit,
      skip,
    };
  } catch (error) {
    console.error("[getTripLogs]", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch trip logs",
    };
  }
}

/**
 * Get logs by filter criteria
 */
export async function getLogs(
  filter: Record<string, any>,
  limit = 50,
  skip = 0,
) {
  try {
    await connectDB();

    const logs = await Log.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Log.countDocuments(filter);

    return {
      success: true,
      data: logs,
      total,
      limit,
      skip,
    };
  } catch (error) {
    console.error("[getLogs]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch logs",
    };
  }
}

/**
 * Get a single log by ID
 */
export async function getLogById(logId: string | Types.ObjectId) {
  try {
    await connectDB();

    const log = await Log.findById(logId).lean();

    if (!log) {
      return {
        success: false,
        error: "Log not found",
      };
    }

    return {
      success: true,
      data: log,
    };
  } catch (error) {
    console.error("[getLogById]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch log",
    };
  }
}

/**
 * Delete a log by ID
 */
export async function deleteLog(logId: string | Types.ObjectId) {
  try {
    await connectDB();

    const log = await Log.findByIdAndDelete(logId);

    if (!log) {
      return {
        success: false,
        error: "Log not found",
      };
    }

    return {
      success: true,
      message: "Log deleted successfully",
    };
  } catch (error) {
    console.error("[deleteLog]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete log",
    };
  }
}

/**
 * Get log history for a trip (sorted chronologically)
 * Returns the complete timeline of events for a trip
 */
export async function getTripLogHistory(tripId: string | Types.ObjectId) {
  try {
    await connectDB();

    const logs = await Log.find({ tripId })
      .sort({ createdAt: 1 }) // Chronological order
      .lean();

    return {
      success: true,
      data: logs,
      total: logs.length,
    };
  } catch (error) {
    console.error("[getTripLogHistory]", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch trip log history",
    };
  }
}

/**
 * Get user activity logs (all trips' logs for a user)
 */
export async function getUserActivityLogs(
  userId: string | Types.ObjectId,
  limit = 100,
  skip = 0,
) {
  try {
    await connectDB();

    const logs = await Log.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Log.countDocuments({ userId });

    return {
      success: true,
      data: logs,
      total,
      limit,
      skip,
    };
  } catch (error) {
    console.error("[getUserActivityLogs]", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch user activity logs",
    };
  }
}

/**
 * Get driver activity logs (all trips they've driven)
 */
export async function getDriverActivityLogs(
  driverId: string | Types.ObjectId,
  limit = 100,
  skip = 0,
) {
  try {
    await connectDB();

    const logs = await Log.find({ driverId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Log.countDocuments({ driverId });

    return {
      success: true,
      data: logs,
      total,
      limit,
      skip,
    };
  } catch (error) {
    console.error("[getDriverActivityLogs]", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch driver activity logs",
    };
  }
}
