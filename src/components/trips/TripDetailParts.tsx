"use client";

import { useClientLocale } from "@/lib/i18n/client";

export function RideDetailRow({
  icon,
  color,
  headline,
  value,
}: {
  icon: React.ReactNode;
  color: string;
  headline: string;
  value: string;
}) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ marginTop: 3, flexShrink: 0, color }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 800,
            color: "#0B1E3D",
            lineHeight: 1.25,
          }}
        >
          {headline}
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 13,
            fontWeight: 500,
            color: "#5A6A7A",
            lineHeight: 1.45,
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export function TripStatBlock({
  icon,
  headline,
  value,
  lines,
  accent = "#00C2A8",
}: {
  icon: React.ReactNode;
  headline: string;
  value: string;
  lines: { label: string; value: string }[];
  accent?: string;
}) {
  const hasTooltip = lines.length > 0;
  const { t } = useClientLocale();

  return (
    <details
      style={{
        flex: 1,
        minWidth: 230,
        padding: "14px 16px",
        borderRadius: 8,
        background: "#fff",
        border: "1px solid #DCE6E4",
      }}
    >
      <summary
        className="trip-stat-summary"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: hasTooltip ? "pointer" : "default",
          listStylePosition: "inside",
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#E8F4F1",
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              color: "#0B1E3D",
              lineHeight: 1.3,
              textTransform: "uppercase",
            }}
          >
            {headline}
          </p>
          <p
            style={{
              margin: "5px 0 0",
              fontSize: 16,
              fontWeight: 800,
              color: "#0B1E3D",
              lineHeight: 1.2,
            }}
          >
            {value}
          </p>
        </div>
      </summary>

      {hasTooltip && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 600,
            color: "#5A6A7A",
          }}
        >
          {t("map.route_breakdown")}
        </p>
      )}

      {hasTooltip && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: `2px solid ${accent}`,
            fontSize: 13,
          }}
        >
          {lines.map((l, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "6px 0",
                borderBottom: i < lines.length - 1 ? "1px solid rgba(255,255,255,0.12)" : undefined,
              }}
            >
              <span style={{ color: "#5A6A7A" }}>{l.label}</span>
              <strong style={{ fontWeight: 700 }}>{l.value}</strong>
            </div>
          ))}
        </div>
      )}
      <style jsx>{`
        .trip-stat-summary:focus-visible { outline: 3px solid #F5A623; outline-offset: 3px; border-radius: 4px; }
        .trip-stat-summary::-webkit-details-marker { color: ${accent}; }
      `}</style>
    </details>
  );
}
