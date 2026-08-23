"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { useClientLocale } from "@/lib/locale.client";

export default function FAQContent() {
  const { t } = useClientLocale();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const FAQ_ITEMS = Array.from({ length: 17 }, (_, index) => {
    const faqNumber = index + 1;

    return {
      q: t(`faq.q${faqNumber}`),
      a: t(`faq.a${faqNumber}`),
    };
  });

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
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
          {t("faq.section_label")}
        </p>
        <h1
          style={{
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 800,
            color: "#0B1E3D",
            letterSpacing: "-0.025em",
            margin: "0 0 16px",
          }}
        >
          {t("faq.heading")}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "#5A6A7A",
            lineHeight: 1.7,
            margin: "0 0 40px",
            maxWidth: 560,
          }}
        >
          {t("faq.description")}
        </p>
      </motion.div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {FAQ_ITEMS.map(({ q, a }, i) => {
          const open = openIndex === i;
          return (
            <motion.article
              key={q}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.38, delay: i * 0.07 }}
              style={{
                background: "#ffffff",
                borderRadius: 14,
                border: `1.5px solid ${open ? "rgba(0,194,168,0.35)" : "#eef0f3"}`,
                overflow: "hidden",
                boxShadow: open
                  ? "0 8px 32px rgba(0,194,168,0.08)"
                  : "0 2px 8px rgba(11,30,61,0.03)",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : i)}
                aria-expanded={open}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "20px 22px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: open
                      ? "rgba(0,194,168,0.12)"
                      : "rgba(11,30,61,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "background 0.2s",
                  }}
                >
                  <HelpCircle
                    size={18}
                    style={{ color: open ? "#00C2A8" : "#5A6A7A" }}
                    aria-hidden="true"
                  />
                </div>
                <span
                  style={{
                    flex: 1,
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#0B1E3D",
                    lineHeight: 1.35,
                  }}
                >
                  {q}
                </span>
                <ChevronDown
                  size={20}
                  aria-hidden="true"
                  style={{
                    color: "#5A6A7A",
                    flexShrink: 0,
                    transform: open ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.25s ease",
                  }}
                />
              </button>

              <div
                style={{
                  display: "grid",
                  gridTemplateRows: open ? "1fr" : "0fr",
                  transition: "grid-template-rows 0.28s ease",
                }}
              >
                <div style={{ overflow: "hidden" }}>
                  <motion.p
                    initial={false}
                    animate={{ opacity: open ? 1 : 0 }}
                    transition={{ duration: 0.22 }}
                    style={{
                      fontSize: 14,
                      color: "#5A6A7A",
                      lineHeight: 1.7,
                      margin: 0,
                      padding: open ? "0 22px 22px 72px" : "0 22px 0 72px",
                    }}
                  >
                    {a}
                  </motion.p>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </>
  );
}
