"use client";

import React from "react";
import { useTranslations } from "next-intl";

interface PageHeaderProps {
  title: string;
  onBack: () => void;
  rightElement?: React.ReactNode;
}

export default function PageHeader({
  title,
  onBack,
  rightElement,
}: PageHeaderProps) {
  const t = useTranslations("common");
  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] bg-white sticky z-40 page-header-container"
      style={{ top: 64 }}
    >
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[#5A6A7A] hover:text-[#0B1E3D]"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {t("back_btn")}
      </button>
      <h2 className="text-sm font-semibold text-[#0B1E3D] page-header-title">
        {title}
      </h2>
      <div className="w-16 flex justify-end">{rightElement}</div>
    </div>
  );
}
