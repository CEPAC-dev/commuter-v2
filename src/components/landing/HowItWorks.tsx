"use client";
import { motion } from "motion/react";
import { Car, MapPin, CheckCircle, CreditCard } from "lucide-react";
import { useClientLocale } from "@/lib/locale.client";

export default function HowItWorks() {
  const { t, locale } = useClientLocale();
  const isArabic = locale === "ar";

  const STEPS = [
    {
      icon: Car,
      step: "01",
      label: t("howitworks.step1_label"),
      title: t("howitworks.step1_title"),
      desc: t("howitworks.step1_desc"),
      color: "#F5A623",
      bg: "rgba(245,166,35,0.08)",
    },
    {
      icon: MapPin,
      step: "02",
      label: t("howitworks.step2_label"),
      title: t("howitworks.step2_title"),
      desc: t("howitworks.step2_desc"),
      color: "#00C2A8",
      bg: "rgba(0,194,168,0.08)",
    },
    {
      icon: CheckCircle,
      step: "03",
      label: t("howitworks.step3_label"),
      title: t("howitworks.step3_title"),
      desc: t("howitworks.step3_desc"),
      color: "#0B1E3D",
      bg: "rgba(11,30,61,0.06)",
    },
    {
      icon: CreditCard,
      step: "04",
      label: t("howitworks.step4_label"),
      title: t("howitworks.step4_title"),
      desc: t("howitworks.step4_desc"),
      color: "#1C3557",
      bg: "rgba(28,53,87,0.08)",
    },
  ];
  return (
    <section
      id="how-it-works"
      style={{ padding: "88px 24px", background: "#ffffff" }}
      aria-labelledby="hiw-heading"
    >
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.38 }}
          style={{ textAlign: "center", marginBottom: 48 }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: isArabic ? 0 : "0.14em",
              textTransform: "uppercase",
              color: "#00C2A8",
              margin: "0 0 12px",
            }}
          >
            {t("howitworks.section_label")}
          </p>
          <h2
            id="hiw-heading"
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 800,
              color: "#0B1E3D",
              letterSpacing: isArabic ? 0 : "-0.025em",
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            {t("howitworks.heading")}
          </h2>
        </motion.div>

        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20 }}
          className="hiw-grid"
        >
          {STEPS.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.38, delay: i * 0.1 }}
              className="hiw-card"
              style={{
                padding: "28px 24px 30px",
                borderRadius: 8,
                background: "#f8f9fa",
                border: "1.5px solid #eef0f3",
                boxShadow: "0 8px 24px rgba(11,30,61,0.04)",
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
                  insetInlineEnd: 16,
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
                  borderRadius: 8,
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

              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: s.color,
                    margin: "0 0 6px",
                    letterSpacing: isArabic ? 0 : "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  {s.label}
                </p>
                <h3
                  className="hiw-card-title"
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#0B1E3D",
                    lineHeight: 1.4,
                    margin: "0 0 10px",
                    minHeight: "2.8em",
                  }}
                >
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
          .hiw-card-title { min-height: 0 !important; }
        }
        @media (min-width: 768px) and (max-width: 1199px) {
          .hiw-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </section>
  );
}
