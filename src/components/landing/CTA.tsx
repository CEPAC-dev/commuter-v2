"use client";
import { motion } from "motion/react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function CTA() {
  return (
    <section
      style={{
        padding: "96px 24px",
        background: "linear-gradient(135deg, #0B1E3D 0%, #1C3557 100%)",
        position: "relative",
        overflow: "hidden",
      }}
      aria-label="Get started"
    >
      {/* Decorative accent */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -80,
          right: -80,
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: "rgba(0,194,168,0.06)",
          pointerEvents: "none",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        style={{
          maxWidth: 640,
          margin: "0 auto",
          textAlign: "center",
          position: "relative",
        }}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#00C2A8",
            margin: "0 0 16px",
          }}
        >
          Ready to ride?
        </p>
        <h2
          style={{
            fontSize: "clamp(30px, 5vw, 50px)",
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "-0.03em",
            margin: "0 0 18px",
            lineHeight: 1.1,
          }}
        >
          Smarter commutes start here.
        </h2>
        <p
          style={{
            fontSize: 17,
            color: "rgba(255,255,255,0.62)",
            margin: "0 0 40px",
            lineHeight: 1.7,
          }}
        >
          Join thousands of Greater Cairo commuters who save time and money every day
          with Commuter.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Link
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 28px",
              background: "#00C2A8",
              color: "#0B1E3D",
              fontWeight: 800,
              fontSize: 15,
              borderRadius: 12,
              textDecoration: "none",
              minHeight: 52,
              transition: "opacity 0.2s, transform 0.1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.88";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "scale(0.97)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            Get started 
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
