import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";
import { localeDirection } from "@/lib/i18n/config";
import { listDriverRideOffers } from "@/lib/services/rideService";
import AppHeader from "@/components/layout/AppHeader";
import EmptyState from "@/components/shared/EmptyState";
import RideOfferCard from "@/components/trips/RideOfferCard";

export const metadata = { title: "Ride requests - Commuter" };
export const dynamic = "force-dynamic";

export default async function RideRequestsPage() {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/ride-requests");
  if (session.role === "admin") redirect("/admin/dashboard");
  if (session.role !== "driver") redirect("/my-trips");

  await connectDB();
  const offers = await listDriverRideOffers(session.userId);
  const locale = await getServerLocale();
  const dir = localeDirection(locale);
  const t = (key: string) => translate(locale, key);

  return (
    <div dir={dir} className="min-h-screen bg-[#f8f9fa]">
      <AppHeader
        authed
        email={session.email}
        role="driver"
        variant="app"
        backHref="/my-trips"
      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <header className={`mb-7 flex items-start justify-between gap-4 sm:items-end ${dir === "rtl" ? "flex-row-reverse" : ""}`}>
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

        {offers.length === 0 ? (
          <EmptyState
            icon={<Inbox size={44} />}
            title={t("ride_requests.empty_title")}
            description={t("ride_requests.empty_description")}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {offers.map((ride) => (
              <RideOfferCard
                key={String(ride._id)}
                ride={JSON.parse(JSON.stringify(ride))}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
