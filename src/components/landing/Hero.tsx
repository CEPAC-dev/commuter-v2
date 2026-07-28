"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowUpDown, ChevronRight } from "lucide-react";
import { useTripStore } from "@/lib/store/useTripStore";
import type { TripPoint } from "@/lib/store/useTripStore";
import AddressInput from "./AddressInput";

interface Props {
  authed?: boolean;
}

const STATS = [
  { label: "types available", value: "4 vehicles" },
  { label: "fully covered", value: "Greater Cairo" },
  { label: "from", value: "4 EGP" },
] as const;

export default function Hero({ authed = false }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { pickup, dropoff, setPickup, setDropoff, swap } = useTripStore();
  const [error, setError] = useState("");

  // Prevent sessionStorage hydration mismatch
  useEffect(() => { setMounted(true); }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pickup || !dropoff) {
      setError("Please enter both pickup and dropoff locations.");
      return;
    }
    setError("");
    router.push("/create");
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
            gridTemplateColumns: "1fr 1fr",
            gap: 64,
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
              Greater Cairo&apos;s smartest commute
            </p>
            <h1
              style={{
                fontSize: "clamp(38px, 5vw, 62px)",
                fontWeight: 900,
                color: "#ffffff",
                lineHeight: 1.08,
                letterSpacing: "-0.035em",
                margin: "0 0 22px",
              }}
            >
              Go anywhere,{" "}
              <span style={{ color: "#00C2A8" }}>on your terms.</span>
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
              Book private or shared rides across Greater Cairo — affordable,
              reliable, and timed precisely to your schedule.
            </p>

            {/* Stats */}
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 0,
                marginTop: 40,
                flexWrap: "wrap",
              }}
              className="hero-stats"
            >
              {STATS.map(({ label, value }, i) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 6,
                    paddingRight: i < STATS.length - 1 ? 28 : 0,
                    marginRight: i < STATS.length - 1 ? 28 : 0,
                    borderRight:
                      i < STATS.length - 1
                        ? "1px solid rgba(255,255,255,0.12)"
                        : "none",
                  }}
                  className="hero-stat"
                >
                  <span
                    style={{
                      fontSize: "clamp(15px, 2.2vw, 20px)",
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
                Where are you going?
              </h2>

              <form onSubmit={handleSubmit} noValidate>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {/* Pickup */}
                  {mounted ? (
                    <AddressInput
                      id="pickup-input"
                      placeholder="Pickup location"
                      value={pickup}
                      onChange={(p: TripPoint | null) => setPickup(p)}
                      iconColor="#0B1E3D"
                    />
                  ) : (
                    <InputSkeleton />
                  )}

                  {/* Connector + swap */}
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
                    <button
                      type="button"
                      onClick={swap}
                      aria-label="Swap pickup and dropoff locations"
                      style={{
                        background: "#ffffff",
                        border: "1.5px solid #e8edf0",
                        borderRadius: 8,
                        width: 36,
                        height: 36,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "#5A6A7A",
                        transition: "border-color 0.15s, color 0.15s",
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#00C2A8";
                        e.currentTarget.style.color = "#00C2A8";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e8edf0";
                        e.currentTarget.style.color = "#5A6A7A";
                      }}
                    >
                      <ArrowUpDown size={15} />
                    </button>
                  </div>

                  {/* Dropoff */}
                  {mounted ? (
                    <AddressInput
                      id="dropoff-input"
                      placeholder="Dropoff location"
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
                    {authed ? "See Prices" : "Log In & See Prices"}
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
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
            margin-right: 0 !important;
            padding-right: 0 !important;
            min-width: calc(50% - 12px);
          }
          .hero-stats {
            gap: 20px 24px !important;
          }
        }
      `}</style>
    </section>
  );
}
