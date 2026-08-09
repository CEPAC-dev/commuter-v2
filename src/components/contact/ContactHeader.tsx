"use client";

import { MessageSquare } from "lucide-react";
import { useClientLocale } from "@/lib/locale.client";

export default function ContactHeader() {
  const { t } = useClientLocale();

  return (
    <div style={{ textAlign: "center", marginBottom: 36 }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "rgba(0,194,168,0.1)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <MessageSquare
          size={26}
          style={{ color: "#00C2A8" }}
          aria-hidden="true"
        />
      </div>
      <p
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#00C2A8",
          margin: "0 0 12px",
        }}
      >
        {t("contact.section_label")}
      </p>
      <h1
        style={{
          fontSize: "clamp(28px, 4vw, 36px)",
          fontWeight: 800,
          color: "#0B1E3D",
          letterSpacing: "-0.025em",
          margin: "0 0 14px",
        }}
      >
        {t("contact.heading")}
      </h1>
      <p
        style={{
          fontSize: 16,
          color: "#5A6A7A",
          lineHeight: 1.7,
          margin: 0,
          maxWidth: 480,
          marginInline: "auto",
        }}
      >
        {t("contact.description")}
      </p>
    </div>
  );
}
