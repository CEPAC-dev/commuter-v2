import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { validateMutationRequest } from "@/lib/security/request";
import {
  canShare,
  detectedTripEndAt,
  isEnded,
} from "@/lib/liveShare/eligibility";
import {
  MAX_SHARE_CREATIONS_PER_TRIP_PER_WINDOW,
  SHARE_CREATION_WINDOW_MS,
  SHARE_END_GRACE_MS,
  SHARE_LINK_LIFETIME_MS,
  revokeShareLocation,
} from "@/lib/liveShare/logic";
import { validateLiveShareConsent } from "@/lib/liveShare/consent";
import { recoverDuplicateShare } from "@/lib/liveShare/duplicateShare";
import { logLiveShareFailure } from "@/lib/liveShare/errors";
import { assertLiveShareSecret, createShareToken } from "@/lib/liveShare/token";
import { getLiveShareBaseUrl } from "@/lib/liveShare/url";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { TripShare } from "@/models/TripShare";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function shareUrl(shareId: unknown, baseUrl: string, secret: string) {
  const token = createShareToken(String(shareId), secret);
  return `${baseUrl}/live/${encodeURIComponent(token)}`;
}

async function loadOwnedTrip(tripId: string, userId: string) {
  if (!Types.ObjectId.isValid(tripId)) return null;
  return Trip.findOne({ _id: tripId, userId })
    .select("userId driverId status rideId updatedAt")
    .lean();
}

