"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_VERIFICATION_METHOD,
  isVerificationMethod,
  SECURITY_QUESTIONS,
  type VerificationMethod,
} from "@/lib/config/verification";

type Question = { id: string; question: string; questionAr: string };

export function useVerificationConfig() {
  const [method, setMethod] = useState<VerificationMethod>(
    DEFAULT_VERIFICATION_METHOD,
  );
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/verification-config", {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;
        if (isVerificationMethod(data?.method)) setMethod(data.method);
        setQuestions(
          Array.isArray(data?.questions) && data.questions.length > 0
            ? data.questions
            : [...SECURITY_QUESTIONS],
        );
      } catch {
        if (!cancelled) setQuestions([...SECURITY_QUESTIONS]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { method, questions, loading };
}
