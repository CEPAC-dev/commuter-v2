import type { RequestStatus } from "@/types/user";

const STATUS_CONFIG: Record<
  RequestStatus,
  { label: string; bg: string; color: string; dot?: boolean }
> = {
  available: { label: "Available", bg: "#EFF7F6", color: "#00C2A8" },
  submitted: { label: "Submitted", bg: "#E2E8F0", color: "#5A6A7A" },
  finding_driver: {
    label: "Finding driver…",
    bg: "#FFF3E0",
    color: "#E65100",
  },
 
  driver_offered: {
    label: "Driver offered",
    bg: "#FFF3E0",
    color: "#E65100",
  },
  price_raised: {
    label: "⚠ Price updated",
    bg: "#FFF8E1",
    color: "#F57F17",
  },
  matched: { label: "Matched", bg: "#EFF7F6", color: "#00C2A8" },
  confirmed: { label: "Confirmed", bg: "#E8F5E9", color: "#27AE60" },
  active: { label: "● Active", bg: "#00C2A8", color: "#fff", dot: true },
  completed: { label: "Completed", bg: "#0B1E3D", color: "#fff" },
  cancelled: { label: "Cancelled", bg: "#FFEBEE", color: "#E74C3C" },
};

interface StatusPillProps {
  status: RequestStatus;
}

export default function StatusPill({ status }: StatusPillProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        background: cfg.bg,
        color: cfg.color,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}
