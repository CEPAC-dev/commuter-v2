"use client";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import { useClientLocale } from "@/lib/locale.client";

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

export default function TermsPage() {
  const { t, locale } = useClientLocale();
  const isArabic = locale === "ar";

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
      title: t("terms.general_title"),
      icon: "①",
      accent: palette.navy,
      accentBg: "#EEF1F5",
      rules: [
        t("terms.general_rule1"),
        t("terms.general_rule2"),
      ],
    },
    {
      key: "shared",
      title: t("terms.shared_taxi_title"),
      icon: "🚕",
      accent: palette.amber,
      accentBg: palette.amberBg,
      rules: [
        t("terms.shared_taxi_rule1"),
        t("terms.shared_taxi_rule2"),
      ],
    },
    {
      key: "private",
      title: t("terms.private_vehicles_title"),
      icon: "🚗",
      accent: palette.teal,
      accentBg: palette.tealBg,
      rules: [
        t("terms.private_vehicles_rule1"),
        t("terms.private_vehicles_rule2"),
      ],
    },
    {
      key: "van",
      title: t("terms.van_microbus_title"),
      icon: "🚐",
      accent: palette.plum,
      accentBg: palette.plumBg,
      rules: [
        t("terms.van_microbus_rule1"),
        t("terms.van_microbus_rule2"),
      ],
    },
  ];
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
            {t("terms.before_book")}
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
            {t("terms.heading")}
          </h1>
          <p style={{ color: palette.muted, marginTop: 8, lineHeight: 1.6, maxWidth: 560 }}>
            {t("terms.intro")}
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
            {t("terms.warning_banner")}
          </p>
        </div>

        {/* Route rail of rule groups */}
        <div style={{ position: "relative" }}>
          <div
            aria-hidden
            style={{
              position: "absolute",
              [isArabic ? "right" : "left"]: 15,
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
                [isArabic ? "paddingRight" : "paddingLeft"]: 44,
                marginBottom: i === groups.length - 1 ? 0 : 22,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  [isArabic ? "right" : "left"]: 0,
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
                  [isArabic ? "borderRight" : "borderLeft"]: `3px solid ${g.accent}`,
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
                <ul style={{ margin: 0, [isArabic ? "paddingRight" : "paddingLeft"]: 18, color: palette.navy }}>
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
          {t("terms.back_to_booking")}{" "}
          <Link href="/create" style={{ color: palette.navy, fontWeight: 600 }}>
            {t("terms.create_booking")}
          </Link>
        </p>
      </main>
    </div>
  );
}