import AppHeader from "@/components/layout/AppHeader";
import Footer from "@/components/layout/Footer";
import FAQContent from "@/components/faq/FAQContent";
import { getSession } from "@/lib/auth/session";

export default async function FAQPage() {
  const session = await getSession();

  return (
    <>
      <AppHeader authed={!!session} email={session?.email} variant="app" />
      <main
        style={{
          minHeight: "calc(100dvh - 60px)",
          background: "#f8f9fa",
          padding: "48px 24px 80px",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <FAQContent />
        </div>
      </main>
      <Footer />
    </>
  );
}
