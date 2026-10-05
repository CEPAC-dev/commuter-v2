"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useClientLocale } from "@/lib/locale.client";
import type { TripHistoryFilter } from "@/lib/tripHistory.ts";

const FILTERS: TripHistoryFilter[] = [
  "all",
  "completed",
  "cancelled",
  "refunded",
  "rejected",
  "expired",
];

export default function TripHistoryFilters({ active }: { active: TripHistoryFilter }) {
  const { t } = useClientLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav aria-label={t("my_trips.history_title")} style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 2 }}>
      {FILTERS.map((filter) => {
        const selected = active === filter;
        const params = new URLSearchParams(searchParams.toString());
        if (filter === "all") params.delete("status");
        else params.set("status", filter);
        params.delete("page");
        const query = params.toString();
        return (
          <Link
            key={filter}
            href={query ? `${pathname}?${query}` : pathname}
            aria-current={selected ? "page" : undefined}
            style={{
              flexShrink: 0,
              padding: "8px 12px",
              border: `1px solid ${selected ? "#00C2A8" : "#DCE6E4"}`,
              borderRadius: 6,
              background: selected ? "#E5F7F3" : "#fff",
              color: selected ? "#007A6A" : "#5A6A7A",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {t(`history.filter_${filter}`)}
          </Link>
        );
      })}
    </nav>
  );
}