export function getRideIncidentPassengerNotificationPayload(input: {
  incidentId: string;
  tripId: string;
}) {
  return {
    type: "ride_incident",
    title: "A problem was reported on your ride",
    body: "The driver reported a problem. Our team is following up.",
    titleAr: "تم الإبلاغ عن مشكلة في رحلتك",
    bodyAr: "أبلغ السائق عن مشكلة. يتابع فريقنا الأمر.",
    data: {
      incidentId: input.incidentId,
      tripId: input.tripId,
      linkUrl: `/my-trips/${input.tripId}`,
    },
  };
}

export type RideIncidentOutcome = "continue" | "cancelled";

export function getRideIncidentOutcomeNotificationPayload(input: {
  dedupeKey: string;
  outcome: RideIncidentOutcome;
  tripId?: string;
  recipient: "driver" | "passenger";
}) {
  const cancelled = input.outcome === "cancelled";
  const driverText = cancelled
    ? {
        title: "Ride cancelled after incident review",
        body: "The team reviewed the report and cancelled the ride.",
        titleAr: "تم إلغاء الرحلة بعد مراجعة البلاغ",
        bodyAr: "راجع الفريق البلاغ وألغى الرحلة.",
      }
    : {
        title: "Ride incident reviewed",
        body: "The report was reviewed and the ride is continuing.",
        titleAr: "تمت مراجعة بلاغ الرحلة",
        bodyAr: "تمت مراجعة البلاغ وستستمر الرحلة.",
      };
  const passengerText = cancelled
    ? {
        title: "Your ride was cancelled",
        body: "Your ride was cancelled. Our team will follow up with you.",
        titleAr: "تم إلغاء رحلتك",
        bodyAr: "تم إلغاء رحلتك. سيتابع فريقنا الأمر معك.",
      }
    : {
        title: "The ride is continuing",
        body: "The ride is continuing.",
        titleAr: "ستستمر الرحلة",
        bodyAr: "ستستمر الرحلة.",
      };
  const text = input.recipient === "driver" ? driverText : passengerText;
  return {
    type: "ride_incident_resolution",
    ...text,
    data: {
      dedupeKey: input.dedupeKey,
      outcome: input.outcome,
      ...(input.tripId ? { tripId: input.tripId } : {}),
      ...(input.tripId
        ? { linkUrl: `/my-trips/${input.tripId}` }
        : { linkUrl: "/my-trips" }),
    },
  };
}
