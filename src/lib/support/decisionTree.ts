export type SupportLocale = "en" | "ar";
export type SupportCategory =
  | "booking"
  | "trip"
  | "payment"
  | "account"
  | "safety"
  | "other";

export interface SupportOption {
  id: string;
  label: string;
}

export interface SupportBotStep {
  nodeId: string;
  category: SupportCategory;
  message: string;
  options: SupportOption[];
  handoff?: boolean;
}

const CATEGORIES: SupportCategory[] = [
  "booking",
  "trip",
  "payment",
  "account",
  "safety",
  "other",
];

const COPY = {
  en: {
    welcome: "Hi! I’m Commuter support. What can I help you with?",
    choose: "Choose the part you need help with.",
    categories: {
      booking: "Booking a ride",
      trip: "An upcoming or completed trip",
      payment: "Payment or refund",
      account: "My account",
      safety: "Safety",
      other: "Something else",
    },
    options: {
      booking: [
        ["how_to_book", "How do I book a ride?"],
        ["change_booking", "Can I change my booking?"],
        ["cancel_booking", "How do I cancel?"],
      ],
      trip: [
        ["trip_status", "Check my trip status"],
        ["driver_late", "My driver is late"],
        ["lost_item", "I left something in a vehicle"],
      ],
      payment: [
        ["payment_status", "Payment status"],
        ["refund", "Refund timing"],
        ["payment_failed", "My payment failed"],
      ],
      account: [
        ["login", "I can’t log in"],
        ["profile", "Update my account details"],
        ["verification", "Account verification"],
      ],
      safety: [
        ["urgent_safety", "I need urgent help"],
        ["report_safety", "Report a safety concern"],
      ],
      other: [["other_question", "I have another question"]],
    },
    answers: {
      how_to_book:
        "Enter your pickup and drop-off, choose a vehicle, then select your arrival time and date. Review the trip details before submitting your request.",
      change_booking:
        "Open My requests to review your booking. Changes depend on the trip status and how soon it departs; contact our team if the option is unavailable.",
      cancel_booking:
        "Open My requests, choose the booking, and use its cancellation option when available. Any refund is handled according to the cancellation policy shown for that booking.",
      trip_status:
        "Open My trips or My requests to see the latest trip and booking status. Driver details appear after a driver has been assigned.",
      driver_late:
        "Check the trip details for the scheduled pickup time. If your driver has not arrived, contact our support team and include your trip details.",
      lost_item:
        "Contact our support team with your trip date, route, and a description of the item. Please do not include sensitive payment details.",
      payment_status:
        "Your booking’s payment status is shown in My requests. If payment is still processing, refresh the page after a few minutes.",
      refund:
        "Refund eligibility depends on the booking and cancellation policy. Contact our team with your booking date if you need us to review it.",
      payment_failed:
        "Check your payment method and try again from My requests. If you were charged but the booking still shows unpaid, contact our team.",
      login:
        "Use Forgot password on the login page to recover access. If you no longer have access to your registered phone or email, our team can help.",
      profile:
        "Open your profile to review and update the details available on your account.",
      verification:
        "Follow the verification steps shown in your account. If verification remains pending, contact our team for help.",
      urgent_safety:
        "If you are in immediate danger, contact local emergency services now. For a safety concern related to a trip, contact our support team as soon as it is safe.",
      report_safety:
        "Please contact our team with the trip date and a brief description. If anyone is in immediate danger, contact local emergency services first.",
      other_question:
        "I can connect you with our customer service team so they can help with your question.",
    },
    helpful: "That solved it",
    contact: "Contact customer service",
    restart: "Glad I could help. What else can I help you with?",
    handoff:
      "I’ll connect you with customer service. Share your name, email, and a short description so our team can follow up.",
  },
  ar: {
    welcome: "مرحبًا! أنا مساعد كوميوتر. كيف يمكنني مساعدتك؟",
    choose: "اختر الموضوع الذي تحتاج إلى المساعدة بشأنه.",
    categories: {
      booking: "حجز رحلة",
      trip: "رحلة قادمة أو مكتملة",
      payment: "الدفع أو الاسترداد",
      account: "حسابي",
      safety: "السلامة",
      other: "موضوع آخر",
    },
    options: {
      booking: [
        ["how_to_book", "كيف أحجز رحلة؟"],
        ["change_booking", "هل يمكنني تعديل الحجز؟"],
        ["cancel_booking", "كيف ألغي الحجز؟"],
      ],
      trip: [
        ["trip_status", "الاستعلام عن حالة الرحلة"],
        ["driver_late", "السائق متأخر"],
        ["lost_item", "نسيت غرضًا في السيارة"],
      ],
      payment: [
        ["payment_status", "حالة الدفع"],
        ["refund", "موعد استرداد المبلغ"],
        ["payment_failed", "تعذر إتمام الدفع"],
      ],
      account: [
        ["login", "لا أستطيع تسجيل الدخول"],
        ["profile", "تحديث بيانات الحساب"],
        ["verification", "التحقق من الحساب"],
      ],
      safety: [
        ["urgent_safety", "أحتاج إلى مساعدة عاجلة"],
        ["report_safety", "الإبلاغ عن مشكلة تتعلق بالسلامة"],
      ],
      other: [["other_question", "لدي سؤال آخر"]],
    },
    answers: {
      how_to_book:
        "أدخل موقع الانطلاق والوجهة، واختر السيارة وموعد الوصول والتاريخ. راجع تفاصيل الرحلة قبل إرسال الطلب.",
      change_booking:
        "افتح طلباتي لمراجعة الحجز. يعتمد التعديل على حالة الرحلة وموعدها؛ تواصل مع فريقنا إذا لم يظهر خيار التعديل.",
      cancel_booking:
        "افتح طلباتي واختر الحجز لاستخدام خيار الإلغاء عند توفره. يخضع الاسترداد لسياسة الإلغاء الموضحة للحجز.",
      trip_status:
        "افتح رحلاتي أو طلباتي للاطلاع على أحدث حالة. تظهر بيانات السائق بعد تعيينه.",
      driver_late:
        "راجع موعد الانطلاق في تفاصيل الرحلة. إذا لم يصل السائق، تواصل مع الدعم واذكر تفاصيل الرحلة.",
      lost_item:
        "تواصل مع الدعم واذكر تاريخ الرحلة ومسارها ووصف الغرض. لا ترسل بيانات الدفع الحساسة.",
      payment_status:
        "تظهر حالة الدفع في طلباتي. إذا كان الدفع قيد المعالجة، حدّث الصفحة بعد بضع دقائق.",
      refund:
        "تعتمد أهلية الاسترداد على الحجز وسياسة الإلغاء. أرسل تاريخ الحجز إلى فريقنا لمراجعته.",
      payment_failed:
        "تحقق من وسيلة الدفع ثم أعد المحاولة من طلباتي. إذا تم خصم المبلغ وما زال الحجز غير مدفوع، تواصل مع الدعم.",
      login:
        "استخدم خيار نسيت كلمة المرور في صفحة تسجيل الدخول. يمكن لفريقنا مساعدتك إذا لم يعد بإمكانك الوصول إلى هاتفك أو بريدك المسجل.",
      profile: "افتح الملف الشخصي لمراجعة البيانات المتاحة في حسابك وتحديثها.",
      verification:
        "اتبع خطوات التحقق الظاهرة في حسابك. إذا بقي التحقق معلقًا، تواصل مع فريقنا.",
      urgent_safety:
        "إذا كنت في خطر فوري، اتصل بخدمات الطوارئ المحلية الآن. وبخصوص مشكلة سلامة مرتبطة برحلة، تواصل مع الدعم عندما يصبح ذلك آمنًا.",
      report_safety:
        "تواصل مع فريقنا واذكر تاريخ الرحلة ووصفًا مختصرًا. إذا كان هناك خطر فوري، اتصل بالطوارئ أولًا.",
      other_question: "يمكنني توصيلك بفريق خدمة العملاء لمساعدتك في سؤالك.",
    },
    helpful: "تم حل المشكلة",
    contact: "التواصل مع خدمة العملاء",
    restart: "يسعدني أنني ساعدتك. كيف يمكنني مساعدتك أيضًا؟",
    handoff:
      "سأوصلك بخدمة العملاء. اكتب اسمك وبريدك الإلكتروني ووصفًا مختصرًا كي يتمكن الفريق من متابعتك.",
  },
} as const;

