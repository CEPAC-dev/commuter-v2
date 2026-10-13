const ACTIVE_PAYMENT_STATUSES = new Set([
  "created",
  "wallet_reserved",
  "kashier_pending",
]);

export function splitTripPaymentAmount(
  totalEgp: number,
  availableWalletEgp: number,
  useWallet: boolean,
): { totalEgp: number; walletAmountEgp: number; gatewayAmountEgp: number } {
  if (
    !Number.isFinite(totalEgp) ||
    totalEgp < 0 ||
    !Number.isFinite(availableWalletEgp) ||
    availableWalletEgp < 0
  ) {
    throw new RangeError("Payment amounts must be finite and non-negative.");
  }
  const totalPiasters = Math.round(totalEgp * 100);
  const availablePiasters = Math.round(availableWalletEgp * 100);
  const walletPiasters = useWallet
    ? Math.min(totalPiasters, availablePiasters)
    : 0;
  return {
    totalEgp: totalPiasters / 100,
    walletAmountEgp: walletPiasters / 100,
    gatewayAmountEgp: (totalPiasters - walletPiasters) / 100,
  };
}

export function formatKashierAmount(amountEgp: number): string {
  const piasters = Math.round(amountEgp * 100);
  if (!Number.isSafeInteger(piasters) || piasters < 0)
    throw new RangeError("Kashier amount must be a non-negative currency amount.");
  return (piasters / 100).toFixed(2).replace(/\.?0+$/, "");
}

function isPrivateIpv4(host: string): boolean {
  const octets = host.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  )
    return false;
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function isPrivateAddress(host: string): boolean {
  const normalized = host
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (isPrivateIpv4(normalized)) return true;
  if (normalized.includes(":")) {
    const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    const mappedAddress =
      mappedIpv4?.[1] ??
      (mappedHex
        ? [
            mappedHex[1].padStart(4, "0").slice(0, 2),
            mappedHex[1].padStart(4, "0").slice(2),
            mappedHex[2].padStart(4, "0").slice(0, 2),
            mappedHex[2].padStart(4, "0").slice(2),
          ]
            .map((octet) => Number.parseInt(octet, 16))
            .join(".")
        : undefined);
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith("ff") ||
      (mappedAddress !== undefined && isPrivateIpv4(mappedAddress))
    );
  }
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  );
}

export type PaymentAppUrlValidation =
  | { valid: true; baseUrl: string; host: string }
  | { valid: false; host: string | null };

export interface PaymentAppUrlEnvironment {
  nodeEnv?: string;
  appEnv?: string;
  kashierMode?: string;
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}

export function validatePaymentAppUrl(
  value: string | undefined,
  environment: PaymentAppUrlEnvironment,
): PaymentAppUrlValidation {
  if (!value) return { valid: false, host: null };
  try {
    const parsed = new URL(value);
    const host = parsed.host || null;
    const isProduction =
      environment.nodeEnv?.toLowerCase() === "production" ||
      environment.appEnv?.toLowerCase() === "production";
    const allowLocal =
      !isProduction &&
      environment.kashierMode === "test" &&
      isLoopbackHost(parsed.hostname);
    if (
      !host ||
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      value.includes("?") ||
      value.includes("#") ||
      (!allowLocal && parsed.protocol !== "https:") ||
      (!allowLocal && isPrivateAddress(parsed.hostname))
    ) {
      return { valid: false, host };
    }
    return {
      valid: true,
      baseUrl: parsed.toString().replace(/\/+$/, ""),
      host,
    };
  } catch {
    return { valid: false, host: null };
  }
}

export function canContinueStandaloneTripPayment(input: {
  tripStatus: string | undefined;
  tripPaymentStatus: string | undefined;
  paymentStatus: string | undefined;
}): boolean {
  return (
    ["pending_payment", "approved"].includes(input.tripStatus ?? "") &&
    ["pending", "failed"].includes(input.tripPaymentStatus ?? "") &&
    ACTIVE_PAYMENT_STATUSES.has(input.paymentStatus ?? "")
  );
}
