"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const GROUPS: {
  value: "" | "upcoming" | "ongoing" | "previous" | "pending_payment";
  label: string;
}[] = [
  { value: "", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "ongoing", label: "Ongoing" },
  { value: "previous", label: "Previous" },
  { value: "pending_payment", label: "Pending payment" },
];

export default function StatusGroupFilter({
  hiddenGroups = [],
}: {
  hiddenGroups?: Array<(typeof GROUPS)[number]["value"]>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const active = sp.get("group") ?? "";
  const visibleGroups = GROUPS.filter((g) => !hiddenGroups.includes(g.value));

  function select(value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set("group", value);
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