function asOptions(entries: readonly (readonly [string, string])[]): SupportOption[] {
  return entries.map(([id, label]) => ({ id, label }));
}

export function getInitialSupportStep(locale: SupportLocale): SupportBotStep {
  const copy = COPY[locale];
  return {
    nodeId: "start",
    category: "other",
    message: copy.welcome,
    options: CATEGORIES.map((id) => ({ id, label: copy.categories[id] })),
  };
}

export function advanceSupportStep(
  locale: SupportLocale,
  nodeId: string,
  choiceId: string,
): SupportBotStep | null {
  const copy = COPY[locale];

  if (nodeId === "start" && CATEGORIES.includes(choiceId as SupportCategory)) {
    const category = choiceId as SupportCategory;
    return {
      nodeId: category,
      category,
      message: copy.choose,
      options: asOptions(copy.options[category]),
    };
  }

  if (CATEGORIES.includes(nodeId as SupportCategory)) {
    const category = nodeId as SupportCategory;
    const answer = copy.answers[choiceId as keyof typeof copy.answers];
    if (!answer || !copy.options[category].some(([id]) => id === choiceId)) {
      return null;
    }
    return {
      nodeId: `answer:${choiceId}`,
      category,
      message: answer,
      options: [
        { id: "solved", label: copy.helpful },
        { id: "contact", label: copy.contact },
      ],
    };
  }

  if (nodeId.startsWith("answer:") && choiceId === "contact") {
    const category =
      CATEGORIES.find((candidate) =>
        copy.options[candidate].some(([id]) => `answer:${id}` === nodeId),
      ) ?? "other";
    return {
      nodeId: "handoff",
      category,
      message: copy.handoff,
      options: [],
      handoff: true,
    };
  }

  if (nodeId.startsWith("answer:") && choiceId === "solved") {
    return {
      ...getInitialSupportStep(locale),
      message: copy.restart,
    };
  }

  return null;
}

export function isSupportCategory(value: unknown): value is SupportCategory {
  return typeof value === "string" && CATEGORIES.includes(value as SupportCategory);
}
