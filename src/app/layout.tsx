import type { Metadata } from "next";
import "./globals.css";
import { getServerLocale } from "@/lib/i18n/server";
import { localeDirection } from "@/lib/i18n/config";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Commuter | Book rides across Greater Cairo",
    template: "%s | Commuter",
  },
  description:
    "Book affordable private and shared rides across Greater Cairo, Egypt. Plan your trip, choose your vehicle, and travel with confidence.",
  applicationName: "Commuter",
  keywords: [
    "Cairo ride booking",
    "Greater Cairo transportation",
    "private car Cairo",
    "shared rides Cairo",
    "Cairo taxi booking",
    "Egypt transport",
  ],
  alternates: { canonical: "/" },
  icons: {
    icon: "/assets/images/commuterLogo.png",
    apple: "/assets/images/commuterLogo.png",
  },
  openGraph: {
    type: "website",
    siteName: "Commuter",
    title: "Commuter | Book rides across Greater Cairo",
    description:
      "Book affordable private and shared rides across Greater Cairo, Egypt.",
    url: "/",
    images: [
      {
        url: "/assets/images/commuterLogo3.png",
        alt: "Commuter ride booking",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Commuter | Book rides across Greater Cairo",
    description:
      "Book affordable private and shared rides across Greater Cairo, Egypt.",
    images: ["/assets/images/commuterLogo3.png"],
  },
  robots: { index: true, follow: true },
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
