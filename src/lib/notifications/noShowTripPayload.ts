export function getNoShowTripNotificationPayload(tripId: string) {
  return {
    type: "no_show_trip",
    title: "Marked as not present",
    body: "You were marked as not present at pickup. If this is a mistake, you can request a review.",
    titleAr: "تم تسجيل عدم الحضور",
    bodyAr:
      "تم تسجيل عدم حضورك عند نقطة الركوب. إذا كان ذلك بالخطأ، يمكنك طلب المراجعة.",
    data: {
      tripId,
      linkUrl: `/my-trips/${tripId}`,
    },
  };
}
