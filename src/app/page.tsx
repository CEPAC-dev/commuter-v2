import { redirect } from "next/navigation";
import AppHeader from "@/components/layout/AppHeader";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import WhyCommuter from "@/components/landing/WhyCommuter";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/layout/Footer";
import { getSession } from "@/lib/auth/session";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    ref?: string | string[];
    refRole?: string | string[];
  }>;
}) {
  const session = await getSession();
  if (session?.role === "admin") redirect("/admin/dashboard");
  if (session?.role === "driver") redirect("/my-trips");
  const params = await searchParams;
  const referralCode = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  const referralRoleValue = Array.isArray(params.refRole)
    ? params.refRole[0]
    : params.refRole;
  const referralRole =
    referralRoleValue === "driver" ? "driver" : "passenger";

  if (!session && referralCode?.trim()) {
    const loginParams = new URLSearchParams({
      redirect: "/create",
      ref: referralCode.trim().toUpperCase(),
      refRole: referralRole,
    });
    redirect(`/login?${loginParams.toString()}`);
  }

  return (
    <>
      <AppHeader authed={!!session} email={session?.email} variant="landing" />
      <main>
        <Hero
          authed={!!session}
          referralCode={referralCode}
          referralRole={referralRole}
        />
        <HowItWorks />
        <WhyCommuter />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
