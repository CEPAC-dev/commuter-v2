"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Image from "next/image";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const linkColor = scrolled ? "#0B1E3D" : "#ffffff";
  const borderColor = scrolled ? "#0B1E3D" : "rgba(255,255,255,0.75)";

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: scrolled ? "rgba(255,255,255,0.93)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.07)" : "none",
        transition: "background 0.25s, border-color 0.25s",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          aria-label="Commuter home"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 9,
          }}
        >
          {/* <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "#00C2A8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="4" fill="#0B1E3D" />
              <path
                d="M10 2v2M10 16v2M2 10h2M16 10h2"
                stroke="#0B1E3D"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div> */}
          <Image
            src="/assets/images/commuterLogo.png"
            alt="Commuter logo"
            width={36}
            height={36}
          />
          <span
            style={{
              fontWeight: 800,
              fontSize: 18,
              color: linkColor,
              letterSpacing: "-0.025em",
              transition: "color 0.25s",
            }}
          >
            Commuter
          </span>
        </Link>

        {/* Desktop nav */}
        <nav
          aria-label="Main navigation"
          style={{ display: "flex", alignItems: "center", gap: 12 }}
          className="header-desktop-nav"
        >
          <Link
            href="/my-trips"
            style={{
              fontWeight: 500,
              fontSize: 14,
              color: linkColor,
              textDecoration: "none",
              padding: "8px 14px",
              borderRadius: 8,
              transition: "color 0.2s, background 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = scrolled
                ? "#f0f4f8"
                : "rgba(255,255,255,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            My trips
          </Link>
          <Link
            href="/login"
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: linkColor,
              textDecoration: "none",
              padding: "9px 20px",
              borderRadius: 9,
              border: `2px solid ${borderColor}`,
              transition: "all 0.2s",
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#00C2A8";
              e.currentTarget.style.borderColor = "#00C2A8";
              e.currentTarget.style.color = "#0B1E3D";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = borderColor;
              e.currentTarget.style.color = linkColor;
            }}
          >
            Log in
          </Link>
        </nav>

        {/* Mobile toggle */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className="header-mobile-toggle"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: linkColor,
            padding: 8,
            minWidth: 44,
            minHeight: 44,
            display: "none",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <nav
          aria-label="Mobile navigation"
          style={{
            background: "#ffffff",
            borderTop: "1px solid #eef0f3",
            padding: "12px 24px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <Link
            href="/my-trips"
            onClick={() => setMenuOpen(false)}
            style={{
              display: "block",
              fontWeight: 500,
              fontSize: 15,
              color: "#0B1E3D",
              padding: "12px 16px",
              borderRadius: 10,
              textDecoration: "none",
            }}
          >
            My trips
          </Link>
          <Link
            href="/login"
            onClick={() => setMenuOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 15,
              color: "#0B1E3D",
              padding: "13px 20px",
              borderRadius: 10,
              border: "2px solid #0B1E3D",
              textDecoration: "none",
              minHeight: 48,
            }}
          >
            Log in
          </Link>
        </nav>
      )}

      <style>{`
        @media (max-width: 767px) {
          .header-desktop-nav { display: none !important; }
          .header-mobile-toggle { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
