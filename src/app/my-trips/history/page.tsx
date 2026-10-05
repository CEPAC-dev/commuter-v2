import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/layout/AppHeader";
import EmptyState from "@/components/shared/EmptyState";
import Pagination from "@/components/shared/Pagination";
import TripHistoryFilters from "@/components/trips/TripHistoryFilters";
import TripHistoryControls from "@/components/trips/TripHistoryControls";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { formatDate, formatEgp, formatTime, translate, localeDirection } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n/server";
import { groupTripsByRequest } from "@/lib/groupRequestTrips";
import { getDisplayStatus, getRejectionDisplay } from "@/lib/statusDisplay.ts";
import {
  matchesTripHistoryFilter,
  type TripHistoryFilter,
} from "@/lib/tripHistory.ts";
import { parseHistoryParams } from "@/lib/tripHistoryFilters.ts";
import { listUserTrips } from "@/lib/services/trips";
import type { TripListRow } from "@/types/booking";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;
function statusColors(tone: ReturnType<typeof getDisplayStatus>["tone"]) {
  return {
    neutral: { background: "#EEF2F2", color: "#5A6A7A" },
    warning: { background: "#FFF3E0", color: "#E65100" },
    success: { background: "#E8F5E9", color: "#20834A" },
    danger: { background: "#FFEBEE", color: "#C0392B" },
    info: { background: "#E2F8F5", color: "#007A6A" },
  }[tone];
}

