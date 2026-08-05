import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell, CheckCheck, ArrowRight } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/models/Notification";
import AppHeader from "@/components/layout/AppHeader";
import EmptyState from "@/components/shared/EmptyState";
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/api/notifications";

export const metadata = { title: "Notifications — Commuter" };
export const dynamic = "force-dynamic";

function formatTime(value: string) {
  return new Date(value).toLocaleString("en-EG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/user/notifications");
  if (session.role === "admin") redirect("/admin/dashboard");

  await connectDB();
  const notifications = await Notification.find({ userId: session.userId })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader authed email={session.email} variant="app" backHref="/" />
      <main
        style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px 56px" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                color: "#0B1E3D",
              }}
            >
              Notifications
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#5A6A7A" }}>
              Stay up to date with payment, trip, and driver updates.
            </p>
          </div>
          {notifications.length > 0 ? (
            <form
              action={async () => {
                "use server";
                const session = await getSession();
                if (!session) return;
                await connectDB();
                await Notification.updateMany(
                  { userId: session.userId, isRead: false },
                  { isRead: true, readAt: new Date() },
                );
              }}
            >
              <button
                type="submit"
                style={{
                  border: "1px solid #E2E8F0",
                  background: "#fff",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontWeight: 700,
                  color: "#0B1E3D",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <CheckCheck size={16} /> Mark all read
                </span>
              </button>
            </form>
          ) : null}
        </div>

        {notifications.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="No notifications yet"
            description="Payment confirmations, trip updates, and driver messages will appear here."
            action={
              <Link
                href="/my-requests"
                style={{
                  display: "inline-block",
                  padding: "12px 24px",
                  background: "#0B1E3D",
                  color: "#fff",
                  borderRadius: 10,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                View requests
              </Link>
            }
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notifications.map((item) => (
              <div
                key={String(item._id)}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: item.isRead
                    ? "1px solid #eef0f3"
                    : "1px solid #00C2A8",
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        background: item.isRead ? "#F3F6F8" : "#E7FAF5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Bell
                        size={16}
                        color={item.isRead ? "#5A6A7A" : "#00C2A8"}
                      />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: "#0B1E3D",
                        }}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{ fontSize: 13, color: "#5A6A7A", marginTop: 4 }}
                      >
                        {item.body}
                      </div>
                      <div
                        style={{ fontSize: 12, color: "#9aa7b4", marginTop: 8 }}
                      >
                        {formatTime(item.createdAt)}
                      </div>
                    </div>
                  </div>
                  {!item.isRead ? (
                    <span
                      style={{
                        background: "#FFF8E1",
                        color: "#E65100",
                        borderRadius: 999,
                        padding: "4px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      New
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
