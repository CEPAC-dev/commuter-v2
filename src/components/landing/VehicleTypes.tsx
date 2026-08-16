"use client";
import { motion } from "motion/react";
import { Car, CarFront, Users, Truck, Bus } from "lucide-react";
import { VEHICLE_LIST } from "@/lib/config/vehicles";
import { DEFAULT_REGION, vehiclesForRegion } from "@/lib/config/regions";
import type { VehicleKey } from "@/lib/config/vehicles";

const ICONS: Record<
  VehicleKey,
  React.ComponentType<{
    size?: number;
    style?: React.CSSProperties;
    "aria-hidden"?: boolean;
  }>
> = {
  private_car: Car,
  taxi_private: CarFront,
  taxi_shared: Users,
  shared_car: Users,
  van_shared: Truck,
  microbus_shared: Bus,
};

const PALETTE: Record<VehicleKey, { color: string; bg: string }> = {
  private_car: { color: "#0B1E3D", bg: "rgba(11,30,61,0.07)" },
  taxi_private: { color: "#1C3557", bg: "rgba(28,53,87,0.07)" },
  taxi_shared: { color: "#00C2A8", bg: "rgba(0,194,168,0.09)" },
  shared_car: { color: "#00A38F", bg: "rgba(0,163,143,0.09)" },
  van_shared: { color: "#F5A623", bg: "rgba(245,166,35,0.10)" },
  microbus_shared: { color: "#5A6A7A", bg: "rgba(90,106,122,0.08)" },
};

export default function VehicleTypes() {
  return (
    <section
      id="vehicles"
      style={{ padding: "96px 24px", background: "#f8f9fa" }}
      aria-labelledby="vehicles-heading"
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
            Pricing
          </p>
          <h2
            id="vehicles-heading"
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 800,
              color: "#0B1E3D",
              letterSpacing: "-0.025em",
              margin: "0 0 12px",
            }}
          >
            Find the right ride
          </h2>
          {/* <p style={{ fontSize: 16, color: "#5A6A7A", margin: 0 }}>
            Transparent per-km pricing. Minimum fare {MIN_FARE} EGP on every
            ride.
          </p> */}
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 22,
          }}
          className="vehicles-grid"
        >
          {vehiclesForRegion(VEHICLE_LIST, DEFAULT_REGION).map((v, i) => {
            const Icon = ICONS[v.key];
            const { color, bg } = PALETTE[v.key];
            return (
              <motion.article
                key={v.key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.07 }}
                whileHover={{
                  y: -5,
                  boxShadow: "0 16px 48px rgba(11,30,61,0.11)",
                }}
                style={{
                  background: "#ffffff",
                  borderRadius: 16,
                  padding: "26px 22px",
                  border: "1.5px solid #eef0f3",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  boxShadow: "0 2px 8px rgba(11,30,61,0.04)",
                  transition: "box-shadow 0.2s",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 13,
                    background: bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={22} style={{ color }} aria-hidden={true} />
                </div>

                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#0B1E3D",
                      margin: "0 0 4px",
                      lineHeight: 1.3,
                    }}
                  >
                    {v.label}
                  </h3>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#5A6A7A",
                      margin: "0 0 14px",
                      textTransform: "capitalize",
                      fontWeight: 500,
                    }}
                  >
                    {v.ride} ride
                  </p>

                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "baseline",
                      gap: 3,
                      background: bg,
                      borderRadius: 8,
                      padding: "5px 11px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 22,
                        fontWeight: 900,
                        color,
                        fontVariantNumeric: "tabular-nums",
                        lineHeight: 1,
                      }}
                    >
                      {v.rate}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color,
                        opacity: 0.75,
                      }}
                    >
                      EGP / km
                    </span>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>

      <style>{`
        @media (max-width: 479px) {
          .vehicles-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 480px) and (max-width: 767px) {
          .vehicles-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .vehicles-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </section>
  );
}
