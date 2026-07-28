"use client";

import { useState } from "react";
import { Send, CheckCircle, Loader2 } from "lucide-react";

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 48,
  padding: "0 16px",
  fontSize: 15,
  color: "#0B1E3D",
  background: "#ffffff",
  border: "1.5px solid #e8edf0",
  borderRadius: 10,
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

function focusField(e: React.FocusEvent<HTMLElement>) {
  e.currentTarget.style.borderColor = "#00C2A8";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,194,168,0.12)";
}

function blurField(e: React.FocusEvent<HTMLElement>) {
  e.currentTarget.style.borderColor = "#e8edf0";
  e.currentTarget.style.boxShadow = "none";
}

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send message.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div
        style={{
          background: "#ffffff",
          borderRadius: 20,
          padding: "48px 32px",
          border: "1.5px solid #eef0f3",
          textAlign: "center",
          boxShadow: "0 8px 32px rgba(11,30,61,0.06)",
        }}
      >
        <CheckCircle
          size={44}
          style={{ color: "#00C2A8", marginBottom: 16 }}
          aria-hidden="true"
        />
        <p
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#0B1E3D",
            margin: "0 0 8px",
          }}
        >
          Message sent
        </p>
        <p style={{ fontSize: 14, color: "#5A6A7A", margin: 0, lineHeight: 1.6 }}>
          Thanks for reaching out. We&apos;ll get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      style={{
        background: "#ffffff",
        borderRadius: 20,
        padding: "32px 28px",
        border: "1.5px solid #eef0f3",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        boxShadow: "0 8px 32px rgba(11,30,61,0.06)",
      }}
    >
      <div>
        <label
          htmlFor="contact-name"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            color: "#0B1E3D",
            marginBottom: 6,
          }}
        >
          Your name
        </label>
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Doe"
          required
          style={inputStyle}
          onFocus={focusField}
          onBlur={blurField}
        />
      </div>

      <div>
        <label
          htmlFor="contact-email"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            color: "#0B1E3D",
            marginBottom: 6,
          }}
        >
          Email
        </label>
        <input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          style={inputStyle}
          onFocus={focusField}
          onBlur={blurField}
        />
      </div>

      <div>
        <label
          htmlFor="contact-message"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 600,
            color: "#0B1E3D",
            marginBottom: 6,
          }}
        >
          Message
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we help you?"
          rows={5}
          required
          style={{
            ...inputStyle,
            height: "auto",
            padding: "14px 16px",
            resize: "vertical",
            minHeight: 140,
          }}
          onFocus={focusField}
          onBlur={blurField}
        />
      </div>

      {error && (
        <p
          role="alert"
          style={{
            fontSize: 13,
            color: "#e74c3c",
            margin: 0,
            background: "rgba(231,76,60,0.07)",
            border: "1px solid rgba(231,76,60,0.2)",
            borderRadius: 8,
            padding: "10px 14px",
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        style={{
          marginTop: 4,
          height: 52,
          background: sending ? "#9aa8b5" : "#0B1E3D",
          color: "#ffffff",
          fontWeight: 700,
          fontSize: 15,
          border: "none",
          borderRadius: 12,
          cursor: sending ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontFamily: "inherit",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => {
          if (!sending) e.currentTarget.style.background = "#00C2A8";
        }}
        onMouseLeave={(e) => {
          if (!sending) e.currentTarget.style.background = "#0B1E3D";
        }}
      >
        {sending ? (
          <>
            <Loader2
              size={16}
              aria-hidden="true"
              style={{ animation: "spin 0.7s linear infinite" }}
            />
            Sending…
          </>
        ) : (
          <>
            Send message
            <Send size={16} aria-hidden="true" />
          </>
        )}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  );
}
