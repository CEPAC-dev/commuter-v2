"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { getUnreadCount } from "@/lib/api/notifications";

const NAV_ICONS = {
  create: (active: boolean) => (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#00C2A8" : "#5A6A7A"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  requests: (active: boolean) => (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#00C2A8" : "#5A6A7A"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  notifications: (active: boolean) => (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#00C2A8" : "#5A6A7A"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  profile: (active: boolean) => (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#00C2A8" : "#5A6A7A"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
} as const;

export default function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function loadUnreadCount() {
      try {
        const count = await getUnreadCount();
        if (!ignore) setUnreadCount(count);
      } catch (error) {
        console.error("Failed to fetch unread notification count:", error);
      }
    }

    loadUnreadCount();
    const interval = window.setInterval(loadUnreadCount, 15000);
    return () => {
      ignore = true;
      window.clearInterval(interval);
    };
  }, []);

  const NAV_ITEMS = [
    { key: "create" as const, label: t("create"), href: "/user/request/new" },
    {
      key: "requests" as const,
      label: t("my_requests"),
      href: "/user/my-requests",
    },
    {
      key: "notifications" as const,
      label: t("alerts"),
      href: "/user/notifications",
    },
    { key: "profile" as const, label: t("profile"), href: "/user/profile" },
  ];

  return (
    <nav
      dir="ltr"
      className="flex md:hidden"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 64,
        background: "#fff",
        borderTop: "1px solid #E2E8F0",
        alignItems: "stretch",
        paddingBottom: "env(safe-area-inset-bottom)",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const isAlerts = item.key === "notifications";

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              textDecoration: "none",
              position: "relative",
              minHeight: 44,
            }}
          >
            {active && (
              <div
                style={{
                  position: "absolute",
                  top: 6,
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#00C2A8",
                }}
              />
            )}

            <div style={{ position: "relative" }}>
              {NAV_ICONS[item.key](active)}
              {isAlerts && unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -6,
                    background: "#E74C3C",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 10,
                    padding: "1px 4px",
                    minWidth: 16,
                    textAlign: "center",
                    lineHeight: 1.4,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </div>

            <span
              style={{
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                color: active ? "#00C2A8" : "#5A6A7A",
              }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
