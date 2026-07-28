"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  X,
  ArrowLeft,
  FileText,
  History,
  Wallet,
  User,
  LogOut,
  LogIn,
  CalendarPlus,
  CalendarClock,
} from "lucide-react";
import { useTripStore } from "@/lib/store/useTripStore";
import LogoutConfirmModal from "@/components/shared/LogoutConfirmModal";

type Variant = "landing" | "app";
type Role = "passenger" | "driver" | "admin";

interface Props {
  authed: boolean;
  email?: string;
  variant?: Variant;
  role?: Role;
  /** Optional back-arrow target (app variant only). */
  backHref?: string;
}

const PASSENGER_NAV_LINKS = [
  { href: "/create", label: "Book", icon: CalendarPlus },
  { href: "/my-trips", label: "My trips", icon: FileText },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/profile", label: "Profile", icon: User },
] as const;

const DRIVER_NAV_LINKS = [
  { href: "/my-trips", label: "My trips", icon: History },
  { href: "/availability", label: "Availability", icon: CalendarClock },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export default function AppHeader({
  authed,
  email,
  variant = "app",
  role = "passenger",
  backHref,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { clear } = useTripStore();
  const NAV_LINKS = role === "driver" ? DRIVER_NAV_LINKS : PASSENGER_NAV_LINKS;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const isLanding = variant === "landing";

  useEffect(() => {
    if (!isLanding) return;
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isLanding]);

  // Solid (app) headers are always dark; landing is transparent until scrolled.
  const solid = !isLanding || scrolled;
  const barBg = isLanding
    ? scrolled
      ? "rgba(255,255,255,0.93)"
      : "transparent"
    : "#0B1E3D";
  const fg = isLanding ? (scrolled ? "#0B1E3D" : "#ffffff") : "#ffffff";
  const subtleBg = solid && isLanding ? "#f0f4f8" : "rgba(255,255,255,0.12)";

  async function handleLogout() {
    setShowLogoutModal(false);
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      clear();
    } finally {
      router.replace("/login");
    }
  }

  function isActive(href: string) {
    return pathname === href;
  }

  return (
    <header
      style={{
        position: isLanding ? "fixed" : "sticky",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: barBg,
        backdropFilter: isLanding && scrolled ? "blur(12px)" : "none",
        WebkitBackdropFilter: isLanding && scrolled ? "blur(12px)" : "none",
        borderBottom: isLanding
          ? scrolled
            ? "1px solid rgba(0,0,0,0.07)"
            : "none"
          : "1px solid rgba(255,255,255,0.06)",
        transition: "background 0.25s, border-color 0.25s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 20px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        {/* Left: optional back + logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {backHref && (
            <Link
              href={backHref}
              aria-label="Back"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 8,
                color: fg,
                background: "rgba(255,255,255,0.1)",
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
          )}
          <Link
            href={role === "driver" ? "/my-trips" : "/"}
            aria-label="Commuter home"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 9,
            }}
          >
            <Image
              src="/assets/images/commuterLogo.png"
              alt="Commuter logo"
              width={32}
              height={32}
            />
            <span
              style={{
                fontWeight: 800,
                fontSize: 18,
                color: fg,
                letterSpacing: "-0.025em",
                transition: "color 0.25s",
              }}
            >
              Commuter
            </span>
          </Link>
        </div>

        {/* Desktop nav */}
        <nav
          aria-label="Main navigation"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
          className="appheader-desktop"
        >
          {authed ? (
            <>
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  style={{
                    fontWeight: isActive(href) ? 700 : 500,
                    fontSize: 14,
                    color: fg,
                    textDecoration: "none",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: isActive(href) ? subtleBg : "transparent",
                    transition: "color 0.2s, background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = subtleBg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isActive(href)
                      ? subtleBg
                      : "transparent";
                  }}
                >
                  {label}
                </Link>
              ))}
              <button
                onClick={() => setShowLogoutModal(true)}
                disabled={loggingOut}
                aria-label="Log out"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginLeft: 4,
                  background: "transparent",
                  border: `1.5px solid ${
                    isLanding && !scrolled
                      ? "rgba(255,255,255,0.5)"
                      : "rgba(255,255,255,0.25)"
                  }`,
                  borderRadius: 8,
                  cursor: loggingOut ? "not-allowed" : "pointer",
                  color: fg,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  padding: "8px 12px",
                  minHeight: 36,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#e74c3c";
                  e.currentTarget.style.color = "#ff6b5b";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor =
                    isLanding && !scrolled
                      ? "rgba(255,255,255,0.5)"
                      : "rgba(255,255,255,0.25)";
                  e.currentTarget.style.color = fg;
                }}
              >
                <LogOut size={14} aria-hidden="true" />
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: fg,
                textDecoration: "none",
                padding: "9px 20px",
                borderRadius: 9,
                border: `2px solid ${
                  isLanding && !scrolled ? "rgba(255,255,255,0.75)" : "#0B1E3D"
                }`,
                transition: "all 0.2s",
                minHeight: 44,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#00C2A8";
                e.currentTarget.style.borderColor = "#00C2A8";
                e.currentTarget.style.color = "#0B1E3D";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor =
                  isLanding && !scrolled ? "rgba(255,255,255,0.75)" : "#0B1E3D";
                e.currentTarget.style.color = fg;
              }}
            >
              <LogIn size={15} aria-hidden="true" />
              Log in
            </Link>
          )}
        </nav>

        {/* Mobile toggle */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className="appheader-mobile-toggle"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: fg,
            padding: 8,
            minWidth: 44,
            minHeight: 44,
            display: "none",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <nav
          aria-label="Mobile navigation"
          style={{
            background: "#ffffff",
            borderTop: "1px solid #eef0f3",
            padding: "12px 20px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {authed ? (
            <>
              {email && (
                <p
                  style={{
                    fontSize: 12,
                    color: "#5A6A7A",
                    margin: "4px 4px 8px",
                  }}
                >
                  {email}
                </p>
              )}
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontWeight: isActive(href) ? 700 : 500,
                    fontSize: 15,
                    color: "#0B1E3D",
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: isActive(href) ? "#f0f4f8" : "transparent",
                    textDecoration: "none",
                  }}
                >
                  <Icon size={17} aria-hidden="true" />
                  {label}
                </Link>
              ))}
              <button
                onClick={() => setShowLogoutModal(true)}
                disabled={loggingOut}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontWeight: 700,
                  fontSize: 15,
                  color: "#e74c3c",
                  padding: "13px 20px",
                  borderRadius: 10,
                  border: "2px solid rgba(231,76,60,0.4)",
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  minHeight: 48,
                  marginTop: 4,
                }}
              >
                <LogOut size={16} aria-hidden="true" />
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontWeight: 700,
                fontSize: 15,
                color: "#0B1E3D",
                padding: "13px 20px",
                borderRadius: 10,
                border: "2px solid #0B1E3D",
                textDecoration: "none",
                minHeight: 48,
              }}
            >
              <LogIn size={16} aria-hidden="true" />
              Log in
            </Link>
          )}
        </nav>
      )}

      <style>{`
        @media (max-width: 767px) {
          .appheader-desktop { display: none !important; }
          .appheader-mobile-toggle { display: flex !important; }
        }
      `}</style>
      <LogoutConfirmModal
        open={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </header>
  );
}
