import type { Metadata } from "next";
import LiveLocationViewer from "@/components/live/LiveLocationViewer";
import { getServerLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Live trip location" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function LiveTripPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [{ token }, locale] = await Promise.all([params, getServerLocale()]);
  return <LiveLocationViewer key={token} token={token} initialLocale={locale} />;
}
