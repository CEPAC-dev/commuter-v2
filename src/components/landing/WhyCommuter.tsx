"use client";
import { motion } from "motion/react";
import { Clock, Shield, MapPinned, Wallet } from "lucide-react";

const FEATURES = [
  {
    icon: Clock,
    title: "Timed to your schedule",
    desc: "Set your arrival time — we compute the pickup so you never miss a meeting or flight.",
    color: "#00C2A8",
    bg: "rgba(0,194,168,0.08)",
  },
  {
    icon: MapPinned,
    title: "Greater Cairo coverage",
    desc: "From Maadi to 6th of October — smart routing across the entire metropolitan area.",
    color: "#F5A623",
    bg: "rgba(245,166,35,0.08)",
  },
  {
    icon: Shield,
    title: "Private or shared",
    desc: "Choose a private car for comfort or a shared ride to save — four vehicle types to fit every trip.",
    color: "#0B1E3D",
    bg: "rgba(11,30,61,0.06)",
  },
  {
    icon: Wallet,
    title: "Transparent pricing",
    desc: "See your fare before you book. No surge, no surprises — pay securely when you confirm.",
    color: "#1C3557",
    bg: "rgba(28,53,87,0.07)",
  },
];

export default function WhyCommuter() {
  return (
    <section
      id="why-commuter"
      style={{ padding: "96px 24px", background: "#f8f9fa" }}
      aria-labelledby="why-heading"
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
            Why Commuter
          </p>
          <h2
            id="why-heading"
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 800,
              color: "#0B1E3D",
              letterSpacing: "-0.025em",
              margin: 0,
            }}
          >
            Built for daily commutes
          </h2>
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 22,
          }}
          className="why-grid"
        >
          {FEATURES.map((f, i) => (
            <motion.article
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.07 }}
              style={{
                background: "#ffffff",
                borderRadius: 16,
                padding: "28px 26px",
                border: "1.5px solid #eef0f3",
                display: "flex",
                gap: 18,
                alignItems: "flex-start",
                boxShadow: "0 2px 8px rgba(11,30,61,0.04)",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 13,
                  background: f.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <f.icon size={22} style={{ color: f.color }} aria-hidden="true" />
              </div>
              <div>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#0B1E3D",
                    margin: "0 0 8px",
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: "#5A6A7A",
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  {f.desc}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .why-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
