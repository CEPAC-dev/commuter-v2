import "server-only";
import { Types, type ClientSession } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Station } from "@/models/Station";
import { StationDataset } from "@/models/StationDataset";
import { StationAuditLog } from "@/models/StationAuditLog";
import { StationOverride } from "@/models/StationOverride";
import { StationRegionState } from "@/models/StationRegionState";
import type { RegionCode } from "@/lib/config/regions";

type SourceStation = { objectId: number; name: string; direction: string; zones: string; description: string; landmark: string; stationType: string; lat: number; lng: number };

export class StationPublishError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

async function acquireLock(regionCode: RegionCode, datasetId: string) {
  const state = await StationRegionState.findOneAndUpdate(
    { regionCode, publishingDatasetVersionId: null },
    { $setOnInsert: { regionCode }, $set: { publishingDatasetVersionId: datasetId, lockAcquiredAt: new Date() } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  if (!state || String(state.publishingDatasetVersionId) !== datasetId) {
    throw new StationPublishError("A station publication is already in progress for this region.");
  }
}

export async function publishStationDataset({ datasetId, regionCode, actorId, rollback = false }: { datasetId: string; regionCode: RegionCode; actorId: string; rollback?: boolean }) {
  await connectDB();
  await acquireLock(regionCode, datasetId);
  const mongoose = await import("mongoose");
  const session = await mongoose.startSession();
  try {
    let result: Record<string, number> = {};
    const applyProjection = async (dbSession?: ClientSession) => {
      const dataset = await StationDataset.findOne({ _id: datasetId, regionCode })
        .select("+normalizedStations")
        .session(dbSession ?? null);
      const allowed = rollback ? ["ARCHIVED", "PUBLISHED"] : ["VALID"];
      if (!dataset || !allowed.includes(dataset.status) || dataset.normalizedStations.length !== dataset.validCount) {
        throw new StationPublishError("Dataset is not eligible for publication.");
      }
      const source = dataset.normalizedStations as unknown as SourceStation[];
      const objectIds = source.map((row) => row.objectId);
      const overrides = await StationOverride.find({ regionCode, objectId: { $in: objectIds } }).session(dbSession ?? null).lean();
      const overrideById = new Map(overrides.map((row) => [row.objectId, row]));
      const updates = source.map((row) => {
        const override = overrideById.get(row.objectId);
        const fields = (override?.fields ?? {}) as Record<string, unknown>;
        return {
          updateOne: {
            filter: { regionCode, objectId: row.objectId },
            update: { $set: { ...row, ...fields, regionCode, sourceObjectId: row.objectId, sourceKind: "dataset", datasetVersionId: dataset._id, active: fields.active ?? true } },
            upsert: true,
          },
        };
      });
      if (updates.length) await Station.bulkWrite(updates, { ...(dbSession ? { session: dbSession } : {}), ordered: true });
      const removed = await Station.find({ regionCode, sourceKind: "dataset", objectId: { $nin: objectIds }, active: true }).session(dbSession ?? null).select("_id objectId").lean();
      if (removed.length) {
        await Station.updateMany({ _id: { $in: removed.map((row) => row._id) } }, { $set: { active: false } }, dbSession ? { session: dbSession } : undefined);
        await StationOverride.updateMany({ regionCode, objectId: { $in: removed.map((row) => row.objectId) } }, { $set: { sourceRemoved: true } }, dbSession ? { session: dbSession } : undefined);
      }
      const state = await StationRegionState.findOne({ regionCode }).session(dbSession ?? null);
      const previousId = state?.activeDatasetVersionId;
      if (previousId && String(previousId) !== String(dataset._id)) {
        await StationDataset.updateOne({ _id: previousId, regionCode }, { $set: { status: "ARCHIVED" } }, dbSession ? { session: dbSession } : undefined);
      }
      await StationDataset.updateOne({ _id: dataset._id, regionCode }, { $set: { status: "PUBLISHED", publishedAt: new Date(), publishedBy: new Types.ObjectId(actorId) } }, dbSession ? { session: dbSession } : undefined);
      await StationRegionState.updateOne({ regionCode }, { $set: { activeDatasetVersionId: dataset._id } }, dbSession ? { session: dbSession } : undefined);
      await StationAuditLog.create([{ action: rollback ? "rollback" : "publish", regionCode, datasetVersionId: dataset._id, actorId, metadata: { previousDatasetVersionId: previousId, upserted: source.length, deactivated: removed.length, overridden: overrides.length } }], dbSession ? { session: dbSession } : undefined);
      result = { upserted: source.length, deactivated: removed.length, overridden: overrides.length };
    };
    try {
      await session.withTransaction(() => applyProjection(session));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const standaloneMongo = /Transaction numbers are only allowed|does not support transactions|replica set|transaction is not supported|standalone/i.test(message);
      if (!standaloneMongo) throw error;
      // A standalone VPS MongoDB server cannot start transactions. The same
      // per-region lock and ordered writes keep the operation controlled.
      await applyProjection(undefined);
      result.nonTransactional = 1;
    }
    return result;
  } catch (error) {
    await StationAuditLog.create({ action: "failed", regionCode, datasetVersionId: Types.ObjectId.isValid(datasetId) ? datasetId : null, actorId, metadata: { operation: rollback ? "rollback" : "publish", message: error instanceof Error ? error.message : "Publication failed" } }).catch(() => undefined);
    if (error instanceof StationPublishError) throw error;
    throw new StationPublishError(error instanceof Error ? `Publication failed: ${error.message}` : "Publication failed.", 500);
  } finally {
    await session.endSession();
    await StationRegionState.updateOne({ regionCode, publishingDatasetVersionId: datasetId }, { $set: { publishingDatasetVersionId: null, lockAcquiredAt: null } }).catch(() => undefined);
  }
}
