import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

export const DEFAULT_NOTIFICATION_TEMPLATES = [
  {
    name: "Welcome new user",
    title: "Welcome to Commuter",
    message:
      "Your easier daily commute starts here. Book your first ride and move through Cairo with confidence.",
    titleAr: "أهلاً بك في Commuter",
    messageAr:
      "رحلتك اليومية الأسهل تبدأ من هنا. احجز أول مشوار لك وتنقّل في القاهرة براحة وثقة.",
    icon: "check",
    style: "success",
    linkUrl: "/create",
    linkLabel: "Book your first ride",
    linkLabelAr: "احجز أول مشوار",
  },
  {
    name: "Payment reminder",
    title: "Complete your payment",
    message:
      "Your booking is waiting for payment. Complete checkout to secure your trip.",
    titleAr: "أكمل عملية الدفع",
    messageAr: "حجزك في انتظار الدفع. أكمل الدفع الآن لتضمن مشوارك.",
    icon: "bell",
    style: "warning",
    linkUrl: "/my-requests",
    linkLabel: "View requests",
    linkLabelAr: "عرض الطلبات",
  },
  {
    name: "Driver assigned",
    title: "Driver assigned",
    message:
      "A driver has been assigned to your trip. Open your trip details for more information.",
    titleAr: "تم تعيين سائق لمشوارك",
    messageAr: "تم تعيين سائق لمشوارك. افتح تفاصيل الرحلة لمعرفة المزيد.",
    icon: "check",
    style: "success",
    linkUrl: "/my-trips",
    linkLabel: "View trip",
    linkLabelAr: "عرض المشوار",
  },
  {
    name: "Service update",
    title: "Service update",
    message: "We have an important update about Commuter services.",
    titleAr: "تحديث مهم من Commuter",
    messageAr: "لدينا تحديث مهم بخصوص خدمات Commuter.",
    icon: "megaphone",
    style: "info",
    linkUrl: "",
    linkLabel: "",
    linkLabelAr: "",
  },
  {
    name: "Urgent notice",
    title: "Important notice",
    message: "Please review this important notice before your next trip.",
    titleAr: "تنبيه مهم",
    messageAr: "يرجى مراجعة هذا التنبيه المهم قبل مشوارك القادم.",
    icon: "alert",
    style: "urgent",
    linkUrl: "/user/notifications",
    linkLabel: "Read notice",
    linkLabelAr: "اقرأ التنبيه",
  },
  {
    name: "Start requesting rides",
    title: "Your next ride is just a tap away",
    message:
      "Skip the hassle and request a ride that fits your day. Start planning your next commute with Commuter.",
    titleAr: "مشوارك القادم يبدأ بضغطة",
    messageAr:
      "وفّر وقتك واطلب مشواراً يناسب يومك. ابدأ الآن وخطط لتنقّلك مع Commuter.",
    icon: "megaphone",
    style: "info",
    linkUrl: "/create",
    linkLabel: "Request a ride",
    linkLabelAr: "اطلب مشواراً",
  },
  {
    name: "Make your first ride",
    title: "Make your first ride and unlock more value",
    message:
      "Your wallet balance is ready to work for you. Take your first ride today and enjoy a smoother, smarter commute.",
    titleAr: "ابدأ أول مشوار واستفد من رصيدك",
    messageAr:
      "رصيد محفظتك جاهز لخدمتك. خُض أول مشوار لك اليوم واستمتع بتنقّل أسهل وأذكى.",
    icon: "bell",
    style: "success",
    linkUrl: "/create",
    linkLabel: "Take your first ride",
    linkLabelAr: "ابدأ أول مشوار",
  },
] as const;

const NotificationTemplateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    titleAr: { type: String, default: "", trim: true, maxlength: 120 },
    messageAr: { type: String, default: "", trim: true, maxlength: 1000 },
    icon: { type: String, required: true, default: "bell" },
    style: { type: String, required: true, default: "info" },
    linkUrl: { type: String, default: "", maxlength: 300 },
    linkLabel: { type: String, default: "", maxlength: 40 },
    linkLabelAr: { type: String, default: "", maxlength: 40 },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, collection: "notification_templates" },
);

const existingNotificationTemplateModel = models.NotificationTemplate;
if (existingNotificationTemplateModel) {
  for (const [path, definition] of [
    ["titleAr", { type: String, default: "", trim: true, maxlength: 120 }],
    ["messageAr", { type: String, default: "", trim: true, maxlength: 1000 }],
    ["linkLabelAr", { type: String, default: "", maxlength: 40 }],
  ] as const) {
    if (!existingNotificationTemplateModel.schema.path(path)) {
      existingNotificationTemplateModel.schema.add({ [path]: definition });
    }
  }
}

NotificationTemplateSchema.index({ createdBy: 1, name: 1 }, { unique: true });

export type NotificationTemplateDoc = InferSchemaType<
  typeof NotificationTemplateSchema
>;
export const NotificationTemplate =
  existingNotificationTemplateModel ||
  model("NotificationTemplate", NotificationTemplateSchema);
