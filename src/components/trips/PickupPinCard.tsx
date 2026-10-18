"use client";

import { useEffect, useState } from "react";
import { useClientLocale } from "@/lib/i18n/client";

type PickupPinData = {
  pin: string;
  passengerNumber: number;
};

export default function PickupPinCard({ tripId }: { tripId: string }) {
  const { t } = useClientLocale();
  const [data, setData] = useState<PickupPinData | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/trips/${encodeURIComponent(tripId)}/pickup-pin`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const result: unknown = await response.json();
        if (
          !result ||
          typeof result !== "object" ||
          !("pin" in result) ||
          typeof result.pin !== "string" ||
          !/^\d{4}$/.test(result.pin) ||
          !("passengerNumber" in result) ||
          typeof result.passengerNumber !== "number"
        ) {
          return null;
        }
        return {
          pin: result.pin,
          passengerNumber: result.passengerNumber,
        };
      })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setData(null);
      });

    return () => controller.abort();
  }, [tripId]);

  if (!data) return null;

  return (
    <section
      aria-labelledby="pickup-pin-title"
      className="rounded-xl border border-teal-200 bg-teal-50 p-5 text-center"
    >
      <h2 id="pickup-pin-title" className="m-0 text-sm font-bold text-slate-800">
        {t("pickup_pin.title", { n: data.passengerNumber })}
      </h2>
      <p
        aria-label={t("pickup_pin.title", { n: data.passengerNumber })}
        className="my-3 text-4xl font-black tracking-[0.3em] text-slate-900"
        dir="ltr"
      >
        {data.pin}
      </p>
      <p className="m-0 text-sm font-medium text-slate-700">
        {t("pickup_pin.share_instruction")}
      </p>
    </section>
  );
}