async function loadRideStatus(rideId: unknown) {
  if (!rideId) return null;
  return Ride.findById(rideId).select("status updatedAt").lean();
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (session.role !== "passenger") return jsonError("Forbidden", 403);

  const { id } = await params;
  try {
    const secret = assertLiveShareSecret();
    const baseUrl = getLiveShareBaseUrl();
    await connectDB();
    const trip = await loadOwnedTrip(id, session.userId);
    if (!trip) return jsonError("Trip not found", 404);

    const now = new Date();
    const ride = await loadRideStatus(trip.rideId);
    await TripShare.updateMany(
      { tripId: trip._id, userId: session.userId, active: true, expiresAt: { $lte: now } },
      { $set: { active: false } },
    );

    let existing = await TripShare.findOne({
      tripId: trip._id,
      userId: session.userId,
      active: true,
      revokedAt: null,
      expiresAt: { $gt: now },
    }).lean();
    if (existing) {
      if (isEnded(trip, ride) && !existing.endedAt) {
        const endedAt = detectedTripEndAt(trip, ride, now);
        await TripShare.updateOne(
          { _id: existing._id, endedAt: null },
          { $set: { endedAt }, $unset: { lastLocation: 1 } },
        );
        existing = { ...existing, endedAt, lastLocation: undefined };
      }
      if (
        existing.endedAt &&
        now.getTime() - new Date(existing.endedAt).getTime() > SHARE_END_GRACE_MS
      ) {
        await TripShare.updateOne(
          { _id: existing._id },
          { $set: { active: false } },
        );
        return jsonError("Trip sharing has ended.", 409);
      }
      return NextResponse.json({
        url: shareUrl(existing._id, baseUrl, secret),
        expiresAt: new Date(existing.expiresAt).toISOString(),
        state: isEnded(trip, ride) || existing.endedAt ? "ended" : "active",
      });
    }

    if (!canShare(trip, session.userId, ride)) {
      return jsonError("This trip is not eligible for live sharing.", 409);
    }

    let consentBody: unknown;
    try {
      consentBody = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Consent is required to create a live-share link.",
          errorCode: "LIVE_SHARE_CONSENT_REQUIRED",
        },
        { status: 400 },
      );
    }
    const consent = validateLiveShareConsent(consentBody, now);
    if (!consent.valid) {
      return NextResponse.json(
        {
          error:
            consent.errorCode === "LIVE_SHARE_CONSENT_REQUIRED"
              ? "Consent is required to create a live-share link."
              : "The live-share consent version is no longer current.",
          errorCode: consent.errorCode,
        },
        { status: 400 },
      );
    }

    const windowStart = new Date(now.getTime() - SHARE_CREATION_WINDOW_MS);
    const recentCreations = await TripShare.countDocuments({
      tripId: trip._id,
      userId: session.userId,
      createdAt: { $gte: windowStart },
    });
    if (recentCreations >= MAX_SHARE_CREATIONS_PER_TRIP_PER_WINDOW) {
      return jsonError("Too many live-share links created for this trip.", 429);
    }

    const expiresAt = new Date(now.getTime() + SHARE_LINK_LIFETIME_MS);
    let created;
    try {
      created = await TripShare.create({
        tripId: trip._id,
        rideId: trip.rideId ?? null,
        userId: session.userId,
        active: true,
        consentAt: consent.consentAt,
        consentVersion: consent.consentVersion,
        expiresAt,
        deleteAt: new Date(expiresAt.getTime() + SHARE_LINK_LIFETIME_MS),
      });
    } catch (error) {
      const recovery = await recoverDuplicateShare(error, async () =>
        TripShare.findOne({
          tripId: trip._id,
          userId: session.userId,
          active: true,
          revokedAt: null,
          expiresAt: { $gt: now },
        }).lean(),
      );
      if (recovery.kind === "conflict") {
        return jsonError("A live-share link could not be created.", 409);
      }
      const concurrent = recovery.share;
      return NextResponse.json({
        url: shareUrl(concurrent._id, baseUrl, secret),
        expiresAt: new Date(concurrent.expiresAt).toISOString(),
        state: "active",
      });
    }
    return NextResponse.json(
      {
        url: shareUrl(created._id, baseUrl, secret),
        expiresAt: expiresAt.toISOString(),
        state: "active",
      },
      { status: 201 },
    );
  } catch (error) {
    logLiveShareFailure("[POST /api/trips/[id]/share]", error);
    return jsonError("Unable to create live sharing.", 500);
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (session.role !== "passenger") return jsonError("Forbidden", 403);

  const { id } = await params;
  try {
    const secret = assertLiveShareSecret();
    const baseUrl = getLiveShareBaseUrl();
    await connectDB();
    const trip = await loadOwnedTrip(id, session.userId);
    if (!trip) return jsonError("Trip not found", 404);

    const now = new Date();
    const ride = await loadRideStatus(trip.rideId);
    const share = await TripShare.findOne({
      tripId: trip._id,
      userId: session.userId,
    })
      .sort({ createdAt: -1 })
      .lean();
    if (!share) {
      return NextResponse.json({
        state: "none",
        active: false,
        url: null,
        expiresAt: null,
        viewCount: 0,
        lastViewedAt: null,
        lastLocationAt: null,
      });
    }

    const expiresAt = new Date(share.expiresAt);
    const active = share.active && !share.revokedAt;
    const usable = active && expiresAt.getTime() > now.getTime();
    const ended = Boolean(share.endedAt) || isEnded(trip, ride);
    if (ended && !share.endedAt && usable) {
      await TripShare.updateOne(
        { _id: share._id, endedAt: null },
        { $set: { endedAt: now }, $unset: { lastLocation: 1 } },
      );
    }
    if (active && expiresAt.getTime() <= now.getTime()) {
      await TripShare.updateOne({ _id: share._id }, { $set: { active: false } });
    }

    const state = !usable
      ? share.revokedAt
        ? "revoked"
        : "expired"
      : ended
        ? "ended"
        : "active";
    return NextResponse.json({
      state,
      active: usable && !ended,
      url: usable
        ? shareUrl(share._id, baseUrl, secret)
        : null,
      expiresAt: expiresAt.toISOString(),
      viewCount: share.viewCount ?? 0,
      lastViewedAt: share.lastViewedAt
        ? new Date(share.lastViewedAt).toISOString()
        : null,
      lastLocationAt: !ended && share.lastLocation?.receivedAt
        ? new Date(share.lastLocation.receivedAt).toISOString()
        : null,
    });
  } catch (error) {
    logLiveShareFailure("[GET /api/trips/[id]/share]", error);
    return jsonError("Unable to read live sharing.", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const invalidRequest = validateMutationRequest(request, { requireJson: false });
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (session.role !== "passenger") return jsonError("Forbidden", 403);

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return jsonError("Trip not found", 404);

  try {
    await connectDB();
    const trip = await Trip.findOne({ _id: id, userId: session.userId })
      .select("_id")
      .lean();
    if (!trip) return jsonError("Trip not found", 404);

    const revokedAt = new Date();
    const share = await TripShare.findOne({
      tripId: trip._id,
      userId: session.userId,
      active: true,
    })
      .select("_id")
      .lean();
    if (!share) return NextResponse.json({ ok: true, revoked: false });
    const revoked = await revokeShareLocation(
      String(share._id),
      revokedAt,
      {
        async revokeAndClear(shareId, revokedAt) {
          const result = await TripShare.updateOne(
            {
              _id: shareId,
              tripId: trip._id,
              userId: session.userId,
              active: true,
            },
            {
              $set: { active: false, revokedAt },
              $unset: { lastLocation: 1 },
            },
          );
          return result.modifiedCount === 1;
        },
      },
    );
    return NextResponse.json({ ok: true, revoked });
  } catch (error) {
    logLiveShareFailure("[DELETE /api/trips/[id]/share]", error);
    return jsonError("Unable to stop live sharing.", 500);
  }
}
