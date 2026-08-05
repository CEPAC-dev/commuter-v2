"use client";

import { useState } from "react";

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
  const [hover, setHover] = useState(false);
  const hasTooltip = lines.length > 0;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        minWidth: 230,
        padding: "18px 18px 16px",
        borderRadius: 18,
        background: hover ? "#ffffff" : "#f8f9fa",
        border: hover ? `1.5px solid ${accent}` : "1px solid #eef0f3",
        boxShadow: hover ? "0 14px 36px rgba(0,0,0,0.08)" : "none",
        transform: hover ? "translateY(-2px)" : "none",
        transition: "all 0.22s ease",
        position: "relative",
        cursor: hasTooltip ? "pointer" : "default",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: hover ? "rgba(0,194,168,0.16)" : "rgba(11,30,61,0.08)",
            transition: "background 0.22s ease",
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
              color: hover ? "#00806E" : "#0B1E3D",
              lineHeight: 1.3,
              transition: "color 0.22s ease",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {headline}
          </p>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 16,
              fontWeight: 800,
              color: "#0B1E3D",
              lineHeight: 1.2,
            }}
          >
            {value}
          </p>
        </div>
      </div>

      {hasTooltip && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 600,
            color: "#5A6A7A",
          }}
        >
          {hover ? "Route breakdown" : "Hover for details"}
        </p>
      )}

      {hover && hasTooltip && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 12px)",
            left: 0,
            right: 0,
            background: "#0B1E3D",
            color: "#fff",
            padding: "14px 16px",
            borderRadius: 16,
            fontSize: 13,
            zIndex: 30,
            boxShadow: "0 12px 30px rgba(11,30,61,0.24)",
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
              <span style={{ color: "rgba(255,255,255,0.7)" }}>{l.label}</span>
              <strong style={{ fontWeight: 700 }}>{l.value}</strong>
            </div>
          ))}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "100%",
              left: 28,
              width: 0,
              height: 0,
              borderLeft: "7px solid transparent",
              borderRight: "7px solid transparent",
              borderTop: "7px solid #0B1E3D",
            }}
          />
        </div>
      )}
    </div>
  );
}
