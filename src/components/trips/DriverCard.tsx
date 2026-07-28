import { Phone, Car } from "lucide-react";

interface DriverCardData {
  name?: string;
  phone?: string;
  profilePic?: string | null;
  carBrand?: string;
  carModel?: string;
  modelYear?: string;
  plate?: string;
}

function initials(name?: string): string {
  const source = name?.trim() ?? "";
  return source
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function DriverCard({ driver }: { driver: DriverCardData }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #eef0f3",
        padding: "16px 18px",
        marginBottom: 16,
      }}
    >
      <p
        style={{
          margin: "0 0 12px",
          fontSize: 11,
          fontWeight: 700,
          color: "#9aa7b4",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Your driver
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {driver.profilePic ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={driver.profilePic}
            alt={driver.name}
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#0B1E3D",
              color: "#fff",
              fontWeight: 800,
              fontSize: 18,
            }}
            aria-hidden="true"
          >
            {initials(driver.name) || "D"}
          </div>
        )}

        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 800,
              color: "#0B1E3D",
            }}
          >
            {driver.name ?? "Driver"}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#5A6A7A" }}>
            {driver.phone ?? "No phone on file"}
          </p>
        </div>

        <a
          href={`tel:${driver.phone}`}
          aria-label={`Call ${driver.name}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            background: "linear-gradient(135deg, #00C2A8 0%, #00A896 100%)",
            color: "#fff",
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(0,194,168,0.25)",
          }}
        >
          <Phone size={16} aria-hidden="true" />
          Call
        </a>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px solid #F1F5F9",
        }}
      >
        <Car size={18} color="#0B1E3D" style={{ flexShrink: 0 }} aria-hidden="true" />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0B1E3D" }}>
            {(driver.carBrand ?? "") + (driver.carBrand && driver.carModel ? " " : "") + (driver.carModel ?? "") || "Vehicle details pending"}
            {driver.modelYear ? ` · ${driver.modelYear}` : ""}
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 13,
              color: "#5A6A7A",
              letterSpacing: "0.06em",
              fontWeight: 600,
            }}
          >
            {driver.plate ?? "Plate pending"}
          </p>
        </div>
      </div>
    </div>
  );
}
