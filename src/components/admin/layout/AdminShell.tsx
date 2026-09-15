"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  CalendarClock,
  Car,
  ChartNoAxesCombined,
  CarFront,
  Gauge,
  Gift,
  ListChecks,
  MapPinned,
  Menu,
  Route,
  Settings,
  SlidersHorizontal,
  TicketPercent,
  Users,
} from "lucide-react";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import type { RegionSlug } from "@/lib/config/regions";

interface AdminRegionOption {
  code: string;
  slug: RegionSlug;
  label: string;
}

interface AdminShellProps {
  children: ReactNode;
  activeRegionSlug?: RegionSlug;
  allowedRegions?: AdminRegionOption[];
}

const sections = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Gauge, statKey: null },
  { href: "/admin/users", label: "Users", icon: Users, statKey: "users" },
  { href: "/admin/trips", label: "Trips", icon: Route, statKey: "trips" },
  { href: "/admin/stations", label: "Stations", icon: MapPinned, statKey: null },
  { href: "/admin/rides", label: "Rides", icon: Car, statKey: "rides" },
  { href: "/admin/vehicles", label: "Vehicles", icon: CarFront, statKey: null },
  {
    href: "/admin/availability",
    label: "Availability",
    icon: CalendarClock,
    statKey: "availability",
  },
  {
    href: "/admin/withdrawals",
    label: "Withdrawals",
    icon: Banknote,
    statKey: null,
  },
  {
    href: "/admin/transactions",
    label: "Transactions",
    icon: ChartNoAxesCombined,
    statKey: null,
  },
  {
    href: "/admin/promo-codes",
    label: "Promo codes",
    icon: TicketPercent,
    statKey: null,
  },
  { href: "/admin/settings", label: "Settings", icon: Settings, statKey: null },
  {
    href: "/admin/referral-settings",
    label: "Referral settings",
    icon: Gift,
    statKey: null,
  },
  {
    href: "/admin/operation",
    label: "Operation",
    icon: SlidersHorizontal,
    statKey: null,
  },
] as const;

type Stats = {
  users: number;
  trips: number;
  rides: number;
  availability: number;
};

const COLLAPSE_STORAGE_KEY = "admin-sidebar-collapsed";

function currentTitle(pathname: string) {
  const normalizedPath = pathname.replace(/^\/(eg|sa|ae)(?=\/admin)/, "");
  if (normalizedPath.startsWith("/admin/transactions/")) return "Transaction details";
  return (
    sections.find(
      ({ href }) => normalizedPath === href || normalizedPath.startsWith(`${href}/`),
    )?.label ?? "Admin"
  );
}

export function AdminTopbarActions({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  const target = document.getElementById("admin-page-actions");
  return target ? createPortal(children, target) : null;
}

export default function AdminShell({
  children,
  activeRegionSlug,
  allowedRegions = [],
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage =
    pathname === "/admin/login" || pathname === "/admin/signup";
  const [collapsed, setCollapsed] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  // read persisted preference after mount to avoid SSR/client markup mismatch
  useEffect(() => {
    if (window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1")
      setCollapsed(true);
  }, []);

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

  function changeRegion(regionSlug: string) {
    const regionalPath = pathname.match(/^\/(eg|sa|ae)\/admin\/(.+)$/);
    if (regionalPath) {
      router.push(`/${regionSlug}/admin/${regionalPath[2]}`);
      return;
    }
    if (pathname === "/admin/operation" || pathname === "/admin/stations") {
      router.push(`/${regionSlug}${pathname}`);
      return;
    }
    router.refresh();
  }

  function sidebarHref(href: string) {
    if (
      activeRegionSlug &&
      (href === "/admin/operation" || href === "/admin/stations")
    ) {
      return `/${activeRegionSlug}${href}`;
    }
    return href;
  }

  if (isAuthPage) return <div className="admin-shell">{children}</div>;

  return (
    <div
      className={`admin-shell admin-shell-frame${collapsed ? " admin-shell-collapsed" : ""}`}
      dir="ltr"
    >
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
            const destination = sidebarHref(href);
            const normalizedPath = pathname.replace(/^\/(eg|sa|ae)(?=\/admin)/, "");
            const active =
              normalizedPath === href ||
              (href !== "/admin/dashboard" && normalizedPath.startsWith(`${href}/`));
            const count = statKey ? stats?.[statKey] : undefined;
            return (
              <Link
                key={href}
                href={destination}
                className="admin-sidebar-link"
                aria-current={active ? "page" : undefined}
              >
                <span style={{ position: "relative", display: "inline-flex" }}>
                  <Icon size={17} aria-hidden="true" />
                  {collapsed && typeof count === "number" && count > 0 ? (
                    <span className="admin-sidebar-icon-badge">
                      {count > 99 ? "99+" : count}
                    </span>
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
            {activeRegionSlug && allowedRegions.length > 0 ? (
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Active region
                </span>
                <select
                  aria-label="Active region"
                  value={activeRegionSlug}
                  onChange={(event) => changeRegion(event.target.value)}
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    background: "var(--color-panel)",
                    padding: "8px 10px",
                  }}
                >
                  {allowedRegions.map((region) => (
                    <option key={region.code} value={region.slug}>
                      {region.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div id="admin-page-actions" className="admin-topbar-actions" />
            <AdminLogoutButton />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
