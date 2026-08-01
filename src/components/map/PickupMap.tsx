// @ts-nocheck
"use client";

import dynamic from "next/dynamic";
import type { PickupPoint } from "@/types/driver";

const PickupMapInner = dynamic(() => import("./PickupMapInnerOsm"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "100%",
        background: "#EFF7F6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#5A6A7A",
        fontSize: 14,
      }}
    >
      Loading map…
    </div>
  ),
});

interface PickupMapProps {
  pickupPoints: PickupPoint[];
  destination: { lat: number; lng: number; label: string };
  height?: number;
}

export default function PickupMap({
  pickupPoints,
  destination,
  height = 320,
}: PickupMapProps) {
  return (
    <div
      style={{
        height,
        borderRadius: 10,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <PickupMapInner
        pickupPoints={pickupPoints}
        destination={destination}
        height={height}
      />
    </div>
  );
}
