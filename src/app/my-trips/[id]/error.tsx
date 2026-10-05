"use client";

import Link from "next/link";
import { useClientLocale } from "@/lib/locale.client";

export default function TripDetailError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useClientLocale();

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "56px 20px", textAlign: "center" }}>
      <h1 style={{ margin: "0 0 8px", color: "#0B1E3D", fontSize: 22 }}>{t("trip_detail.load_error")}</h1>
      <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
        <button
          type="button"
          onClick={reset}
          style={{ minHeight: 44, padding: "0 16px", border: 0, borderRadius: 6, background: "#0B1E3D", color: "#fff", font: "inherit", fontWeight: 700, cursor: "pointer" }}
        >
          {t("trip_detail.try_again")}
        </button>
        <Link href="/my-trips" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 16px", border: "1px solid #C9DCD6", borderRadius: 6, color: "#0B1E3D", fontWeight: 700, textDecoration: "none" }}>
          {t("my_trips.title")}
        </Link>
      </div>
    </main>
  );
}