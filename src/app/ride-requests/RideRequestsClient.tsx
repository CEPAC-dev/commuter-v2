"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import EmptyState from "@/components/shared/EmptyState";
import RideOfferCard from "@/components/trips/RideOfferCard";
import { useClientLocale } from "@/lib/locale.client";

type RideOffer = {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  totalCost: number;
  route?: {
    point?: { address?: string; lat?: number; lng?: number };
    boardingNumber?: number;
    alightingNumber?: number;
  }[];
  passengers?: { numberOfPassengers?: number }[];
};

async function requestOffers(): Promise<RideOffer[]> {
  const response = await fetch("/api/driver/rides", { cache: "no-store" });
  const data = (await response.json()) as {
    offers?: RideOffer[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? "Unable to load ride requests.");
  }
  return data.offers ?? [];
}

export default function RideRequestsClient({ email }: { email: string }) {
  const { dir, t } = useClientLocale();
  const [offers, setOffers] = useState<RideOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOffers(await requestOffers());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : t("ride_requests.unavailable"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let active = true;
    requestOffers()
      .then((nextOffers) => {
        if (active) setOffers(nextOffers);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : t("ride_requests.unavailable"),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  return (
    <div dir={dir} className="min-h-screen bg-[#f8f9fa]">
      <AppHeader
        authed
        email={email}
        role="driver"
        variant="app"
        backHref="/my-trips"
      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <header
          className={`mb-7 flex items-start justify-between gap-4 sm:items-end ${
            dir === "rtl" ? "flex-row-reverse" : ""
          }`}
        >
          <div className="text-start">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#00a990]">
              {t("ride_requests.driver_portal")}
            </p>
            <h1 className="text-3xl font-extrabold text-[#0B1E3D]">
              {t("ride_requests.title")}
            </h1>
            <p className="mt-2 text-sm text-[#5A6A7A]">
              {t("ride_requests.description")}
            </p>
          </div>
          {offers.length > 0 ? (
            <span className="rounded-full bg-[#e2f8f4] px-3 py-1 text-sm font-extrabold text-[#008c7b]">
              {offers.length}
            </span>
          ) : null}
        </header>

        {loading ? (
          <p role="status" className="py-12 text-center text-sm text-[#5A6A7A]">
            Loading ride requests...
          </p>
        ) : error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700"
          >
            {error}
          </p>
        ) : offers.length === 0 ? (
          <EmptyState
            icon={<Inbox size={44} />}
            title={t("ride_requests.empty_title")}
            description={t("ride_requests.empty_description")}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {offers.map((ride) => (
              <RideOfferCard
                key={ride._id}
                ride={ride}
                onResponse={() => void loadOffers()}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
