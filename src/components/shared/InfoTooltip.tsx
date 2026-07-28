"use client";

import { useState } from "react";
import { Info } from "lucide-react";

export default function InfoTooltip({
  lines,
}: {
  lines: { label: string; value: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.preventDefault();
        setOpen((v) => !v);
      }}
    >
      <Info
        size={14}
        color="#9aa7b4"
        style={{ cursor: "pointer" }}
        aria-hidden="true"
      />
      {open && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0B1E3D",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 12,
            whiteSpace: "nowrap",
            zIndex: 20,
            boxShadow: "0 4px 16px rgba(11,30,61,0.25)",
          }}
        >
          {lines.map((l, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "2px 0",
              }}
            >
              <span style={{ color: "#9aa7b4" }}>{l.label}</span>
              <strong>{l.value}</strong>
            </div>
          ))}
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid #0B1E3D",
            }}
          />
        </div>
      )}
    </span>
  );
}
