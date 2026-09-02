import "server-only";

const API_BASE_URL = "https://smsmisr.com/api";

type SmsMisrResponse = {
  code?: string | number;
  Code?: string | number;
  [key: string]: unknown;
};

function getAccountCredentials() {
  const username = process.env.SMS_MISR_USERNAME;
  const password = process.env.SMS_MISR_PASSWORD;

  if (!username || !password) {
    throw new Error("SMS Misr is not configured.");
  }

  return { username, password };
}

function isPlaceholderValue(value: string | undefined) {
  return (
    !value ||
    value.trim() === "" ||
    /^(your_otp_template|your_sender|test|placeholder|dummy)$/i.test(
      value.trim(),
    )
  );
}

function getOtpCredentials() {
  const { username, password } = getAccountCredentials();
  const sender = process.env.SMS_MISR_SENDER?.trim();
  const template = process.env.SMS_MISR_OTP_TEMPLATE?.trim();

  if (isPlaceholderValue(sender) || isPlaceholderValue(template)) {
    throw new Error(
      "SMS Misr OTP is not configured. Set valid SMS_MISR_SENDER and SMS_MISR_OTP_TEMPLATE values in .env.local.",
    );
  }

  return {
    username,
    password,
    sender: sender as string,
    template: template as string,
  };
}

async function parseResponse(response: Response): Promise<SmsMisrResponse> {
  const text = await response.text();
  try {
    return JSON.parse(text) as SmsMisrResponse;
  } catch {
    return { raw: text };
  }
}

function getProviderCode(response: SmsMisrResponse) {
  return String(response.code ?? response.Code ?? "");
}

const OTP_ERROR_MESSAGES: Record<string, string> = {
  "4903": "SMS Misr rejected the API username or password.",
  "4904": "SMS Misr rejected the sender token for this account or environment.",
  "4905": "SMS Misr rejected the mobile number.",
  "4906": "The SMS Misr account has insufficient credit.",
  "4907": "SMS Misr is temporarily unavailable.",
  "4908": "SMS Misr rejected the OTP value.",
  "4909": "SMS Misr rejected the OTP template token.",
  "4912": "SMS Misr rejected the selected environment.",
};

function isSuccess(response: SmsMisrResponse) {
  // SMS Misr's OTP endpoint uses 4901; 1901 is for the general SMS endpoint.
  return getProviderCode(response) === "4901";
}

export async function sendSmsMisrOtp({
  phone,
  otp,
}: {
  phone: string;
  otp: string;
}) {
  const { username, password, sender, template } = getOtpCredentials();
  const payload = new URLSearchParams({
    environment: process.env.SMS_MISR_ENVIRONMENT === "1" ? "1" : "2",
    username,
    password,
    sender,
    mobile: phone.replace(/^\+/, ""),
    language: process.env.SMS_MISR_LANGUAGE === "2" ? "2" : "1",
    template,
    otp,
  });

  const response = await fetch(`${API_BASE_URL}/OTP/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload,
    cache: "no-store",
  });
  const result = await parseResponse(response);
  if (!response.ok || !isSuccess(result)) {
    const providerCode = getProviderCode(result) || "unknown";
    console.error("SMS Misr OTP request failed", {
      status: response.status,
      code: providerCode,
      body: result,
      environment: payload.get("environment"),
      phone: phone.replace(/^\+/, ""),
    });
    throw new Error(
      OTP_ERROR_MESSAGES[providerCode] ??
        `SMS Misr rejected the OTP request (code ${providerCode}).`,
    );
  }
}

export async function getSmsMisrBalance(): Promise<unknown> {
  const { username, password } = getAccountCredentials();
  const response = await fetch(`${API_BASE_URL}/Balance/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    console.error("SMS Misr balance request failed", {
      status: response.status,
    });
    throw new Error("SMS Misr could not retrieve the balance.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text.trim();
  }
}
