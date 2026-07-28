import AppHeader from "@/components/layout/AppHeader";
import Footer from "@/components/layout/Footer";
import ContactForm from "@/components/contact/ContactForm";
import { getSession } from "@/lib/auth/session";
import { MessageSquare } from "lucide-react";

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
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "rgba(0,194,168,0.1)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <MessageSquare
                size={26}
                style={{ color: "#00C2A8" }}
                aria-hidden="true"
              />
            </div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#00C2A8",
                margin: "0 0 12px",
              }}
            >
              Contact us
            </p>
            <h1
              style={{
                fontSize: "clamp(28px, 4vw, 36px)",
                fontWeight: 800,
                color: "#0B1E3D",
                letterSpacing: "-0.025em",
                margin: "0 0 14px",
              }}
            >
              Send us a message
            </h1>
            <p
              style={{
                fontSize: 16,
                color: "#5A6A7A",
                lineHeight: 1.7,
                margin: 0,
                maxWidth: 480,
                marginInline: "auto",
              }}
            >
              Have a question about your ride, account, or payment? Fill out the
              form below and our team will get back to you as soon as possible.
            </p>
          </div>

          <ContactForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
