"use client";

import { useState } from "react";
import { Check, Loader2, ShieldQuestion } from "lucide-react";
import { useRouter } from "next/navigation";
import { useVerificationConfig } from "@/lib/auth/useVerificationConfig";

export default function SecurityQuestionSetupCard({
  initialHasSecurityQuestion,
}: {
  initialHasSecurityQuestion: boolean;
}) {
  const router = useRouter();
  const { method, questions, loading: configLoading } = useVerificationConfig();
  const [hasSecurityQuestion, setHasSecurityQuestion] = useState(
    initialHasSecurityQuestion,
  );
  const [securityQuestionId, setSecurityQuestionId] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  if (configLoading || method !== "security_question") return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!securityQuestionId) {
      setMessage({ ok: false, text: "Choose a security question." });
      return;
    }
    if (securityAnswer.trim().length < 2) {
      setMessage({ ok: false, text: "Enter your security answer." });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/auth/security-question/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          securityQuestionId,
          securityAnswer: securityAnswer.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not save security question.");
      setHasSecurityQuestion(true);
      setSecurityAnswer("");
      setMessage({ ok: true, text: "Security question saved." });
      router.refresh();
    } catch (error) {
      setMessage({
        ok: false,
        text:
          error instanceof Error
            ? error.message
            : "Could not save security question.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #eef0f3",
        padding: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: hasSecurityQuestion ? 0 : 14,
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: hasSecurityQuestion
              ? "rgba(0,194,168,0.12)"
              : "#eef2f5",
            color: hasSecurityQuestion ? "#00877A" : "#5A6A7A",
          }}
        >
          {hasSecurityQuestion ? (
            <Check size={18} aria-hidden="true" />
          ) : (
            <ShieldQuestion size={18} aria-hidden="true" />
          )}
        </span>
        <div>
          <h2 style={{ margin: 0, color: "#0B1E3D", fontSize: 15 }}>
            Security question
          </h2>
          <p
            style={{
              margin: "3px 0 0",
              color: hasSecurityQuestion ? "#00877A" : "#5A6A7A",
              fontSize: 13,
            }}
          >
            {hasSecurityQuestion
              ? "Set up"
              : "Set this up to reset or change your password."}
          </p>
        </div>
      </div>

      {!hasSecurityQuestion && (
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <select
            value={securityQuestionId}
            onChange={(event) => setSecurityQuestionId(event.target.value)}
            required
            aria-label="Security question"
            style={fieldStyle}
          >
            <option value="">Choose a question</option>
            {questions.map((question) => (
              <option key={question.id} value={question.id}>
                {question.question}
              </option>
            ))}
          </select>
          <input
            value={securityAnswer}
            onChange={(event) =>
              setSecurityAnswer(event.target.value.slice(0, 120))
            }
            autoComplete="off"
            placeholder="Your answer"
            required
            style={fieldStyle}
          />
          {message && (
            <p
              role={message.ok ? "status" : "alert"}
              style={{
                margin: 0,
                fontSize: 13,
                color: message.ok ? "#00877A" : "#c0392b",
              }}
            >
              {message.text}
            </p>
          )}
          <button type="submit" disabled={saving} style={buttonStyle(saving)}>
            {saving && <Loader2 size={16} className="animate-spin" />}Save
            security question
          </button>
        </form>
      )}
    </section>
  );
}

const fieldStyle: React.CSSProperties = {
  height: 44,
  width: "100%",
  borderRadius: 9,
  border: "1.5px solid #d0d8e0",
  padding: "0 12px",
  fontSize: 14,
  color: "#0B1E3D",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    height: 42,
    padding: "0 14px",
    border: "none",
    borderRadius: 9,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    background: "#0B1E3D",
    color: "#fff",
    fontWeight: 700,
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  };
}
