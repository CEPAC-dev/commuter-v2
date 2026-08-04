import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ShieldCheck } from "lucide-react";
import OperationConsole from "@/components/admin/OperationConsole";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";

export default async function AdminOperationPage() {
  const session = await getSession();
  if (!session) redirect("/admin/signup");
  if (session.role !== "admin") redirect("/admin/signup");

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(180deg, #f8f9fa 0%, #eef2f5 100%)",
        padding: "32px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#00C2A8",
              }}
            >
              Admin panel
            </p>
            <h1
              style={{
                margin: "6px 0 0",
                fontSize: "clamp(28px, 4vw, 36px)",
                fontWeight: 800,
                color: "#0B1E3D",
              }}
            >
              Operation tools
            </h1>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <a
              href="/admin/dashboard"
              style={{
                textDecoration: "none",
                padding: "11px 16px",
                borderRadius: 999,
                color: "#0B1E3D",
                fontWeight: 700,
                background: "#ffffff",
                border: "1px solid #e8edf0",
              }}
            >
              Back to dashboard
            </a>
            <AdminLogoutButton />
          </div>
        </div>

        <div
          style={{
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "rgba(0,194,168,0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldCheck size={20} style={{ color: "#00C2A8" }} />
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "#0B1E3D",
              }}
            >
              Admin operations
            </h2>
            <p style={{ margin: "4px 0 0", color: "#5A6A7A", fontSize: 14 }}>
              Run the operational APIs from one place and review their output
              before moving on.
            </p>
          </div>
        </div>

        <OperationConsole />
      </div>
    </main>
  );
}
