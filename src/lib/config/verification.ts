// Verification method configuration: SMS OTP (SMS Misr) vs. Security Question.
// The active method is stored in AdminSettings and toggled from /admin/settings.
// SMS OTP = 6-digit code sent to the user's phone number via SMS Misr.
// Security Question = user picks one of SECURITY_QUESTIONS at signup and
// answers it whenever a verification challenge is required.

export type VerificationMethod = "sms_otp" | "security_question";

export const VERIFICATION_METHODS: readonly VerificationMethod[] = [
  "sms_otp",
  "security_question",
] as const;

export const DEFAULT_VERIFICATION_METHOD: VerificationMethod = "sms_otp";

export function isVerificationMethod(v: unknown): v is VerificationMethod {
  return v === "sms_otp" || v === "security_question";
}

// Stable numeric ids so the AdminSettings method switch does not need to
// re-map any stored value on the user document if we ever reword a question.
export const SECURITY_QUESTIONS: ReadonlyArray<{
  id: string;
  question: string;
  questionAr: string;
}> = [
  {
    id: "pet_name",
    question: "What was the name of your first pet?",
    questionAr: "ما اسم أول حيوان أليف امتلكته؟",
  },
  {
    id: "mother_maiden",
    question: "What is your mother's maiden name?",
    questionAr: "ما اسم عائلة والدتك قبل الزواج؟",
  },
  {
    id: "birth_city",
    question: "In what city were you born?",
    questionAr: "في أي مدينة وُلدت؟",
  },
  {
    id: "first_school",
    question: "What was the name of your first school?",
    questionAr: "ما اسم أول مدرسة التحقت بها؟",
  },
  {
    id: "first_car",
    question: "What was the make of your first car?",
    questionAr: "ما ماركة أول سيارة امتلكتها؟",
  },
  {
    id: "childhood_book",
    question: "What is your favorite childhood book?",
    questionAr: "ما كتابك المفضل في الطفولة؟",
  },
] as const;

export function questionText(
  q: { question: string; questionAr: string },
  locale: "en" | "ar",
) {
  return locale === "ar" ? q.questionAr : q.question;
}

export function getSecurityQuestion(id: string) {
  return SECURITY_QUESTIONS.find((q) => q.id === id);
}

export function isValidSecurityQuestionId(id: unknown): id is string {
  return typeof id === "string" && SECURITY_QUESTIONS.some((q) => q.id === id);
}
