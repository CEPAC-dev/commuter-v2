"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, ChevronRight } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationItem,
} from "@/lib/api/notifications";
import { useClientLocale } from "@/lib/i18n/client";

const POLL_INTERVAL_MS = 10_000;

function notificationHref(notification: NotificationItem): string {
  const bookingId = notification.data.bookingId;
  if (typeof bookingId === "string") return `/my-requests/${bookingId}`;

  const tripId = notification.data.tripId;
  if (typeof tripId === "string") return `/my-trips/${tripId}`;

  return "/user/notifications";
}

function formatRelativeTime(
  value: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (elapsedSeconds < 60) return t("notifications.just_now");
  if (elapsedSeconds < 3600)
    return t("notifications.minutes_ago", {
      count: Math.floor(elapsedSeconds / 60),
    });
  if (elapsedSeconds < 86400)
    return t("notifications.hours_ago", {
      count: Math.floor(elapsedSeconds / 3600),
    });
  return t("notifications.days_ago", {
    count: Math.floor(elapsedSeconds / 86400),
  });
}

export default function NotificationCenter({
  color,
  buttonBackground,
}: {
  color: string;
  buttonBackground: string;
}) {
  const router = useRouter();
  const { t, dir } = useClientLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string> | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  async function loadNotifications(announceNew: boolean) {
    try {
      const [response, nextUnreadCount] = await Promise.all([
        getNotifications(1),
        getUnreadCount(),
      ]);
      const nextNotifications = response.data;
      const knownIds = knownIdsRef.current;

      if (announceNew && knownIds) {
        const newItems = nextNotifications
          .filter((item) => !knownIds.has(item.id))
          .reverse();

        for (const item of newItems.slice(-3)) {
          toast(item.title, {
            icon: "🔔",
            duration: 5000,
            style: {
              border: "1px solid #00C2A8",
              color: "#0B1E3D",
              fontWeight: 700,
            },
          });
        }

        const latest = newItems[newItems.length - 1];
        if (
          latest &&
          document.visibilityState !== "visible" &&
          "Notification" in window &&
          window.Notification.permission === "granted"
        ) {
          const browserNotification = new window.Notification(latest.title, {
            body: latest.body,
            icon: "/assets/images/commuterLogo.png",
            tag: latest.id,
          });
          browserNotification.onclick = () => {
            window.focus();
            router.push(notificationHref(latest));
            browserNotification.close();
          };
        }
      }

      knownIdsRef.current = new Set(nextNotifications.map((item) => item.id));
      setNotifications(nextNotifications);
      setUnreadCount(nextUnreadCount);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial load and polling
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotifications(false);
    const interval = window.setInterval(
      () => loadNotifications(true),
      POLL_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function togglePopover() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen) return;

    await loadNotifications(false);
    if (
      "Notification" in window &&
      window.Notification.permission === "default"
    ) {
      await window.Notification.requestPermission();
    }
  }

  async function markRead(notification: NotificationItem) {
    if (notification.isRead) return;
    setUnreadCount((count) => Math.max(0, count - 1));
    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? { ...item, isRead: true, readAt: new Date().toISOString() }
          : item,
      ),
    );
    try {
      await markNotificationAsRead(notification.id);
    } catch {
      setUnreadCount((count) => count + 1);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, isRead: false, readAt: null }
            : item,
        ),
      );
      toast.error(t("notifications.mark_read_error"));
    }
  }

  async function openNotification(notification: NotificationItem) {
    await markRead(notification);
    setOpen(false);
    router.push(notificationHref(notification));
  }

  async function markAllRead() {
    const previous = notifications;
    const previousUnreadCount = unreadCount;
    setUnreadCount(0);
    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        isRead: true,
        readAt: item.readAt ?? new Date().toISOString(),
      })),
    );
    try {
      await markAllNotificationsAsRead();
    } catch {
      setUnreadCount(previousUnreadCount);
      setNotifications(previous);
      toast.error(t("notifications.mark_all_error"));
    }
  }

  return (
    <div ref={containerRef} className="notification-center">
      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />
      <button
        type="button"
        onClick={togglePopover}
        aria-label={t("notifications.title")}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="notification-center-button"
        style={{ color, background: open ? buttonBackground : "transparent" }}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="notification-center-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          dir="ltr"
          role="dialog"
          aria-label={t("notifications.recent")}
          className="notification-popover"
          style={{ direction: "ltr" }}
        >
          <div className="notification-popover-header">
            <div
              dir={dir}
              style={{
                direction: dir,
                textAlign: dir === "rtl" ? "right" : "left",
              }}
            >
              <strong>{t("notifications.title")}</strong>
              <span>
                {unreadCount > 0
                  ? t("notifications.unread", { count: unreadCount })
                  : t("notifications.all_caught_up")}
              </span>
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead}>
                <CheckCheck size={15} aria-hidden="true" />
                {t("notifications.mark_all_read")}
              </button>
            )}
          </div>

          <div className="notification-popover-list">
            {loading ? (
              <div className="notification-popover-empty">
                {t("notifications.loading")}
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-popover-empty">
                <Bell size={22} aria-hidden="true" />
                {t("notifications.empty_title")}
              </div>
            ) : (
              notifications.slice(0, 3).map((notification, index) => (
                <article
                  key={notification.id}
                  className={`notification-popover-item${
                    notification.isRead ? "" : " is-unread"
                  }`}
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <button
                    type="button"
                    className="notification-popover-content"
                    onClick={() => openNotification(notification)}
                  >
                    <span className="notification-popover-icon">
                      <Bell size={15} aria-hidden="true" />
                    </span>
                    <span
                      className="notification-popover-copy"
                      dir="auto"
                      style={{ direction: "ltr", textAlign: "left" }}
                    >
                      <strong>{notification.title}</strong>
                      <span>{notification.body}</span>
                      <small>
                        {formatRelativeTime(notification.createdAt, t)}
                      </small>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                  {!notification.isRead && (
                    <button
                      type="button"
                      className="notification-mark-read"
                      onClick={() => markRead(notification)}
                      title={t("notifications.mark_as_read")}
                      aria-label={t("notifications.mark_item_as_read", {
                        title: notification.title,
                      })}
                    >
                      <Check size={14} aria-hidden="true" />
                    </button>
                  )}
                </article>
              ))
            )}
          </div>

          <button
            type="button"
            className="notification-see-all"
            onClick={() => {
              setOpen(false);
              router.push("/user/notifications");
            }}
          >
            {t("notifications.see_all")}
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </section>
      )}

      <style>{`
        .notification-center { position: relative; flex-shrink: 0; }
        .notification-center-button { position: relative; width: 40px; height: 40px; border: 1px solid rgba(255,255,255,.25); border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: background .18s, transform .18s; }
        .notification-center-button:hover { transform: translateY(-1px); background: rgba(255,255,255,.12) !important; }
        .notification-center-badge { position: absolute; top: -5px; right: -5px; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 999px; background: #E74C3C; color: #fff; border: 2px solid #0B1E3D; font-size: 9px; line-height: 13px; text-align: center; font-weight: 800; }
        .notification-popover { position: absolute; top: calc(100% + 10px); right: 0; width: min(390px, calc(100vw - 24px)); background: #fff; color: #0B1E3D; border: 1px solid #E2E8F0; border-radius: 8px; box-shadow: 0 18px 45px rgba(11,30,61,.18); overflow: hidden; z-index: 200; transform-origin: top right; animation: notification-popover-in .2s ease-out both; }
        .notification-popover-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 16px; border-bottom: 1px solid #EEF1F4; }
        .notification-popover-header > div { display: flex; flex-direction: column; gap: 2px; }
        .notification-popover-header strong { font-size: 16px; }
        .notification-popover-header span { color: #5A6A7A; font-size: 12px; }
        .notification-popover-header button { border: 0; background: transparent; color: #00806E; display: inline-flex; align-items: center; gap: 5px; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; padding: 7px; }
        .notification-popover-list { min-height: 86px; }
        .notification-popover-item { position: relative; border-bottom: 1px solid #EEF1F4; opacity: 0; animation: notification-item-in .22s ease-out forwards; }
        .notification-popover-item.is-unread { background: #F1FCF9; }
        .notification-popover-content { width: 100%; border: 0; background: transparent; display: grid; grid-template-columns: 34px minmax(0,1fr) 16px; align-items: start; gap: 10px; text-align: left; padding: 13px 38px 13px 14px; color: inherit; cursor: pointer; font: inherit; }
        .notification-popover-content:hover { background: rgba(0,194,168,.07); }
        .notification-popover-icon { width: 32px; height: 32px; border-radius: 50%; background: #E7FAF5; color: #00806E; display: inline-flex; align-items: center; justify-content: center; }
        .notification-popover-copy { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .notification-popover-copy strong { font-size: 13px; line-height: 1.3; }
        .notification-popover-copy > span { color: #5A6A7A; font-size: 12px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .notification-popover-copy small { color: #8896A5; font-size: 11px; }
        .notification-popover-content > svg { color: #9AA7B4; margin-top: 8px; }
        .notification-mark-read { position: absolute; top: 10px; right: 9px; width: 27px; height: 27px; border: 0; border-radius: 50%; background: #fff; color: #00806E; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 1px 5px rgba(11,30,61,.12); }
        .notification-see-all { width: 100%; border: 0; background: #fff; color: #0B1E3D; display: flex; align-items: center; justify-content: center; gap: 7px; padding: 13px; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; }
        .notification-see-all:hover { background: #F4F8FA; color: #00806E; }
        .notification-popover-empty { min-height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #5A6A7A; font-size: 13px; }
        @keyframes notification-popover-in { from { opacity: 0; transform: translateY(-7px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes notification-item-in { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }
        @media (prefers-reduced-motion: reduce) { .notification-popover, .notification-popover-item { animation: none; opacity: 1; } }
        @media (max-width: 767px) { .notification-popover { position: fixed; top: 66px; right: 12px; } }
      `}</style>
    </div>
  );
}
