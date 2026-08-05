"use client";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";

const palette = {
  navy: "#0B1E3D",
  muted: "#5A6A7A",
  bg: "#F7F8FA",
  card: "#FFFFFF",
  border: "#EAECEF",
  amber: "#B7791F",
  amberBg: "#FBF3E3",
  teal: "#0F6B5C",
  tealBg: "#E9F5F2",
  plum: "#5B4B8A",
  plumBg: "#F1EDF9",
};

type Group = {
  key: string;
  title: string;
  icon: string;
  accent: string;
  accentBg: string;
  rules: string[];
};

const groups: Group[] = [
  {
    key: "general",
    title: "General",
    icon: "①",
    accent: palette.navy,
    accentBg: "#EEF1F5",
    rules: [
      "Be punctual — the driver will not wait beyond the allowed time.",
      "Only declared passengers may board, except for infants. Pickup and drop-off happen exclusively at the specified locations — no additional stops.",
    ],
  },
  {
    key: "shared",
    title: "Shared Taxi",
    icon: "🚕",
    accent: palette.amber,
    accentBg: palette.amberBg,
    rules: [
      "No extra baggage allowed.",
      "Maximum waiting time: 2 minutes.",
    ],
  },
  {
    key: "private",
    title: "Private Vehicles",
    icon: "🚗",
    accent: palette.teal,
    accentBg: palette.tealBg,
    rules: [
      "Maximum waiting time: 2 minutes.",
      "Maximum baggage: 2 back bags.",
    ],
  },
  {
    key: "van",
    title: "Vans & Microbus",
    icon: "🚐",
    accent: palette.plum,
    accentBg: palette.plumBg,
    rules: [
      "No extra baggage allowed for shared van/microbus bookings.",
      "No waiting time — be at the pickup point on time.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100dvh", background: palette.bg }}>
      <AppHeader authed variant="app" />

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px 64px" }}>
        <div style={{ marginBottom: 32 }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: palette.muted,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              margin: "0 0 8px",
            }}
          >
            Before you book
          </p>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: palette.navy,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Terms & Conditions
          </h1>
          <p style={{ color: palette.muted, marginTop: 8, lineHeight: 1.6, maxWidth: 560 }}>
            Read these conditions carefully before booking. Confirming a
            booking means you accept and agree to the terms below.
          </p>
        </div>

        {/* Notice banner */}
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            background: palette.amberBg,
            border: `1px solid ${palette.amber}33`,
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 28,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: "20px" }}>⚠️</span>
          <p style={{ margin: 0, fontSize: 13.5, color: "#7A5210", lineHeight: 1.5 }}>
            Waiting-time and baggage limits differ by vehicle type — check the
            section for the ride you booked.
          </p>
        </div>

        {/* Route rail of rule groups */}
        <div style={{ position: "relative" }}>
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 15,
              top: 8,
              bottom: 8,
              width: 2,
              background: `repeating-linear-gradient(${palette.border}, ${palette.border} 4px, transparent 4px, transparent 9px)`,
            }}
          />

          {groups.map((g, i) => (
            <section
              key={g.key}
              style={{
                position: "relative",
                paddingLeft: 44,
                marginBottom: i === groups.length - 1 ? 0 : 22,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: g.accentBg,
                  border: `1px solid ${g.accent}33`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                }}
              >
                {g.icon}
              </div>

              <div
                style={{
                  background: palette.card,
                  border: `1px solid ${palette.border}`,
                  borderLeft: `3px solid ${g.accent}`,
                  borderRadius: 12,
                  padding: "14px 18px",
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 13,
                    fontWeight: 700,
                    color: g.accent,
                  }}
                >
                  {g.title}
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, color: palette.navy }}>
                  {g.rules.map((rule, idx) => (
                    <li
                      key={idx}
                      style={{
                        marginBottom: idx === g.rules.length - 1 ? 0 : 6,
                        lineHeight: 1.55,
                        fontSize: 14.5,
                      }}
                    >
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>

        <p style={{ marginTop: 32, color: palette.muted, fontSize: 14 }}>
          Back to booking:{" "}
          <Link href="/create" style={{ color: palette.navy, fontWeight: 600 }}>
            Create booking
          </Link>
        </p>
      </main>
    </div>
  );
}