export const MAP_PROVIDER_NAME = "OpenStreetMap";
export const ROUTING_PROVIDER_NAME =
  "OSRM public demo server (router.project-osrm.org)";

export function buildLiveSharePrivacyContactParagraph(value?: string): {
  headingKey: "privacy.contact_heading";
  bodyKey: "privacy.contact_body";
  email: string;
} | null {
  const email = value?.trim();
  return email
    ? {
        headingKey: "privacy.contact_heading",
        bodyKey: "privacy.contact_body",
        email,
      }
    : null;
}
