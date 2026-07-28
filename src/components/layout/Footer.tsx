"use client";

import Link from "next/link";
import Image from "next/image";
import { SUPPORT_EMAIL } from "@/lib/config/site";

export default function Footer() {
  const year = new Date().getFullYear();

  const links: [string, string][] = [
    ["Contact us", "/contact"],
    ["FAQ", "/faq"],
  ];

  return (
    <footer
      style={{
        background: "linear-gradient(180deg, #0a1628 0%, #060f1e 100%)",
        color: "rgba(255,255,255,0.55)",
        padding: "64px 24px 36px",
        position: "relative",
        overflow: "hidden",
      }}
      aria-label="Site footer"
    >
      {/* Decorative blob */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: -60,
          right: -60,
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: "rgba(0,194,168,0.04)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 48,
            alignItems: "start",
            paddingBottom: 40,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
          className="footer-top"
        >
          {/* Brand */}
          <div style={{ maxWidth: 360 }}>
            <Link
              href="/"
              aria-label="Commuter home"
              style={{
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <Image
                src="/assets/images/commuterLogo.png"
                alt="Commuter logo"
                width={36}
                height={36}
              />
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 20,
                  color: "#ffffff",
                  letterSpacing: "-0.025em",
                }}
              >
                Commuter
              </span>
            </Link>
            <p
              style={{
                fontSize: 15,
                margin: 0,
                lineHeight: 1.7,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              Affordable, reliable rides across Greater Cairo. Private and shared
              options — always on time.
            </p>
          </div>

          {/* Links */}
          <nav
            aria-label="Footer navigation"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              minWidth: 140,
            }}
          >
            <p
              style={{
                fontWeight: 700,
                color: "#ffffff",
                fontSize: 11,
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              Help
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {links.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.55)",
                    textDecoration: "none",
                    transition: "color 0.15s, transform 0.15s",
                    display: "inline-block",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#00C2A8";
                    e.currentTarget.style.transform = "translateX(4px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                >
                  {label}
                </Link>
              ))}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.55)",
                  textDecoration: "none",
                  transition: "color 0.15s, transform 0.15s",
                  display: "inline-block",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#00C2A8";
                  e.currentTarget.style.transform = "translateX(4px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                  e.currentTarget.style.transform = "translateX(0)";
                }}
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </nav>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            paddingTop: 28,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <p style={{ fontSize: 13, margin: 0, color: "rgba(255,255,255,0.4)" }}>
            © {year} Commuter. All rights reserved.
          </p>
          <p
            style={{
              fontSize: 13,
              margin: 0,
              color: "rgba(255,255,255,0.4)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Built for Greater Cairo
            <span aria-hidden="true">🇪🇬</span>
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 600px) {
          .footer-top {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </footer>
  );
}
