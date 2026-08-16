import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle, Clock, XCircle, ArrowRight } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getBookingStatus } from "@/lib/services/booking-status";
import { Types } from "mongoose";
import { verifyAndSettleBooking } from "@/lib/payments/kashier";

interface SearchParams {
  bookingId?: string;
  status?: string; // Kashier adds: SUCCESS | FAILURE
}

export const metadata = { title: "Payment — Commuter" };

// Revalidate on every request so status reflects latest webhook update
export const dynamic = "force-dynamic";

export default async function CallbackPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { bookingId, status: kashierStatus } = await searchParams;

  if (!bookingId || !Types.ObjectId.isValid(bookingId)) {
    redirect("/my-trips");
  }

  // Active verification — query Kashier directly and settle the booking.
  // Don't rely on the webhook alone (may be delayed or fail to deliver).
  await verifyAndSettleBooking(bookingId, session.userId);

  const booking = await getBookingStatus(session.userId, bookingId);

  if (!booking) redirect("/my-trips");

  const isPaid = booking.paymentStatus === "paid";
  if (isPaid) {
    redirect("/my-trips");
  }
  const isFailed =
    booking.paymentStatus === "failed" ||
    kashierStatus === "FAILURE" ||
    kashierStatus === "failure";
  const isProcessing = !isPaid && !isFailed;
  const datesLabel = (booking.dates ?? []).join(", ");

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#f8f9fa",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ textDecoration: "none", marginBottom: 32 }}>
        <span
          style={{
            fontWeight: 900,
            fontSize: 20,
            color: "#0B1E3D",
            letterSpacing: "-0.025em",
          }}
        >
          Commuter
        </span>
      </Link>

      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          border: "1px solid #eef0f3",
          padding: "36px 32px",
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 4px 24px rgba(11,30,61,0.07)",
        }}
      >
        {isPaid && (
          <>
            <div style={{ marginBottom: 20 }}>
              <CheckCircle size={52} color="#27AE60" aria-hidden="true" />
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#0B1E3D",
                margin: "0 0 8px",
                letterSpacing: "-0.02em",
              }}
            >
              Payment confirmed!
            </h1>
            <p style={{ fontSize: 15, color: "#5A6A7A", margin: "0 0 8px" }}>
              Your request for{" "}
              <strong style={{ color: "#0B1E3D" }}>{datesLabel}</strong> is
              confirmed.
            </p>
            <p
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#00C2A8",
                margin: "0 0 28px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {booking.amountEgp} EGP paid
            </p>
          </>
        )}

        {isProcessing && (
          <>
            <div style={{ marginBottom: 20 }}>
              <Clock size={52} color="#E65100" aria-hidden="true" />
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#0B1E3D",
                margin: "0 0 8px",
                letterSpacing: "-0.02em",
              }}
            >
              Processing payment…
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "#5A6A7A",
                margin: "0 0 28px",
                lineHeight: 1.6,
              }}
            >
              Your payment is being verified. This usually takes a few seconds.
              Check <strong>My requests</strong> for the updated status.
            </p>
          </>
        )}

        {isFailed && (
          <>
            <div style={{ marginBottom: 20 }}>
              <XCircle size={52} color="#E74C3C" aria-hidden="true" />
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#0B1E3D",
                margin: "0 0 8px",
                letterSpacing: "-0.02em",
              }}
            >
              Payment failed
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "#5A6A7A",
                margin: "0 0 28px",
                lineHeight: 1.6,
              }}
            >
              Your payment could not be processed. Your booking has been
              cancelled. Please try booking again.
            </p>
          </>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href="/my-trips"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              height: 52,
              background: "#0B1E3D",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              borderRadius: 12,
              textDecoration: "none",
              transition: "background 0.2s",
            }}
          >
            View my trips
            <ArrowRight size={16} aria-hidden="true" />
          </Link>

          {(isFailed || isProcessing) && (
            <Link
              href="/create"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 48,
                background: "transparent",
                color: "#5A6A7A",
                fontWeight: 600,
                fontSize: 14,
                borderRadius: 12,
                textDecoration: "none",
                border: "1.5px solid #eef0f3",
              }}
            >
              Book another ride
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
