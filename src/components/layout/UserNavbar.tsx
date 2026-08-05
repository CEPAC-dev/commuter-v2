// @ts-nocheck
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { ChevronDown, LogOut, User, Wallet, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import authApi from "@/lib/api/auth";
import { getUnreadCount } from "@/lib/api/notifications";
import LanguageToggle from "./LanguageToggle";
import LogoutConfirmModal from "@/components/shared/LogoutConfirmModal";
import { useTranslations } from "next-intl";

export default function UserNavbar() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const isMapPage =
    pathname.startsWith("/user/request/map") ||
    pathname.startsWith("/user/request/return-map");

  const LINKS = [
    { label: t("create_request"), href: "/user/request/new", isCreate: true },
    { label: t("my_requests"), href: "/user/my-requests", isCreate: false },
    { label: t("profile"), href: "/user/profile", isCreate: false },
  ];
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userName, setUserName] = useState(t("default_user"));
  const [unreadCount, setUnreadCount] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { name: authName, logout, profilePhoto } = useAuth();

  useEffect(() => {
    if (authName) setUserName(authName);
  }, [authName]);

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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    setShowLogoutModal(false);
    try {
      await authApi.logout();
    } catch {
      // ignore — clear client session regardless
    }
    logout();
    router.replace("/");
  }

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <style>{`
        .unav-link { text-decoration: none; transition: color 0.15s; position: relative; padding-bottom: 4px; }
        .unav-drop-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; font-size: 14px; font-weight: 500; text-decoration: none; width: 100%; background: none; border: none; cursor: pointer; font-family: inherit; color: #0B1E3D; border-radius: 6px; }
        .unav-drop-item:hover { background: #EFF7F6; }
        .unav-drop-danger:hover { background: #FEF2F2; color: #E74C3C; }
      `}</style>

      {/* Desktop only */}
      <nav
        dir="ltr"
        className={`hidden md:flex ${isMapPage ? "navbar-glass" : ""}`}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          height: 64,
          background: isMapPage ? undefined : "#fff",
          borderBottom: isMapPage ? undefined : "1px solid #E2E8F0",
          alignItems: "center",
          padding: "0 32px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Logo — left */}
        <Link
          href="/user/my-requests"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            flexShrink: 0,
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "#0B1E3D",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                color: "#00C2A8",
                fontWeight: 900,
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              C
            </span>
          </div>
          <span style={{ color: "#0B1E3D", fontWeight: 700, fontSize: 18 }}>
            {tCommon("app_name")}
          </span>
        </Link>

        {/* Center nav links */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 36,
          }}
        >
          {LINKS.map(({ label, href, isCreate }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="unav-link"
                style={{
                  fontSize: 15,
                  fontWeight: active ? 600 : 500,
                  color: isCreate
                    ? active
                      ? "#00C2A8"
                      : "#009E8A"
                    : active
                      ? "#0B1E3D"
                      : "#5A6A7A",
                  borderBottom: active
                    ? `2px solid ${isCreate ? "#00C2A8" : "#00C2A8"}`
                    : "2px solid transparent",
                  paddingBottom: 4,
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right: language toggle + user avatar + dropdown */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            position: "relative",
            zIndex: 1,
          }}
        >
          <LanguageToggle />
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "none",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
                fontFamily: "inherit",
                minHeight: 44,
              }}
            >
              {/* Avatar with notification dot */}
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "#0B1E3D",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#00C2A8",
                    fontWeight: 700,
                    fontSize: 13,
                    overflow: "hidden",
                  }}
                >
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt="profile"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    initials
                  )}
                </div>
                {unreadCount > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 10,
                      height: 10,
                      background: "#E74C3C",
                      borderRadius: "50%",
                      border: "2px solid #fff",
                    }}
                  />
                )}
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#0B1E3D" }}>
                {userName}
              </span>
              <ChevronDown
                size={14}
                color="#5A6A7A"
                style={{
                  transform: dropdownOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s",
                }}
              />
            </button>

            {dropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  background: "#fff",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  minWidth: 200,
                  overflow: "hidden",
                  zIndex: 100,
                }}
              >
                <Link
                  href="/user/profile"
                  className="unav-drop-item"
                  onClick={() => setDropdownOpen(false)}
                >
                  <User size={16} />
                  {t("profile")}
                </Link>
                <Link
                  href="/user/wallet"
                  className="unav-drop-item"
                  onClick={() => setDropdownOpen(false)}
                >
                  <Wallet size={16} />
                  {t("wallet")}
                </Link>
                <Link
                  href="/user/notifications"
                  className="unav-drop-item"
                  onClick={() => setDropdownOpen(false)}
                >
                  <Bell size={16} />
                  {t("notifications")}
                  {unreadCount > 0 && (
                    <span
                      style={{
                        marginLeft: "auto",
                        background: "#E74C3C",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 10,
                        padding: "1px 6px",
                      }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </Link>
                <div
                  style={{ height: 1, background: "#E2E8F0", margin: "4px 0" }}
                />
                <button
                  className="unav-drop-item unav-drop-danger"
                  onClick={() => setShowLogoutModal(true)}
                >
                  <LogOut size={16} />
                  {tCommon("sign_out")}
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      <LogoutConfirmModal
        open={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </>
  );
}
