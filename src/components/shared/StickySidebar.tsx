"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface StickySidebarProps {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  bottomGap?: number;
}

export default function StickySidebar({
  children,
  className = "",
  ariaLabel,
  bottomGap = 24,
}: StickySidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [computedTop, setComputedTop] = useState<string>("var(--app-header-offset)");

  useEffect(() => {
    let lastScrollY = typeof window !== "undefined" ? window.scrollY : 0;

    const handleScrollOrResize = () => {
      if (!sidebarRef.current || !innerRef.current) return;

      const innerHeight = innerRef.current.offsetHeight;
      const vh = window.innerHeight;
      const currentScrollY = window.scrollY;

      // Read --app-header-offset from root CSS or fallback to 77
      let headerOffset = 77;
      if (typeof window !== "undefined") {
        const style = getComputedStyle(document.documentElement);
        const headerOffsetRaw = style.getPropertyValue("--app-header-offset").trim();
        if (headerOffsetRaw) {
          const parsed = parseFloat(headerOffsetRaw);
          if (!isNaN(parsed) && parsed > 0) {
            headerOffset = parsed;
          }
        }
      }

      const totalNeeded = innerHeight + headerOffset + bottomGap;

      if (totalNeeded <= vh) {
        // Fits inside viewport -> stick top at header offset
        setComputedTop("var(--app-header-offset)");
      } else {
        // Taller than viewport -> dynamically adjust sticky top
        const isScrollingDown = currentScrollY >= lastScrollY;
        if (isScrollingDown) {
          // When scrolling down, pin bottom of sidebar to bottomGap from viewport bottom
          const targetPx = vh - innerHeight - bottomGap;
          setComputedTop(`${targetPx}px`);
        } else {
          // When scrolling up, pin top of sidebar to header offset
          setComputedTop("var(--app-header-offset)");
        }
      }

      lastScrollY = currentScrollY;
    };

    handleScrollOrResize();

    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    window.addEventListener("resize", handleScrollOrResize);

    const observer = new ResizeObserver(handleScrollOrResize);
    if (innerRef.current) {
      observer.observe(innerRef.current);
    }

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleScrollOrResize);
      observer.disconnect();
    };
  }, [bottomGap]);

  return (
    <aside
      ref={sidebarRef}
      className={className}
      aria-label={ariaLabel}
      style={{
        position: "sticky",
        top: computedTop,
        alignSelf: "start",
        zIndex: 5,
        height: "fit-content",
        transition: "top 0.15s ease-out",
      }}
    >
      <div ref={innerRef} className="my-trips-sidebar-pin">
        {children}
      </div>
    </aside>
  );
}
