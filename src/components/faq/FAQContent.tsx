"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ChevronDown, HelpCircle } from "lucide-react";

const FAQ_ITEMS = [
  {
    q: "How do I book a ride?",
    a: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Enter your pickup and dropoff, choose a vehicle, set your arrival time, and confirm your booking.",
  },
  {
    q: "What payment methods are accepted?",
    a: "Lorem ipsum dolor sit amet. We accept credit cards and mobile wallets through our secure payment partner. Your fare is calculated server-side before checkout.",
  },
  {
    q: "Can I book multiple trips for the same day?",
    a: "Lorem ipsum dolor sit amet, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Yes — add as many trips as you need on a single date before submitting.",
  },
  {
    q: "What areas do you cover?",
    a: "Lorem ipsum dolor sit amet. Commuter covers all of Greater Cairo including Giza, Helwan, New Cairo, and 6th of October City.",
  },
  {
    q: "How is my pickup time calculated?",
    a: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Your pickup time is computed from your arrival time minus the route duration and a vehicle-specific buffer.",
  },
  {
    q: "Can I cancel or modify a booking?",
    a: "Lorem ipsum dolor sit amet. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  },
];

export default function FAQContent() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

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
          FAQ
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
          Frequently asked questions
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
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Find answers
          to common questions about booking, pricing, and payments.
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
