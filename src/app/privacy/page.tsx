import type { Metadata } from "next";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";
import { localeDirection } from "@/lib/i18n/config";
import {
  buildLiveSharePrivacyContactParagraph,
  MAP_PROVIDER_NAME,
  ROUTING_PROVIDER_NAME,
} from "@/lib/legal/liveSharePrivacy";

export const metadata: Metadata = {
  title: "Privacy notice: live location sharing",
};

const PRIVACY_SECTIONS = [
  ["privacy.collect_heading", "privacy.collect_body"],
  ["privacy.visibility_heading", "privacy.visibility_body"],
  ["privacy.retention_heading", "privacy.retention_body"],
  ["privacy.providers_heading", "privacy.providers_body"],
  ["privacy.choices_heading", "privacy.choices_body"],
] as const;

export default async function LiveSharePrivacyPage() {
  const locale = await getServerLocale();
  const contact = buildLiveSharePrivacyContactParagraph(
    process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL,
  );
  const params = { MAP_PROVIDER_NAME, ROUTING_PROVIDER_NAME };

  return (
    <main
      lang={locale}
      dir={localeDirection(locale)}
      style={{
        minHeight: "100dvh",
        padding: "clamp(24px, 6vw, 64px) 20px",
        background: "#F7F8FA",
        color: "#0B1E3D",
      }}
    >
      <article
        style={{
          width: "min(100%, 760px)",
          margin: "0 auto",
          padding: "clamp(22px, 5vw, 40px)",
          border: "1px solid #EAECEF",
          borderRadius: 14,
          background: "#FFFFFF",
        }}
      >
        <h1 style={{ margin: "0 0 28px", fontSize: "clamp(26px, 5vw, 34px)" }}>
          {translate(locale, "privacy.title")}
        </h1>
        <div style={{ display: "grid", gap: 22 }}>
          {PRIVACY_SECTIONS.map(([headingKey, bodyKey]) => (
            <section key={headingKey}>
              <h2 style={{ margin: "0 0 7px", fontSize: 18 }}>
                {translate(locale, headingKey)}
              </h2>
              <p style={{ margin: 0, lineHeight: 1.7, color: "#425466" }}>
                {translate(locale, bodyKey, params)}
              </p>
            </section>
          ))}
          {contact && (
            <section>
              <h2 style={{ margin: "0 0 7px", fontSize: 18 }}>
                {translate(locale, contact.headingKey)}
              </h2>
              <p style={{ margin: 0, lineHeight: 1.7, color: "#425466" }}>
                {translate(locale, contact.bodyKey, { email: contact.email })}
              </p>
            </section>
          )}
        </div>
      </article>
    </main>
  );
}
