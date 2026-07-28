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

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        minWidth: 130,
        padding: "14px 16px",
        borderRadius: 12,
        background: hover
          ? "linear-gradient(135deg, #f6fbfa 0%, #eefbf8 100%)"
          : "#f8f9fa",
        border: hover ? `1.5px solid ${accent}` : "1px solid #eef0f3",
        boxShadow: hover ? "0 10px 28px rgba(0,194,168,0.14)" : "none",
        transform: hover ? "translateY(-2px)" : "none",
        transition: "all 0.22s ease",
        position: "relative",
        cursor: "default",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: hover ? "rgba(0,194,168,0.14)" : "rgba(11,30,61,0.06)",
            transition: "background 0.22s ease",
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: hover ? "#00806E" : "#0B1E3D",
            lineHeight: 1.2,
            transition: "color 0.22s ease",
          }}
        >
          {headline}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 500,
          color: "#5A6A7A",
        }}
      >
        {value}
      </p>

      {hover && lines.length > 0 && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            left: 0,
            right: 0,
            background: "#0B1E3D",
            color: "#fff",
            padding: "10px 12px",
            borderRadius: 10,
            fontSize: 12,
            zIndex: 30,
            boxShadow: "0 8px 28px rgba(11,30,61,0.28)",
          }}
        >
          {lines.map((l, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "3px 0",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.55)" }}>{l.label}</span>
              <strong style={{ fontWeight: 700 }}>{l.value}</strong>
            </div>
          ))}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "100%",
              left: 24,
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
