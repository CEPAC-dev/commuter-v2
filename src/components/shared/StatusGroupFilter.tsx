"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useClientLocale } from "@/lib/locale.client";

export default function StatusGroupFilter({
  hiddenGroups = [],
}: {
  hiddenGroups?: Array<"all" | "upcoming" | "ongoing" | "previous" | "pending_payment">;
}) {
  const { t } = useClientLocale();

  const GROUPS = [
    { value: "all", label: t("filter.all") },
    { value: "upcoming", label: t("status.upcoming") },
    { value: "ongoing", label: t("status.ongoing") },
    { value: "previous", label: t("status.previous") },
    { value: "pending_payment", label: t("status.pending_payment") },
  ] as const;

  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const active = sp.get("group") ?? "all";
  const visibleGroups = GROUPS.filter((g) => !hiddenGroups.includes(g.value));

  function select(value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value === "all") params.set("group", "all");
    else if (value) params.set("group", value);
    else params.delete("group");
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {visibleGroups.map((g) => {
        const isActive = active === g.value;
        return (
          <button
            key={g.value}
            type="button"
            onClick={() => select(g.value)}
            style={{
              border: isActive ? "1.5px solid #00C2A8" : "1.5px solid #e2e8ec",
              background: isActive ? "#00C2A8" : "#fff",
              color: isActive ? "#fff" : "#0B1E3D",
              fontWeight: 700,
              fontSize: 13,
              padding: "8px 16px",
              borderRadius: 20,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {g.label}
          </button>
        );
      })}
    </div>
  );
}
