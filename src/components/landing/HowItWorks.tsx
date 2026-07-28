"use client";
import { motion } from "motion/react";
import { Car, MapPin, CheckCircle } from "lucide-react";

const STEPS = [
  {
    icon: Car,
    step: "01",
    title: "Choose your ride",
    desc: "Pick from private cars, taxis, or shared vans — each with transparent pricing.",
    color: "#F5A623",
    bg: "rgba(245,166,35,0.08)",
  },
  {
    icon: MapPin,
    step: "02",
    title: "Enter your trip details",
    desc: "Enter pickup and dropoff, set your time, add stop points, or pick the nearest station.",
    color: "#00C2A8",
    bg: "rgba(0,194,168,0.08)",
  },
  {
    icon: CheckCircle,
    step: "03",
    title: "Confirm & go",
    desc: "Review your pickup time, pay securely, and you're set.",
    color: "#0B1E3D",
    bg: "rgba(11,30,61,0.06)",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      style={{ padding: "96px 24px", background: "#ffffff" }}
      aria-labelledby="hiw-heading"
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.38 }}
          style={{ textAlign: "center", marginBottom: 64 }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#00C2A8",
              margin: "0 0 12px",
            }}
          >
            How it works
          </p>
          <h2
            id="hiw-heading"
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 800,
              color: "#0B1E3D",
              letterSpacing: "-0.025em",
              margin: 0,
            }}
          >
            Three steps to your ride
          </h2>
        </motion.div>

        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}
          className="hiw-grid"
        >
          {STEPS.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.38, delay: i * 0.1 }}
              style={{
                padding: "32px 28px",
                borderRadius: 18,
                background: "#f8f9fa",
                border: "1.5px solid #eef0f3",
                display: "flex",
                flexDirection: "column",
                gap: 18,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Step number background watermark */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: -10,
                  right: 16,
                  fontSize: 80,
                  fontWeight: 900,
                  color: s.bg,
                  lineHeight: 1,
                  userSelect: "none",
                  pointerEvents: "none",
                  filter: "blur(0.5px)",
                }}
              >
                {s.step}
              </div>

              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: s.bg,
                  border: `1.5px solid ${s.color}22`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <s.icon size={24} style={{ color: s.color }} aria-hidden="true" />
              </div>

              <div>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: s.color,
                    margin: "0 0 6px",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  Step {i + 1}
                </p>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0B1E3D", margin: "0 0 10px" }}>
                  {s.title}
                </h3>
                <p style={{ fontSize: 15, color: "#5A6A7A", lineHeight: 1.68, margin: 0 }}>
                  {s.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .hiw-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .hiw-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </section>
  );
}
