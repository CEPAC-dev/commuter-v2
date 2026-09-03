"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  CalendarClock,
  Car,
  ChartNoAxesCombined,
  Gauge,
  Gift,
  ListChecks,
  Menu,
  Route,
  Settings,
  SlidersHorizontal,
  TicketPercent,
  Users,
} from "lucide-react";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";

const sections = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Gauge, statKey: null },
  { href: "/admin/users", label: "Users", icon: Users, statKey: "users" },
  { href: "/admin/trips", label: "Trips", icon: Route, statKey: "trips" },
  { href: "/admin/rides", label: "Rides", icon: Car, statKey: "rides" },
  { href: "/admin/availability", label: "Availability", icon: CalendarClock, statKey: "availability" },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: Banknote, statKey: null },
  { href: "/admin/transactions", label: "Transactions", icon: ChartNoAxesCombined, statKey: null },
  { href: "/admin/promo-codes", label: "Promo codes", icon: TicketPercent, statKey: null },
  { href: "/admin/settings", label: "Settings", icon: Settings, statKey: null },
  { href: "/admin/referral-settings", label: "Referral settings", icon: Gift, statKey: null },
  { href: "/admin/operation", label: "Operation", icon: SlidersHorizontal, statKey: null },
] as const;

type Stats = { users: number; trips: number; rides: number; availability: number };

const COLLAPSE_STORAGE_KEY = "admin-sidebar-collapsed";

function currentTitle(pathname: string) {
  if (pathname.startsWith("/admin/transactions/")) return "Transaction details";
  return sections.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`))?.label ?? "Admin";
}

export function AdminTopbarActions({ children }: { children: ReactNode }) {
  const target = typeof document === "undefined" ? null : document.getElementById("admin-page-actions");
  return target ? createPortal(children, target) : null;
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/admin/login" || pathname === "/admin/signup";
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1",
  );
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (isAuthPage) return;
    let cancelled = false;
    fetch("/api/admin/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) setStats(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthPage, pathname]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  if (isAuthPage) return <div className="admin-shell">{children}</div>;

  return (
    <div className={`admin-shell admin-shell-frame${collapsed ? " admin-shell-collapsed" : ""}`} dir="ltr">
      <aside className="admin-sidebar">
        <button
          type="button"
          className="admin-sidebar-toggle"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
        >
          <Menu size={18} aria-hidden="true" />
        </button>
        <Link href="/admin/dashboard" className="admin-sidebar-brand">
          <ListChecks size={22} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span className="admin-sidebar-brand-label">Commuter Admin</span>
        </Link>
        <nav className="admin-sidebar-nav" aria-label="Admin sections">
          {sections.map(({ href, label, icon: Icon, statKey }) => {
            const active = pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(`${href}/`));
            const count = statKey ? stats?.[statKey] : undefined;
            return (
              <Link key={href} href={href} className="admin-sidebar-link" aria-current={active ? "page" : undefined}>
                <span style={{ position: "relative", display: "inline-flex" }}>
                  <Icon size={17} aria-hidden="true" />
                  {collapsed && typeof count === "number" && count > 0 ? (
                    <span className="admin-sidebar-icon-badge">{count > 99 ? "99+" : count}</span>
                  ) : null}
                </span>
                <span className="admin-sidebar-link-label">{label}</span>
                {!collapsed && typeof count === "number" ? (
                  <span className="admin-sidebar-badge">{count}</span>
                ) : null}
                {collapsed ? (
                  <span className="admin-sidebar-tooltip">
                    {label}
                    {typeof count === "number" ? ` (${count})` : ""}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="admin-shell-content">
        <header className="admin-topbar">
          <p className="admin-topbar-title">{currentTitle(pathname)}</p>
          <div className="admin-topbar-actions">
            <div id="admin-page-actions" className="admin-topbar-actions" />
            <AdminLogoutButton />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
