"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
}

export default function Pagination({ page, totalPages }: Props) {
  const pathname = usePathname();
  const sp = useSearchParams();

  if (totalPages <= 1) return null;

  function href(p: number) {
    const params = new URLSearchParams(sp.toString());
    if (p <= 1) params.delete("page");
    else params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  // Compact window of page numbers around the current page.
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let p = Math.max(1, end - 4); p <= end; p++) pages.push(p);

  const baseBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    minHeight: 44,
    padding: "0 8px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "none",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#e2e8ec",
    background: "#fff",
    color: "#0B1E3D",
  };

  const disabled: React.CSSProperties = {
    opacity: 0.4,
    pointerEvents: "none",
  };

  return (
    <nav
      aria-label="Pagination"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginTop: 28,
        flexWrap: "wrap",
      }}
    >
      <Link
        href={href(page - 1)}
        aria-label="Previous page"
        style={{ ...baseBtn, ...(page <= 1 ? disabled : {}) }}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </Link>

      {pages.map((p) => {
        const active = p === page;
        return (
          <Link
            key={p}
            href={href(p)}
            aria-current={active ? "page" : undefined}
            style={{
              ...baseBtn,
              ...(active
                ? {
                    background: "#0B1E3D",
                    color: "#fff",
                    borderColor: "#0B1E3D",
                  }
                : {}),
            }}
          >
            {p}
          </Link>
        );
      })}

      <Link
        href={href(page + 1)}
        aria-label="Next page"
        style={{ ...baseBtn, ...(page >= totalPages ? disabled : {}) }}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </nav>
  );
}
