import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "Read the terms for booking private and shared Commuter rides in Greater Cairo.",
  alternates: { canonical: "/terms" },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
