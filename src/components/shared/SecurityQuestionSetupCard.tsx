"use client";

import { useState } from "react";
import { Check, Loader2, ShieldQuestion } from "lucide-react";
import { useRouter } from "next/navigation";
import { useVerificationConfig } from "@/lib/auth/useVerificationConfig";
import { useClientLocale } from "@/lib/i18n/client";

export default function SecurityQuestionSetupCard({
  initialHasSecurityQuestion,
}: {
  initialHasSecurityQuestion: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useClientLocale();
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
      setMessage({ ok: false, text: t("security_question.error_choose") });
      return;
    }
    if (securityAnswer.trim().length < 2) {
      setMessage({ ok: false, text: t("security_question.error_answer") });
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
        throw new Error(
          data.error ?? t("security_question.save_error_fallback"),
        );
      setHasSecurityQuestion(true);
      setSecurityAnswer("");
      setMessage({ ok: true, text: t("security_question.saved_notice") });
      router.refresh();
    } catch (error) {
      setMessage({
        ok: false,
        text:
          error instanceof Error
            ? error.message
            : t("security_question.save_error_fallback"),
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
            {t("security_question.title")}
          </h2>
          <p
            style={{
              margin: "3px 0 0",
              color: hasSecurityQuestion ? "#00877A" : "#5A6A7A",
              fontSize: 13,
            }}
          >
            {hasSecurityQuestion
              ? t("security_question.setup_status_done")
              : t("security_question.setup_hint")}
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
            aria-label={t("security_question.title")}
            style={fieldStyle}
          >
            <option value="">{t("security_question.choose_option")}</option>
            {questions.map((question) => (
              <option key={question.id} value={question.id}>
                {locale === "ar" ? question.questionAr : question.question}
              </option>
            ))}
          </select>
          <input
            value={securityAnswer}
            onChange={(event) =>
              setSecurityAnswer(event.target.value.slice(0, 120))
            }
            autoComplete="off"
            placeholder={t("security_question.your_answer_placeholder")}
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
            {saving && <Loader2 size={16} className="animate-spin" />}
            {t("security_question.save_button")}
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
