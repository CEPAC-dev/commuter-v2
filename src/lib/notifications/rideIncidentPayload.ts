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
