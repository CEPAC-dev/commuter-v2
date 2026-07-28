/**
 * Kashier Payouts — send money from the merchant account to a driver's
 * mobile wallet or bank account.
 *
 * Kashier Payouts is a separate product from payment sessions. Contact Kashier
 * (15883) to enable Payouts API access on your merchant account. Until then,
 * set KASHIER_PAYOUT_SIMULATE=true in test mode to auto-complete withdrawals.
 */

const BASE =
  process.env.KASHIER_MODE === "live"
    ? "https://api.kashier.io"
    : "https://test-api.kashier.io";

export interface PayoutRecipient {
  method: "mobile_wallet" | "bank";
  mobile?: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
}

export interface PayoutResult {
  success: boolean;
  payoutId?: string;
  status: "completed" | "pending" | "failed";
  message?: string;
}

function maskDestination(recipient: PayoutRecipient): string {
  if (recipient.method === "mobile_wallet" && recipient.mobile) {
    const m = recipient.mobile.replace(/\D/g, "");
    return `****${m.slice(-4)}`;
  }
  if (recipient.accountNumber) {
    return `****${recipient.accountNumber.slice(-4)}`;
  }
  return "—";
}

export { maskDestination };

/** Initiate a payout to the driver's registered destination. */
export async function initiateKashierPayout(
  orderId: string,
  amountEgp: number,
  recipient: PayoutRecipient,
): Promise<PayoutResult> {
  const secret = process.env.KASHIER_SECRET_KEY;
  const apiKey = process.env.KASHIER_API_KEY;
  const merchantId = process.env.KASHIER_MERCHANT_ID;

  if (!secret || !apiKey || !merchantId) {
    return {
      success: false,
      status: "failed",
      message: "Kashier credentials are not configured.",
    };
  }

  // Test simulation when Payouts API is not yet enabled on the merchant account.
  if (
    process.env.KASHIER_MODE !== "live" &&
    process.env.KASHIER_PAYOUT_SIMULATE === "true"
  ) {
    return {
      success: true,
      payoutId: `sim-${orderId}`,
      status: "completed",
      message: "Simulated payout (test mode).",
    };
  }

  const body: Record<string, unknown> = {
    merchantOrderId: orderId,
    merchantId,
    amount: String(amountEgp),
    currency: "EGP",
    description: `Driver withdrawal ${orderId}`,
  };

  if (recipient.method === "mobile_wallet") {
    body.method = "wallet";
    body.mobileNumber = recipient.mobile?.replace(/\D/g, "");
  } else {
    body.method = "bank";
    body.bankName = recipient.bankName;
    body.accountNumber = recipient.accountNumber;
    body.accountHolder = recipient.accountHolder;
  }

  const url = `${BASE}/v3/payouts`;

  let data: Record<string, unknown>;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: secret,
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    data = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const msg =
        (data.message as string) ??
        (data.error as string) ??
        `Kashier payout rejected (${res.status})`;
      return { success: false, status: "failed", message: msg };
    }
  } catch (err) {
    return {
      success: false,
      status: "failed",
      message: err instanceof Error ? err.message : "Network error",
    };
  }

  const inner = (data.data ?? data.response ?? data) as Record<string, unknown>;
  const payoutId = String(inner._id ?? inner.payoutId ?? inner.id ?? "");
  const statusRaw = String(inner.status ?? "pending").toUpperCase();

  if (["SUCCESS", "COMPLETED", "PAID", "PROCESSED"].includes(statusRaw)) {
    return { success: true, payoutId, status: "completed" };
  }
  if (["FAILED", "REJECTED", "ERROR"].includes(statusRaw)) {
    return {
      success: false,
      payoutId,
      status: "failed",
      message: String(inner.message ?? "Payout failed"),
    };
  }

  return { success: true, payoutId, status: "pending" };
}

/** Query Kashier for a payout's final status. */
export async function queryKashierPayoutStatus(
  payoutId: string,
): Promise<"completed" | "failed" | "pending"> {
  if (!process.env.KASHIER_SECRET_KEY || payoutId.startsWith("sim-")) {
    return payoutId.startsWith("sim-") ? "completed" : "pending";
  }

  const url = `${BASE}/v3/payouts/${encodeURIComponent(payoutId)}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: process.env.KASHIER_SECRET_KEY },
      cache: "no-store",
    });
    const json = (await res.json()) as Record<string, unknown>;
    const data = (json.data ?? json.response ?? json) as Record<
      string,
      unknown
    >;
    const status = String(data?.status ?? "").toUpperCase();
    if (["SUCCESS", "COMPLETED", "PAID", "PROCESSED"].includes(status))
      return "completed";
    if (["FAILED", "REJECTED", "ERROR"].includes(status)) return "failed";
  } catch {
    /* keep pending */
  }
  return "pending";
}
