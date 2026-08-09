import type { Metadata } from "next";
import "./globals.css";
import { getServerLocale } from "@/lib/i18n/server";
import { localeDirection } from "@/lib/i18n/config";

export const metadata: Metadata = {
  title: "Commuter — Cairo Ride Booking",
  description:
    "Book affordable private and shared rides across Greater Cairo, Egypt.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getServerLocale();
  return (
    <html lang={locale} dir={localeDirection(locale)}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
