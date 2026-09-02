"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { AdminButton } from "@/components/admin/layout";

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
    <AdminButton
      type="button"
      variant="destructive"
      onClick={handleLogout}
      disabled={isLoggingOut}
      aria-label="Log out"
    >
      <LogOut size={16} aria-hidden="true" />
      {isLoggingOut ? "Signing out..." : "Log out"}
    </AdminButton>
  );
}
