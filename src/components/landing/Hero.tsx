"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { useTripStore } from "@/lib/store/useTripStore";
import type { TripPoint } from "@/lib/store/useTripStore";
import AddressInput from "./AddressInput";
import { useClientLocale } from "@/lib/locale.client";

interface Props {
  authed?: boolean;
}

const InputSkeleton = () => (
  <div
    style={{
      height: 52,
      background: "#f8f9fa",
      borderRadius: 10,
      border: "1.5px solid #e8edf0",
    }}
  />
);

export default function Hero({ authed = false }: Props) {
  const router = useRouter();
  const { t, locale } = useClientLocale();
  const isArabic = locale === "ar";
  const [mounted, setMounted] = useState(false);
  const { pickup, dropoff, setPickup, setDropoff } = useTripStore();
  const [error, setError] = useState("");

  // Prevent sessionStorage hydration mismatch
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  // Build stats dynamically from translations
  const STATS = [
    { label: t("hero.stats.types_available"), value: t("hero.stats.types_value") },
    { label: t("hero.stats.fully_covered"), value: t("hero.stats.coverage_value") },
    { label: t("hero.stats.from"), value: t("hero.stats.price_value") },
  ] as const;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pickup || !dropoff) {
      setError(t("hero.enter_both_locations"));
      return;
    }
    setError("");
    router.push("/create");
  }

  return (
    <section
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(140deg, #0B1E3D 0%, #1C3557 55%, #0d2545 100%)",
        display: "flex",
        alignItems: "center",
        padding: "96px 24px 72px",
        position: "relative",
        overflow: "hidden",
      }}
      aria-label="Book a ride"
    >
      {/* Decorative background blobs */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "radial-gradient(ellipse at 15% 55%, rgba(0,194,168,0.09) 0%, transparent 55%)," +
            "radial-gradient(ellipse at 85% 15%, rgba(245,166,35,0.07) 0%, transparent 50%)",
        }}
      />

      <div
        style={{ maxWidth: 1100, width: "100%", margin: "0 auto" }}
        className="hero-inner"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(360px, 0.8fr)",
            gap: 48,
            alignItems: "center",
          }}
          className="hero-grid"
        >
          {/* Left — copy */}
          <motion.div
            initial={{ opacity: 0, x: -28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#00C2A8",
                margin: "0 0 14px",
              }}
            >
              {t("hero.tagline")}
            </p>
            <h1
              style={{
                fontSize: "clamp(38px, 5vw, 62px)",
                fontWeight: 900,
                color: "#ffffff",
                lineHeight: isArabic ? 1.25 : 1.08,
                letterSpacing: isArabic ? 0 : "-0.035em",
                margin: "0 0 22px",
              }}
            >
              {t("hero.heading_start")}
              <span style={{ color: "#00C2A8" }}>{t("hero.heading_highlight")}</span>
            </h1>
            <p
              style={{
                fontSize: 17,
                color: "rgba(255,255,255,0.68)",
                lineHeight: 1.72,
                margin: 0,
                maxWidth: 400,
              }}
            >
              {t("hero.description")}
            </p>

            {/* Stats */}
            <div
              dir={isArabic ? "rtl" : "ltr"}
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 0,
                marginTop: 40,
                flexWrap: "nowrap",
              }}
              className="hero-stats"
            >
              {STATS.map(({ label, value }, i) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    minWidth: 0,
                    alignItems: "flex-start",
                    textAlign: isArabic ? "right" : "left",
                    gap: 6,
                    ...(isArabic
                      ? {
                          paddingLeft: i < STATS.length - 1 ? 28 : 0,
                          marginLeft: i < STATS.length - 1 ? 28 : 0,
                          borderLeft:
                            i < STATS.length - 1
                              ? "1px solid rgba(255,255,255,0.12)"
                              : "none",
                        }
                      : {
                          paddingRight: i < STATS.length - 1 ? 28 : 0,
                          marginRight: i < STATS.length - 1 ? 28 : 0,
                          borderRight:
                            i < STATS.length - 1
                              ? "1px solid rgba(255,255,255,0.12)"
                              : "none",
                        }),
                  }}
                  className="hero-stat"
                >
                  <span
                    dir={isArabic ? "rtl" : "ltr"}
                    style={{
                      fontSize: "clamp(14px, 1.6vw, 17px)",
                      fontWeight: 800,
                      letterSpacing: "-0.01em",
                      textTransform: "capitalize",
                      color: "#ffffff",
                      lineHeight: 1.2,
                    }}
                  >
                    {label}
                  </span>
                  <span
                    dir={isArabic ? "rtl" : "ltr"}
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.48)",
                      lineHeight: 1.3,
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — booking form card */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }}
            style={{ minWidth: "stretch" }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: 20,
                padding: "28px 26px",
                boxShadow: "0 24px 80px rgba(0,0,0,0.28), 0 4px 16px rgba(0,0,0,0.12)",
              }}
            >
              <h2
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: "#0B1E3D",
                  margin: "0 0 20px",
                }}
              >
                {t("hero.where_are_you_going")}
              </h2>

              <form onSubmit={handleSubmit} noValidate>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {/* Pickup */}
                  {mounted ? (
                    <AddressInput
                      id="pickup-input"
                      placeholder={t("hero.pickup_placeholder")}
                      value={pickup}
                      onChange={(p: TripPoint | null) => setPickup(p)}
                      iconColor="#0B1E3D"
                    />
                  ) : (
                    <InputSkeleton />
                  )}

                  {/* Connector */}
                  <div
                    style={{
                      height: 36,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      position: "relative",
                      paddingRight: 0,
                    }}
                  >
                    {/* Dotted vertical line on the left side (icon column) */}
                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: 24,
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background:
                          "repeating-linear-gradient(to bottom, #d0d8e0 0px, #d0d8e0 4px, transparent 4px, transparent 8px)",
                      }}
                    />
                  </div>

                  {/* Dropoff */}
                  {mounted ? (
                    <AddressInput
                      id="dropoff-input"
                      placeholder={t("hero.dropoff_placeholder")}
                      value={dropoff}
                      onChange={(p: TripPoint | null) => setDropoff(p)}
                      iconColor="#00C2A8"
                    />
                  ) : (
                    <InputSkeleton />
                  )}
                </div>

                {error && (
                  <p
                    role="alert"
                    aria-live="polite"
                    style={{
                      fontSize: 13,
                      color: "#e74c3c",
                      margin: "10px 0 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {error}
                  </p>
                )}

                {authed ? (
                  <button
                    type="submit"
                    style={{
                      marginTop: 16,
                      width: "100%",
                      height: 52,
                      background: "#0B1E3D",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: 15,
                      border: "none",
                      borderRadius: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      fontFamily: "inherit",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#00C2A8"; (e.currentTarget.querySelector("span") as HTMLElement).style.color = "#0B1E3D"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#0B1E3D"; (e.currentTarget.querySelector("span") as HTMLElement).style.color = "#ffffff"; }}
                    onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
                    onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    <span style={{ color: "#ffffff", transition: "color 0.2s" }}>
                      {t("hero.see_prices")}
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                ) : (
                  <Link
                    href="/login?redirect=/create"
                    style={{
                      marginTop: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "100%",
                      height: 46,
                      borderRadius: 12,
                      border: "1.5px solid #E3EBF2",
                      color: "#0B1E3D",
                      background: "#F8FAFC",
                      fontWeight: 700,
                      fontSize: 14,
                      textDecoration: "none",
                    }}
                  >
                    {t("nav.log_in")}
                  </Link>
                )}
              </form>
            </div>
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
          .hero-inner {
            padding: 0 !important;
          }
          .hero-stat {
            border-right: none !important;
            border-left: none !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            flex: none !important;
            min-width: calc(50% - 12px);
          }
          .hero-stats {
            flex-wrap: wrap !important;
            gap: 20px 24px !important;
          }
        }
      `}</style>
    </section>
  );
}
