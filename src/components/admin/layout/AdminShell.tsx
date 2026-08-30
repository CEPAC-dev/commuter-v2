"use client";

import type { ReactNode } from "react";
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
  Route,
  Settings,
  SlidersHorizontal,
  TicketPercent,
  Users,
} from "lucide-react";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";

const sections = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/trips", label: "Trips", icon: Route },
  { href: "/admin/rides", label: "Rides", icon: Car },
  { href: "/admin/availability", label: "Availability", icon: CalendarClock },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: Banknote },
  { href: "/admin/transactions", label: "Transactions", icon: ChartNoAxesCombined },
  { href: "/admin/promo-codes", label: "Promo codes", icon: TicketPercent },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/referral-settings", label: "Referral settings", icon: Gift },
  { href: "/admin/operation", label: "Operation", icon: SlidersHorizontal },
] as const;

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

  if (isAuthPage) return <div className="admin-shell">{children}</div>;

  return (
    <div className="admin-shell admin-shell-frame" dir="ltr">
      <aside className="admin-sidebar">
        <Link href="/admin/dashboard" className="admin-sidebar-brand">
          <ListChecks size={22} aria-hidden="true" />
          Commuter Admin
        </Link>
        <nav className="admin-sidebar-nav" aria-label="Admin sections">
          {sections.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(`${href}/`));
            return (
              <Link key={href} href={href} className="admin-sidebar-link" aria-current={active ? "page" : undefined}>
                <Icon size={17} aria-hidden="true" />
                {label}
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