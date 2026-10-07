"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useClientLocale } from "@/lib/locale.client";

type TripTabKey = "all" | "pending" | "upcoming" | "ongoing";

export default function TripTabs({
  active,
  counts,
}: {
  active: TripTabKey;
  counts: Record<TripTabKey, number>;
}) {
  const { t } = useClientLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTabRef = useRef<HTMLAnchorElement | null>(null);
  const stickySentinelRef = useRef<HTMLSpanElement | null>(null);
  const [stuck, setStuck] = useState(false);
  const tabs: { key: TripTabKey; label: string }[] = [
    { key: "all", label: t("filter.all") },
    { key: "pending", label: t("status.pending") },
    { key: "upcoming", label: t("status.upcoming") },
    { key: "ongoing", label: t("status.ongoing") },
  ];

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [active]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const sentinel = stickySentinelRef.current;
        if (!sentinel) return;
        const root = document.documentElement;
        const rawHeight = getComputedStyle(root).getPropertyValue("--app-header-h");
        const headerHeight = Number.parseFloat(rawHeight) || 0;
        setStuck(sentinel.getBoundingClientRect().top <= headerHeight);
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const header = document.querySelector(".force-ltr");
    const observer = header ? new ResizeObserver(update) : null;
    if (header && observer) observer.observe(header);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, []);

  function href(key: TripTabKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") params.delete("group");
    else params.set("group", key);
    params.delete("page");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <>
      <span ref={stickySentinelRef} className="my-trips-tab-sentinel" aria-hidden="true" />
      <div className={`my-trips-tabbar${stuck ? " is-stuck" : ""}`}>
        <nav className="my-trips-tab-scroll" aria-label={t("my_trips.trip_tabs")}>
          <div className="my-trips-tab-items">
            {tabs.map((tab) => {
              const selected = tab.key === active;
              return (
                <Link
                  key={tab.key}
                  className="trip-tab-link"
                  ref={selected ? activeTabRef : undefined}
                  href={href(tab.key)}
                  aria-current={selected ? "page" : undefined}
                  aria-label={`${tab.label}, ${counts[tab.key]}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    flexShrink: 0,
                    minWidth: "max-content",
                    minHeight: 44,
                    paddingInline: 12,
                    borderBottom: selected ? "3px solid #00C2A8" : "3px solid transparent",
                    color: selected ? "#0B1E3D" : "#5A6A7A",
                    fontSize: 13,
                    fontWeight: selected ? 800 : 600,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    scrollSnapAlign: "start",
                  }}
                >
                  {tab.label}
                  <span style={{ minWidth: 20, padding: "2px 5px", borderRadius: 10, background: selected ? "#DDF5F0" : "#EEF2F2", color: selected ? "#007A6A" : "#5A6A7A", fontSize: 11, fontVariantNumeric: "tabular-nums", textAlign: "center" }}>
                    {counts[tab.key]}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
        <Link className="my-trips-history-link my-trips-history-link-desktop" href="/my-trips/history" aria-label={t("my_trips.view_history")}>
          {t("my_trips.view_history")}
          <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <Link className="my-trips-history-link my-trips-history-link-mobile" href="/my-trips/history" aria-label={t("my_trips.view_history")}>
        {t("my_trips.view_history")}
        <ChevronRight size={15} aria-hidden="true" />
      </Link>
      <style jsx>{`
        .trip-tab-link:focus-visible {
          outline: 3px solid #F5A623;
          outline-offset: 2px;
          z-index: 1;
        }
      `}</style>
    </>
  );
}