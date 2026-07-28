"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function AdminLogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      router.replace("/admin/login");
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      aria-label="Log out"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 16px",
        borderRadius: 12,
        background: "#E74C3C",
        color: "#ffffff",
        border: "none",
        fontWeight: 700,
        cursor: isLoggingOut ? "not-allowed" : "pointer",
      }}
    >
      <LogOut size={16} aria-hidden="true" />
      {isLoggingOut ? "Signing out..." : "Log out"}
    </button>
  );
}