export default async function TripHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?redirect=/my-trips/history");
  if (session.role === "admin") redirect("/admin/dashboard");
  if (session.role === "driver") redirect("/my-trips");
  await connectDB();

  const locale = await getServerLocale();
  const params = await searchParams;
  const parsed = parseHistoryParams(params);
  const filter: TripHistoryFilter = parsed.status;
  const page = parsed.page;
  const result = parsed.error
    ? { rows: [] as TripListRow[], totalRequests: 0 }
    : await listUserTrips(session.userId, {
        page: 1,
        pageSize: PAGE_SIZE,
        groupByRequest: true,
        fetchAll: true,
        tripNumber: parsed.tripNumber ?? undefined,
        dateFrom: parsed.from || undefined,
        dateTo: parsed.to || undefined,
      });

  const requests = groupTripsByRequest(result.rows).map((group) => ({
    requestId: group.kind === "single" ? group.trip.requestId : group.requestId,
    trips: group.kind === "single" ? [group.trip] : group.trips,
  }));
  const filteredRequests = requests
    .filter(({ trips }) => {
      const first = trips[0];
      return matchesTripHistoryFilter(
        filter,
        {
          status: first.parentRequestStatus ?? first.status,
          paymentStatus: first.parentPaymentStatus ?? first.paymentStatus,
          rejectionReason: first.rejectionReason,
          hasPastTrip: first.hasPastTrip,
        },
        trips,
      );
    })
    .sort((left, right) =>
      (right.trips[0].createdAt ?? "").localeCompare(left.trips[0].createdAt ?? ""),
    );
  const totalPages = Math.ceil(filteredRequests.length / PAGE_SIZE);
  const pageRequests = filteredRequests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const validationMessage = parsed.error
    ? translate(locale, `history.error_${parsed.error}`)
    : null;

  return (
    <div dir={localeDirection(locale)} style={{ minHeight: "100dvh", background: "#F8F9FA" }}>
      <AppHeader authed email={session.email} role="passenger" variant="app" backHref="/my-trips" />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "28px 16px 56px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, color: "#0B1E3D", fontSize: 23, fontWeight: 800 }}>
              {translate(locale, "my_trips.history_title")}
            </h1>
            <Link href="/my-trips" style={{ display: "inline-block", marginTop: 7, color: "#007A6A", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              {translate(locale, "my_trips.title")}
            </Link>
          </div>
          <span style={{ color: "#5A6A7A", fontSize: 13, fontVariantNumeric: "tabular-nums" }} aria-label={translate(locale, "history.results_count", { count: filteredRequests.length })}>
            {filteredRequests.length}
          </span>
        </div>

        <TripHistoryControls />
        <TripHistoryFilters active={filter} />

        {validationMessage ? (
          <div role="alert" style={{ marginTop: 20, padding: "12px 14px", border: "1px solid #E8C4C0", borderRadius: 6, background: "#FFF5F4", color: "#8F2D28", fontSize: 13, fontWeight: 700 }}>
            {validationMessage}
          </div>
        ) : pageRequests.length === 0 ? (
          <div style={{ marginTop: 20 }}>
            <EmptyState title={translate(locale, "history.no_results")} />
            {(parsed.q || parsed.from || parsed.to || filter !== "all") && (
              <p style={{ margin: "-24px auto 0", maxWidth: 520, color: "#5A6A7A", fontSize: 13, lineHeight: 1.6, textAlign: "center" }}>
                {translate(locale, "history.no_results_for", {
                  query: parsed.q || translate(locale, "history.any_trip_number"),
                  from: parsed.from || "—",
                  to: parsed.to || "—",
                  status: translate(locale, `history.filter_${filter}`),
                })}
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
            {pageRequests.map(({ requestId, trips }) => {
              const first = trips[0];
              const request = {
                status: first.parentRequestStatus ?? first.status,
                paymentStatus: first.parentPaymentStatus ?? first.paymentStatus,
                rejectionReason: first.rejectionReason,
                hasPastTrip: first.hasPastTrip,
              };
              const rejectionDisplay = getRejectionDisplay({ request, trip: first });
              return (
                <section key={requestId} style={{ background: "#fff", border: "1px solid #E5ECEA", borderRadius: 8, overflow: "hidden" }}>
                  <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "13px 16px", borderBottom: "1px solid #EEF2F2" }}>
                    <strong style={{ color: "#0B1E3D", fontSize: 13 }}>
                      {translate(locale, "my_trips.booking_group", { count: trips.length, plural: trips.length === 1 ? "" : "s" })}
                    </strong>
                    <strong style={{ color: "#007A6A", fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                      {formatEgp(locale, first.bookingAmountEgp)}
                    </strong>
                  </header>
                  {rejectionDisplay.showReasonCard && (
                    <p
                      title={rejectionDisplay.reason ?? translate(locale, "rejection.no_reason")}
                      style={{ margin: 0, padding: "9px 16px", borderBottom: "1px solid #F1F4F4", color: "#6E4542", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {rejectionDisplay.reason ?? translate(locale, "rejection.no_reason")}
                    </p>
                  )}
                  {trips.map((trip) => {
                    const status = getDisplayStatus({ request, trip });
                    const colors = statusColors(status.tone);
                    const matchedTrip = parsed.tripNumber !== null && trip.tripNumber === parsed.tripNumber;
                    return (
                      <Link key={trip.id} href={`/my-trips/${trip.id}`} style={{ display: "grid", gap: 5, padding: "13px 16px", borderBottom: "1px solid #F1F4F4", borderInlineStart: matchedTrip ? "3px solid #00C2A8" : undefined, background: matchedTrip ? "#F2FAF7" : "#fff", color: "inherit", textDecoration: "none" }}>
                        <span style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <strong style={{ color: "#0B1E3D", fontSize: 13 }}>{formatDate(locale, trip.date)} · {translate(locale, `vehicles.${trip.vehicleType}`)}</strong>
                          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {matchedTrip && <span style={{ color: "#006D60", fontSize: 10, fontWeight: 800 }}>{translate(locale, "history.matched_trip")}</span>}
                            <span style={{ padding: "3px 9px", borderRadius: 16, background: colors.background, color: colors.color, fontSize: 11, fontWeight: 700 }}>
                              {translate(locale, status.key)}
                            </span>
                          </span>
                        </span>
                        <span style={{ color: "#5A6A7A", fontSize: 12, overflowWrap: "anywhere" }}>{trip.pickupAddress} → {trip.dropoffAddress}</span>
                        <span style={{ color: "#5A6A7A", fontSize: 12 }}>{translate(locale, "pickup")} {formatTime(locale, trip.pickupTime)} · {translate(locale, "arrive")} {formatTime(locale, trip.arrivalTime)} · {formatEgp(locale, trip.priceEgp)}</span>
                      </Link>
                    );
                  })}
                </section>
              );
            })}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} />
      </main>
    </div>
  );
}