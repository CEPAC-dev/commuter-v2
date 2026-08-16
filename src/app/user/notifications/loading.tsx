import { translate } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n/server";

export default async function Loading() {
  const locale = await getServerLocale();

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#f8f9fa",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div style={{ color: "#0B1E3D", fontWeight: 700 }}>
        {translate(locale, "notifications.loading")}
      </div>
    </div>
  );
}
