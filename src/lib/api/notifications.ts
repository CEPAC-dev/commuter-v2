export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  success: boolean;
  data: NotificationItem[];
  meta: {
    currentPage: number;
    lastPage: number;
    total: number;
  };
}

export async function getUnreadCount(): Promise<number> {
  const res = await fetch(`/api/notifications/unread`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch unread counts");
  const json = await res.json();
  return json.count ?? 0;
}

export async function getNotifications(
  page = 1,
): Promise<NotificationListResponse> {
  const res = await fetch(`/api/notifications?page=${page}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const res = await fetch(`/api/notifications/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to mark notification as read");
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const res = await fetch(`/api/notifications/read-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to mark all notifications as read");
}
