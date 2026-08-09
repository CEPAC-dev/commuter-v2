import AppHeader from "@/components/layout/AppHeader";
import Footer from "@/components/layout/Footer";
import ContactForm from "@/components/contact/ContactForm";
import ContactHeader from "@/components/contact/ContactHeader";
import { getSession } from "@/lib/auth/session";

export default async function ContactPage() {
  const session = await getSession();

  return (
    <>
      <AppHeader authed={!!session} email={session?.email} variant="app" />
      <main
        style={{
          minHeight: "calc(100dvh - 60px)",
          background:
            "linear-gradient(180deg, #f8f9fa 0%, #eef2f5 50%, #f8f9fa 100%)",
          padding: "48px 24px 80px",
        }}
      >
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <ContactHeader />
          <ContactForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
