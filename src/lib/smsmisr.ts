import "server-only";

const API_BASE_URL = "https://smsmisr.com/api";

type SmsMisrResponse = { code?: string | number; [key: string]: unknown };

function getAccountCredentials() {
  const username = process.env.SMS_MISR_USERNAME;
  const password = process.env.SMS_MISR_PASSWORD;

  if (!username || !password) {
    throw new Error("SMS Misr is not configured.");
  }

  return { username, password };
}

function getOtpCredentials() {
  const { username, password } = getAccountCredentials();
  const sender = process.env.SMS_MISR_SENDER;
  const template = process.env.SMS_MISR_OTP_TEMPLATE;
  if (!sender || !template) throw new Error("SMS Misr OTP is not configured.");
  return { username, password, sender, template };
}

async function parseResponse(response: Response): Promise<SmsMisrResponse> {
  const text = await response.text();
  try {
    return JSON.parse(text) as SmsMisrResponse;
  } catch {
    return { raw: text };
  }
}

function isSuccess(response: SmsMisrResponse) {
  return String(response.code ?? "") === "1901";
}

export async function sendSmsMisrOtp({ phone, otp }: { phone: string; otp: string }) {
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
    console.error("SMS Misr OTP request failed", { status: response.status, code: result.code });
    throw new Error("SMS Misr could not send the verification code.");
  }
}

export async function getSmsMisrBalance(): Promise<unknown> {
  const { username, password } = getAccountCredentials();
  const url = new URL(`${API_BASE_URL}/Balance/`);
  url.searchParams.set("username", username);
  url.searchParams.set("password", password);

  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();
  if (!response.ok) {
    console.error("SMS Misr balance request failed", { status: response.status });
    throw new Error("SMS Misr could not retrieve the balance.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text.trim();
  }
}
