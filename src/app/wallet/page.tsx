import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth/session";
import AppHeader from "@/components/layout/AppHeader";
import WalletClient from "@/components/wallet/WalletClient";

export const metadata = { title: "Wallet — Commuter" };
export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/wallet");
  if (session.role === "admin") redirect("/admin/dashboard");

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader
        authed
        email={session.email}
        role={session.role}
        variant="app"
        backHref="/"
      />

      <Suspense fallback={null}>
        <WalletClient role={session.role} />
      </Suspense>
    </div>
  );
}
