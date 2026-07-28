import "server-only";
import nodemailer from "nodemailer";
import { Resend } from "resend";
type Transporter = any;
import { SUPPORT_EMAIL } from "@/lib/config/site";

interface ContactPayload {
  name: string;
  email: string;
  message: string;
}

function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  );
}

function getContactAddresses() {
  const to =
    process.env.RESEND_TO_EMAIL?.trim() ||
    process.env.CONTACT_TO_EMAIL?.trim() ||
    SUPPORT_EMAIL;
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.CONTACT_FROM_EMAIL?.trim() ||
    "Commuter Contact <onboarding@resend.dev>";

  return { to, from };
}

let devTransporter: Transporter | null = null;

async function getDevTransporter(): Promise<Transporter> {
  if (!devTransporter) {
    const account = await nodemailer.createTestAccount();
    devTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: account.user, pass: account.pass },
    });
  }
  return devTransporter;
}

async function sendViaResend({
  name,
  email,
  message,
}: ContactPayload): Promise<{ ok: true } | { ok: false; error: string }> {
  const { to, from } = getContactAddresses();

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const res = await resend.emails.send({
      from,
      to: [to],
      replyTo: email,
      subject: `[Commuter Contact] Message from ${name}`,
      text: [`Name: ${name}`, `Email: ${email}`, "", "Message:", message].join(
        "\n",
      ),
      html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <hr />
        <p style="white-space:pre-wrap">${message.replace(/</g, "&lt;")}</p>
      `,
    });

    if (res.error) {
      console.error("[contact] Resend error:", res.error);
      const hint =
        process.env.NODE_ENV === "development" && res.error.message
          ? res.error.message
          : "Failed to send message. Please try again later.";
      return { ok: false, error: hint };
    }

    return { ok: true };
  } catch (err) {
    console.error("[contact] Resend request failed:", err);
    return {
      ok: false,
      error: "Failed to send message. Please try again later.",
    };
  }
}

async function sendViaSmtp(
  payload: ContactPayload,
  transporter: Transporter,
  from: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { to } = getContactAddresses();
  const { name, email, message } = payload;

  try {
    const info = await transporter.sendMail({
      from,
      to,
      replyTo: email,
      subject: `[Commuter Contact] Message from ${name}`,
      text: [`Name: ${name}`, `Email: ${email}`, "", "Message:", message].join(
        "\n",
      ),
      html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <hr />
        <p style="white-space:pre-wrap">${message.replace(/</g, "&lt;")}</p>
      `,
    });

    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      console.log("[contact] Dev preview URL:", preview);
    }

    return { ok: true };
  } catch (err) {
    console.error("[contact] SMTP send failed:", err);
    return {
      ok: false,
      error: "Failed to send message. Please try again later.",
    };
  }
}

export async function sendContactEmail(
  payload: ContactPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (resendConfigured()) {
    return sendViaResend(payload);
  }

  if (smtpConfigured()) {
    const from =
      process.env.CONTACT_FROM_EMAIL?.trim() ||
      `"Commuter Contact" <${process.env.SMTP_USER}>`;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return sendViaSmtp(payload, transporter, from);
  }

  // Local dev: auto-use Ethereal test inbox so the form works without env setup.
  if (process.env.NODE_ENV === "development") {
    console.log(
      "[contact] No RESEND/SMTP configured — using Ethereal test inbox (dev only).",
    );
    const transporter = await getDevTransporter();
    return sendViaSmtp(
      payload,
      transporter,
      `"Commuter Contact" <dev@commuter.local>`,
    );
  }

  return {
    ok: false,
    error: "Email service is not configured. Please try again later.",
  };
}
