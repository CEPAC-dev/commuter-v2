import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { TripReport } from "@/models/TripReport";
import { translate } from "@/lib/i18n";
import { Clock, AlertCircle, CheckCircle } from "lucide-react";

export default async function TripReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) return redirect("/login");
  if (session.role !== "admin") return redirect("/");

  const PAGE_SIZE = 20;
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10));

  await connectDB();
  const total = await TripReport.countDocuments();
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const reports = await TripReport.find()
    .populate({
      path: "tripId",
      select: "tripNumber pickupAddress dropoffAddress date pickupTime priceEgp vehicleType",
    })
    .populate({ path: "userId", select: "name email phone" })
    .sort({ createdAt: -1 })
    .limit(PAGE_SIZE)
    .skip((currentPage - 1) * PAGE_SIZE)
    .lean();

  const locale = "en" as const;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFB" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 20px" }}>
        <header style={{ marginBottom: 32 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#0B1E3D",
              marginBottom: 8,
            }}
          >
            Trip Reports
          </h1>
          <p style={{ fontSize: 14, color: "#5A6A7A" }}>
            {total} total report(s) from passengers
          </p>
        </header>

        {reports.length === 0 ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid #DCE6E4",
              borderRadius: 12,
              padding: 48,
              textAlign: "center",
            }}
          >
            <CheckCircle size={48} color="#00C2A8" style={{ margin: "0 auto 16px" }} />
            <p style={{ fontSize: 16, color: "#5A6A7A" }}>No reports yet</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {reports.map((report: any) => {
              const trip = report.tripId as any;
              const user = report.userId as any;
              const isReviewed = !!report.reviewedAt;

              return (
                <article
                  key={report._id.toString()}
                  style={{
                    background: "#fff",
                    border: "1px solid #DCE6E4",
                    borderRadius: 12,
                    padding: 20,
                    display: "grid",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "start",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <strong style={{ fontSize: 16, color: "#0B1E3D" }}>
                          Trip #{trip?.tripNumber ?? "N/A"}
                        </strong>
                        {isReviewed ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 10px",
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              background: "#E8F8F5",
                              color: "#00806E",
                            }}
                          >
                            <CheckCircle size={12} />
                            Reviewed
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 10px",
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              background: "#FFF3E0",
                              color: "#E65100",
                            }}
                          >
                            <AlertCircle size={12} />
                            Pending
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: "#5A6A7A" }}>
                        Reported by: <strong>{user?.name ?? "Unknown"}</strong> ({user?.email ?? "N/A"})
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#5A6A7A" }}>
                      <Clock size={14} />
                      {new Date(report.createdAt).toLocaleString("en-EG", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      padding: 16,
                      background: "#F8FAFB",
                      borderRadius: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: "#687978", marginBottom: 4, fontWeight: 600 }}>
                        Category
                      </div>
                      <div style={{ fontSize: 14, color: "#0B1E3D", fontWeight: 600 }}>
                        {translate(locale, `report.category.${report.category}` as any)}
                      </div>
                    </div>

                    {report.description && (
                      <div>
                        <div style={{ fontSize: 12, color: "#687978", marginBottom: 4, fontWeight: 600 }}>
                          Details
                        </div>
                        <p style={{ fontSize: 14, color: "#24454A", lineHeight: 1.5 }}>
                          {report.description}
                        </p>
                      </div>
                    )}

                    {trip && (
                      <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
                        <div>
                          <strong style={{ color: "#5A6A7A" }}>Date: </strong>
                          <span style={{ color: "#0B1E3D" }}>{trip.date}</span>
                        </div>
                        <div>
                          <strong style={{ color: "#5A6A7A" }}>Route: </strong>
                          <span style={{ color: "#0B1E3D" }}>
                            {trip.pickupAddress} → {trip.dropoffAddress}
                          </span>
                        </div>
                        <div>
                          <strong style={{ color: "#5A6A7A" }}>Vehicle: </strong>
                          <span style={{ color: "#0B1E3D" }}>{trip.vehicleType}</span>
                        </div>
                        <div>
                          <strong style={{ color: "#5A6A7A" }}>Price: </strong>
                          <span style={{ color: "#0B1E3D" }}>{trip.priceEgp} EGP</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {report.adminNote && (
                    <div
                      style={{
                        padding: 12,
                        background: "#EEF2F2",
                        borderRadius: 8,
                        borderLeft: "3px solid #00C2A8",
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#687978", marginBottom: 4, fontWeight: 700 }}>
                        ADMIN NOTE
                      </div>
                      <p style={{ fontSize: 13, color: "#24454A" }}>{report.adminNote}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              marginTop: 32,
            }}
          >
            {currentPage > 1 && (
              <a
                href={`/admin/trip-reports?page=${currentPage - 1}`}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #DCE6E4",
                  background: "#fff",
                  color: "#0B1E3D",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Previous
              </a>
            )}
            <span style={{ fontSize: 14, color: "#5A6A7A" }}>
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages && (
              <a
                href={`/admin/trip-reports?page=${currentPage + 1}`}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #DCE6E4",
                  background: "#fff",
                  color: "#0B1E3D",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Next
              </a>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
