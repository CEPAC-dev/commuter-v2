"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const NAV_ICONS = {
  cycles: (active: boolean) => (
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
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  availability: (active: boolean) => (
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
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M9 16l2 2 4-4" />
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

export default function DriverBottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const NAV_ITEMS = [
    {
      key: "cycles" as const,
      label: t("my_cycles"),
      href: "/driver/my-cycles",
    },
    {
      key: "availability" as const,
      label: t("availability"),
      href: "/driver/availability",
    },
    { key: "profile" as const, label: t("profile"), href: "/driver/profile" },
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

            {NAV_ICONS[item.key](active)}

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
