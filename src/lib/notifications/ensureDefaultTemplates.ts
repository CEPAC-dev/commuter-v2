import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  NotificationTemplate,
} from "@/models/NotificationTemplate";

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000,
  );
}

export async function ensureDefaultNotificationTemplates(userId: string) {
  for (const template of DEFAULT_NOTIFICATION_TEMPLATES) {
    try {
      await NotificationTemplate.updateOne(
        { createdBy: userId, name: template.name },
        {
          $setOnInsert: {
            name: template.name,
            title: template.title,
            message: template.message,
            icon: template.icon,
            style: template.style,
            linkUrl: template.linkUrl,
            linkLabel: template.linkLabel,
            createdBy: userId,
          },
        },
        { upsert: true },
      );
    } catch (error) {
      // Another request may create the same template between find and upsert.
      if (!isDuplicateKeyError(error)) throw error;
    }

    // Backfill only missing Arabic values; never overwrite admin edits.
    await Promise.all([
      NotificationTemplate.updateOne(
        {
          createdBy: userId,
          name: template.name,
          $or: [{ titleAr: { $exists: false } }, { titleAr: "" }],
        },
        { $set: { titleAr: template.titleAr } },
      ),
      NotificationTemplate.updateOne(
        {
          createdBy: userId,
          name: template.name,
          $or: [{ messageAr: { $exists: false } }, { messageAr: "" }],
        },
        { $set: { messageAr: template.messageAr } },
      ),
      NotificationTemplate.updateOne(
        {
          createdBy: userId,
          name: template.name,
          $or: [{ linkLabelAr: { $exists: false } }, { linkLabelAr: "" }],
        },
        { $set: { linkLabelAr: template.linkLabelAr } },
      ),
    ]);
  }
}
