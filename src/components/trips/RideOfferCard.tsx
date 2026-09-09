"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin, Route, X } from "lucide-react";
import { useClientLocale } from "@/lib/locale.client";
import { formatDate, formatDistanceKm, formatEgp, formatTime } from "@/lib/i18n";

type Stop = { point?: { address?: string; lat?: number; lng?: number }; boardingNumber?: number; alightingNumber?: number };
type RideOffer = { _id: string; date: string; startTime: string; endTime: string; totalCost: number; route?: Stop[]; passengers?: { numberOfPassengers?: number }[] };

function routeDistanceKm(route: Stop[] | undefined): number | null {
  if (!route || route.length < 2) return null;

  let totalKm = 0;
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1].point;
    const current = route[index].point;
    if (
      typeof previous?.lat !== "number" ||
      typeof previous.lng !== "number" ||
      typeof current?.lat !== "number" ||
      typeof current.lng !== "number"
    ) {
      return null;
    }
    const latitudeRadians = ((current.lat - previous.lat) * Math.PI) / 180;
    const longitudeRadians = ((current.lng - previous.lng) * Math.PI) / 180;
    const a =
      Math.sin(latitudeRadians / 2) ** 2 +
      Math.cos((previous.lat * Math.PI) / 180) *
        Math.cos((current.lat * Math.PI) / 180) *
        Math.sin(longitudeRadians / 2) ** 2;
    totalKm += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return totalKm;
}

export default function RideOfferCard({ ride }: { ride: RideOffer }) {
  const router = useRouter();
  const { locale, dir, t } = useClientLocale();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const first = ride.route?.[0]?.point?.address ?? t("ride_requests.first_pickup");
  const last = ride.route?.at(-1)?.point?.address ?? t("ride_requests.final_destination");
  const stops = ride.route?.length ?? 0;
  const passengers = ride.passengers?.reduce((sum, item) => sum + (item.numberOfPassengers ?? 1), 0) ?? 0;
  const distanceKm = routeDistanceKm(ride.route);

  async function respond(action: "accept" | "reject") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/driver/rides/${ride._id}/${action}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? t("ride_requests.unavailable"));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("ride_requests.unavailable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article dir={dir} className="flex h-full flex-col rounded-2xl border border-[#d9eee9] bg-white p-5 text-start shadow-[0_10px_30px_rgba(11,30,61,0.08)] lg:p-6">
      <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#00a990]">{t("ride_requests.new_ride")}</p><h3 className="mt-1 font-bold text-[#0B1E3D]">{formatDate(locale, ride.date)} · {formatTime(locale, ride.startTime)}</h3></div><span className="shrink-0 rounded-full bg-[#e2f8f4] px-3 py-1 text-sm font-extrabold text-[#008c7b]">{formatEgp(locale, ride.totalCost)}</span></div>
      <div className="grid gap-3 text-sm font-semibold text-[#0B1E3D]"><div className="flex min-w-0 items-center gap-3"><MapPin className="shrink-0 text-[#00c2a8]" size={18} /><span className="truncate">{first}</span></div><div className="flex min-w-0 items-center gap-3 lg:ps-[30px]">{dir === "rtl" ? <ArrowLeft className="shrink-0 text-[#93a0ad]" size={16} /> : <ArrowRight className="shrink-0 text-[#93a0ad]" size={16} />}<span className="truncate">{last}</span></div></div>
      <div className="grid gap-3 text-sm font-semibold text-[#0B1E3D]"><div className="flex min-w-0 items-center gap-3"><MapPin className="shrink-0 text-[#00c2a8]" size={18} /><span className="truncate">{first}</span></div><div className="flex min-w-0 items-center gap-3 lg:pl-[30px]"><ArrowRight className="shrink-0 text-[#93a0ad]" size={16} /><span className="truncate">{last}</span></div></div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#edf1f4] pt-5 text-center text-xs text-[#5A6A7A] sm:grid-cols-4"><span><strong className="block text-sm text-[#0B1E3D]">{stops}</strong>{t("ride_requests.stops")}</span><span><strong className="block text-sm text-[#0B1E3D]">{formatTime(locale, ride.endTime)}</strong>{t("ride_requests.end_time")}</span><span><strong className="block text-sm text-[#0B1E3D]">{passengers || "—"}</strong>{t("ride_requests.passengers")}</span><span><strong className="flex items-center justify-center gap-1 text-sm text-[#0B1E3D]"><Route size={15} />{distanceKm === null ? "—" : formatDistanceKm(locale, distanceKm)}</strong>{t("ride_requests.total_distance")}</span></div>
      {message && <p className="mt-4 rounded-lg bg-[#ffebee] px-3 py-2 text-sm text-[#c0392b]">{message}</p>}
      <div className="mt-6 flex gap-3 lg:mt-auto lg:pt-6"><button type="button" disabled={busy} onClick={() => void respond("reject")} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#e74c3c] px-4 py-3 text-sm font-bold text-[#e74c3c] disabled:opacity-50"><X size={16} /> {t("ride_requests.reject")}</button><button type="button" disabled={busy} onClick={() => void respond("accept")} className="inline-flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-[#00c2a8] px-4 py-3 text-sm font-extrabold text-[#0B1E3D] shadow-md disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} {t("ride_requests.accept")}</button></div>
    </article>
  );
}
