"use client";
import { LogOut } from "lucide-react";
import { useClientLocale } from "@/lib/i18n/client";

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function LogoutConfirmModal({ open, onConfirm, onCancel }: Props) {
  const { t } = useClientLocale();
  
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,30,61,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 340,
          boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
          textAlign: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#FFF3E0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
          }}
        >
          <LogOut size={22} color="#E65100" aria-hidden="true" />
        </div>
        <p
          id="logout-modal-title"
          style={{
            margin: "0 0 6px",
            fontSize: 17,
            fontWeight: 800,
            color: "#0B1E3D",
          }}
        >
          {t("logout.title")}
        </p>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#5A6A7A" }}>
          {t("logout.description")}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 10,
              border: "1.5px solid #e8edf0",
              background: "#fff",
              color: "#0B1E3D",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            {t("logout.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 10,
              border: "none",
              background: "#e74c3c",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            {t("logout.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
