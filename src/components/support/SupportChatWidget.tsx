"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCheck, Headset, MessageCircle, Send, X } from "lucide-react";
import { useClientLocale } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import type {
  SupportBotStep,
  SupportCategory,
} from "@/lib/support/decisionTree";

interface SupportChatWidgetProps {
  initialLocale: Locale;
}

interface SupportThread {
  id: string;
  accessToken: string | null;
}

interface SupportHistoryItem extends SupportThread {
  category: SupportCategory;
  status: "open" | "waiting" | "resolved";
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
  unreadCount: number;
}

interface SupportMessage {
  id: string;
  senderRole: "customer" | "admin" | "system";
  eventType?: "status_change" | null;
  status?: "open" | "waiting" | "resolved" | null;
  text: string;
  createdAt: string;
  isRead?: boolean;
}

interface FlowMessage {
  id: string;
  own: boolean;
  text: string;
}

const THREAD_STORAGE_KEY = "commuter-support-thread";

const COPY = {
  en: {
    open: "Open customer support chat",
    title: "Commuter support",
    subtitle: "Help with your ride, anytime",
    close: "Close support chat",
    loading: "Getting things ready…",
    loadError: "We couldn’t load support. Please try again.",
    sendError: "Your message could not be sent. Please try again.",
    startError: "We couldn’t start your support conversation. Please try again.",
    storageError: "This browser could not save your support session.",
    contactTitle: "Contact customer service",
    name: "Your name",
    email: "Email address",
    details: "How can we help?",
    start: "Start conversation",
    starting: "Connecting…",
    message: "Write a message…",
    send: "Send message",
    agentReply: "Customer service",
    connected: "Your message is with customer service. Replies will appear here.",
    network: "Connection interrupted. We’ll try again when you send a message.",
    history: "Your support history",
    newConversation: "Start a new conversation",
    noHistory: "Your support conversations will appear here.",
    unreadMessages: (count: number) => `${count} unread support message${count === 1 ? "" : "s"}`,
    statusChanged: {
      open: "Support marked this conversation as needing a reply.",
      waiting: "Customer service is waiting for your reply.",
      resolved: "Customer service marked this conversation as resolved.",
    },
    sent: "Sent",
    read: "Read",
    status: { open: "Needs reply", waiting: "Waiting", resolved: "Resolved" },
  },
  ar: {
    open: "فتح محادثة دعم العملاء",
    title: "دعم كوميوتر",
    subtitle: "مساعدة بشأن رحلتك في أي وقت",
    close: "إغلاق محادثة الدعم",
    loading: "جارٍ تجهيز المساعدة…",
    loadError: "تعذر تحميل الدعم. حاول مرة أخرى.",
    sendError: "تعذر إرسال رسالتك. حاول مرة أخرى.",
    startError: "تعذر بدء محادثة الدعم. حاول مرة أخرى.",
    storageError: "تعذر حفظ جلسة الدعم في هذا المتصفح.",
    contactTitle: "التواصل مع خدمة العملاء",
    name: "الاسم",
    email: "البريد الإلكتروني",
    details: "كيف يمكننا مساعدتك؟",
    start: "بدء المحادثة",
    starting: "جارٍ الاتصال…",
    message: "اكتب رسالة…",
    send: "إرسال الرسالة",
    agentReply: "خدمة العملاء",
    connected: "وصلت رسالتك إلى خدمة العملاء. ستظهر الردود هنا.",
    network: "انقطع الاتصال. سنحاول مجددًا عند إرسال رسالة.",
    history: "سجل محادثات الدعم",
    newConversation: "بدء محادثة جديدة",
    noHistory: "ستظهر محادثات الدعم هنا.",
    unreadMessages: (count: number) => `${count} رسالة دعم غير مقروءة`,
    statusChanged: {
      open: "تم تحديث حالة المحادثة إلى بانتظار رد فريق الدعم.",
      waiting: "خدمة العملاء بانتظار ردك.",
      resolved: "تم وضع علامة الحل على هذه المحادثة من خدمة العملاء.",
    },
    sent: "تم الإرسال",
    read: "تمت القراءة",
    status: { open: "بانتظار الرد", waiting: "بانتظارك", resolved: "تم الحل" },
  },
} as const;

function isSupportThread(value: unknown): value is SupportThread {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    (item.accessToken === null || typeof item.accessToken === "string")
  );
}

function restoreSupportThread(
  storageError: string,
): { thread: SupportThread | null; error: string } {
  if (typeof window === "undefined") return { thread: null, error: "" };
  try {
    const saved = sessionStorage.getItem(THREAD_STORAGE_KEY);
    if (!saved) return { thread: null, error: "" };
    const parsed: unknown = JSON.parse(saved);
    if (isSupportThread(parsed)) return { thread: parsed, error: "" };
    sessionStorage.removeItem(THREAD_STORAGE_KEY);
    return { thread: null, error: storageError };
  } catch {
    return { thread: null, error: storageError };
  }
}

export default function SupportChatWidget({
  initialLocale,
}: SupportChatWidgetProps) {
  const pathname = usePathname();
  const { locale, dir } = useClientLocale(initialLocale);
  const text = COPY[locale];
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<SupportBotStep | null>(null);
  const [stepLocale, setStepLocale] = useState<Locale | null>(null);
  const [flowMessages, setFlowMessages] = useState<FlowMessage[]>([]);
  const [category, setCategory] = useState<SupportCategory>("other");
  const [restoredThread] = useState(() => restoreSupportThread(text.storageError));
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [history, setHistory] = useState<SupportHistoryItem[]>([]);
  const [historyMode, setHistoryMode] = useState<"unknown" | "guest" | "user">(
    "unknown",
  );
  const [guestThread, setGuestThread] = useState<SupportThread | null>(
    restoredThread.thread?.accessToken ? restoredThread.thread : null,
  );
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState(restoredThread.error);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const newConversationSelected = useRef(false);

  const threadHeaders = useCallback(
    (current: SupportThread) => ({
      ...(current.accessToken
        ? { "x-support-access-token": current.accessToken }
        : {}),
    }),
    [],
  );

  const loadMessages = useCallback(
    async (current: SupportThread) => {
      const response = await fetch(
        `/api/support/conversations/${encodeURIComponent(current.id)}/messages`,
        {
          headers: threadHeaders(current),
          cache: "no-store",
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result.error === "string" ? result.error : text.loadError,
        );
      }
      setMessages(result.data);
      setError("");
    },
    [text.loadError, threadHeaders],
  );

  const loadHistory = useCallback(async () => {
    const response = await fetch("/api/support/conversations", {
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(
        typeof result.error === "string" ? result.error : text.loadError,
      );
    }

    if (result.mode === "user") {
      const ownHistory = result.data as SupportHistoryItem[];
      setHistoryMode("user");
      setHistory(ownHistory);
      if (typeof result.customer?.name === "string") {
        setContactName((current) => current || result.customer.name);
      }
      if (typeof result.customer?.email === "string") {
        setContactEmail((current) => current || result.customer.email);
      }
      if (
        !newConversationSelected.current &&
        (!thread || !ownHistory.some((item) => item.id === thread.id))
      ) {
        setMessages([]);
        setStep(null);
        setStepLocale(null);
        setFlowMessages([]);
        setThread(ownHistory[0] ?? null);
      }
      try {
        sessionStorage.removeItem(THREAD_STORAGE_KEY);
      } catch {
        setError(text.storageError);
      }
      return;
    }

    setHistoryMode("guest");
    setHistory([]);
    if (!thread?.accessToken) {
      if (thread) setMessages([]);
      setThread(guestThread);
    } else if (thread.id !== guestThread?.id) {
      setThread(guestThread);
    }
  }, [guestThread, text.loadError, text.storageError, thread]);

  useEffect(() => {
    if (!open || historyMode === "unknown" || thread || (step && stepLocale === locale)) return;
    let cancelled = false;
    fetch(`/api/support/chatbot?locale=${locale}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(text.loadError);
        if (!cancelled) {
          setStep(result);
          setStepLocale(locale);
          setCategory(result.category);
          setFlowMessages([{ id: "welcome", own: false, text: result.message }]);
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled) setError(text.loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [historyMode, locale, open, step, stepLocale, text.loadError, thread]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const refreshHistory = async () => {
      try {
        await loadHistory();
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : text.loadError);
        }
      }
    };
    const initialLoad = window.setTimeout(() => void refreshHistory(), 0);
    const onFocus = () => void refreshHistory();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearTimeout(initialLoad);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadHistory, open, text.loadError]);

  useEffect(() => {
    if (
      !open ||
      !thread ||
      historyMode === "unknown" ||
      (historyMode === "user" &&
        !history.some((item) => item.id === thread.id)) ||
      (historyMode === "guest" && !thread.accessToken)
    ) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        await loadMessages(thread);
      } catch {
        if (!cancelled) setError(text.network);
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [history, historyMode, loadMessages, open, text.network, thread]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, step]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, thread]);

  useEffect(() => {
    if (
      pathname.startsWith("/admin") ||
      /^\/(eg|sa|ae)\/admin(?:\/|$)/.test(pathname)
    ) {
      return;
    }
    let cancelled = false;
    const refreshUnread = async () => {
      const guest = thread?.accessToken ? thread : guestThread;
      const url = guest
        ? `/api/support/unread?conversationId=${encodeURIComponent(guest.id)}`
        : "/api/support/unread";
      try {
        const response = await fetch(url, {
          headers: guest?.accessToken
            ? { "x-support-access-token": guest.accessToken }
            : {},
          cache: "no-store",
        });
        const result = await response.json();
        if (response.ok && !cancelled && typeof result.unreadCount === "number") {
          setUnreadCount(result.unreadCount);
        }
      } catch {
        // Keep the latest known count while temporarily offline.
      }
    };
    const interval = window.setInterval(() => void refreshUnread(), 15_000);
    window.addEventListener("focus", refreshUnread);
    void refreshUnread();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshUnread);
    };
  }, [guestThread, pathname, thread]);

  if (
    pathname.startsWith("/admin") ||
    /^\/(eg|sa|ae)\/admin(?:\/|$)/.test(pathname)
  ) {
    return null;
  }

  async function chooseOption(option: { id: string; label: string }) {
    if (!step || stepLocale !== locale || loading) return;
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/support/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          nodeId: step.nodeId,
          choiceId: option.id,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result.error === "string" ? result.error : text.loadError,
        );
      }
      setStep(result);
      setStepLocale(locale);
      setCategory(result.category);
      setFlowMessages((current) => [
        ...current,
        { id: `choice-${Date.now()}`, own: true, text: option.label },
        { id: `reply-${Date.now()}`, own: false, text: result.message },
      ]);
      if (result.handoff) setContactMessage("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError);
    } finally {
      setLoading(false);
    }
  }

  async function startConversation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/support/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          contactName,
          contactEmail,
          message: contactMessage,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result.error === "string" ? result.error : text.startError,
        );
      }
      const nextThread: SupportThread = result.data;
      newConversationSelected.current = false;
      setThread(nextThread);
      if (nextThread.accessToken) {
        setGuestThread(nextThread);
        try {
          sessionStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(nextThread));
        } catch {
          setError(text.storageError);
        }
      }
      await loadMessages(nextThread);
      if (!nextThread.accessToken) await loadHistory();
      setContactMessage("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.startError);
    } finally {
      setLoading(false);
    }
  }

  async function sendCustomerMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = messageDraft.trim();
    if (!thread || !message || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/support/conversations/${encodeURIComponent(thread.id)}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...threadHeaders(thread),
          },
          body: JSON.stringify({ text: message }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result.error === "string" ? result.error : text.sendError,
        );
      }
      setMessageDraft("");
      await loadMessages(thread);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.sendError);
    } finally {
      setSending(false);
    }
  }

  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }

    newConversationSelected.current = false;
    setHistoryMode("unknown");
    setHistory([]);
    setMessages([]);
    setThread(null);
    setError("");
    setOpen(true);
  }

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 1100,
    insetInlineEnd: 16,
    bottom: 84,
    width: "min(400px, calc(100vw - 24px))",
    height: "min(640px, calc(100dvh - 112px))",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    border: "1px solid var(--color-border)",
    borderRadius: 20,
    background: "var(--color-panel)",
    color: "var(--color-primary)",
    boxShadow: "0 18px 60px rgba(11, 30, 61, 0.24)",
  };

  const canShowThread =
    historyMode === "user"
      ? !!thread && history.some((item) => item.id === thread.id)
      : historyMode === "guest" && !!thread?.accessToken;

  return (
    <>
      {open ? (
        <section
          dir={dir}
          role="dialog"
          aria-modal="false"
          aria-label={text.title}
          style={panelStyle}
          className="support-chat-panel-enter"
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              background: "var(--color-primary)",
              color: "#fff",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "grid",
                width: 42,
                height: 42,
                placeItems: "center",
                borderRadius: 14,
                background: "rgba(0,194,168,0.2)",
                color: "var(--color-secondary)",
              }}
            >
              <Headset size={22} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: 15 }}>
                {text.title}
              </strong>
              <span style={{ fontSize: 12, opacity: 0.78 }}>
                {canShowThread ? text.connected : text.subtitle}
              </span>
            </div>
            <button
              type="button"
              aria-label={text.close}
              onClick={() => setOpen(false)}
              style={iconButtonStyle}
            >
              <X size={19} aria-hidden="true" />
            </button>
          </header>

          <div
            ref={scrollRef}
            aria-live="polite"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              padding: 16,
              background: "var(--color-surface)",
            }}
          >
            {historyMode === "unknown" ? (
              <p style={{ color: "var(--color-muted)", fontSize: 14 }}>
                {text.loading}
              </p>
            ) : canShowThread ? (
              <div style={{ display: "grid", gap: 10 }}>
                {historyMode === "user" && history.length ? (
                  <div
                    aria-label={text.history}
                    style={{
                      display: "grid",
                      gap: 7,
                      marginBottom: 8,
                      paddingBottom: 12,
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    <strong style={{ fontSize: 12 }}>{text.history}</strong>
                    {history.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={thread?.id === item.id ? "page" : undefined}
                        onClick={() => {
                          newConversationSelected.current = false;
                          setThread({ id: item.id, accessToken: null });
                          setMessages([]);
                          setError("");
                        }}
                        style={{
                          minHeight: 44,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          padding: "8px 10px",
                          border: "1px solid var(--color-border)",
                          borderRadius: 10,
                          background:
                            thread?.id === item.id
                              ? "var(--color-secondary-tint)"
                              : "var(--color-panel)",
                          color: "var(--color-primary)",
                          textAlign: "start",
                          font: "inherit",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.lastMessage}
                        </span>
                        <span style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 6 }}>
                          {item.unreadCount > 0 ? (
                            <span className="support-chat-history-unread">
                              {item.unreadCount > 99 ? "99+" : item.unreadCount}
                            </span>
                          ) : null}
                          <span style={{ color: "var(--color-muted)" }}>
                            {text.status[item.status]}
                          </span>
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        newConversationSelected.current = true;
                        setThread(null);
                        setMessages([]);
                        setStep(null);
                        setStepLocale(null);
                        setFlowMessages([]);
                        setCategory("other");
                        setError("");
                      }}
                      style={choiceButtonStyle}
                    >
                      {text.newConversation}
                    </button>
                  </div>
                ) : null}
                {messages.map((message) => {
                  const own = message.senderRole === "customer";
                  if (
                    message.eventType === "status_change" &&
                    message.status
                  ) {
                    return (
                      <p key={message.id} className="support-chat-status-notice">
                        {text.statusChanged[message.status]}
                      </p>
                    );
                  }
                  return (
                    <div
                      key={message.id}
                      className="support-chat-message-enter"
                      style={{
                        justifySelf: own ? "end" : "start",
                        maxWidth: "88%",
                        padding: "10px 12px",
                        borderRadius: own ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        background: own
                          ? "var(--color-primary)"
                          : "var(--color-panel)",
                        color: own ? "#fff" : "var(--color-primary)",
                        fontSize: 14,
                        lineHeight: 1.55,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {!own ? (
                        <strong
                          style={{
                            display: "block",
                            marginBottom: 3,
                            color: "var(--color-secondary)",
                            fontSize: 11,
                          }}
                        >
                          {text.agentReply}
                        </strong>
                      ) : null}
                      {message.text}
                      {own ? (
                        <span
                          className={`support-chat-read-receipt${message.isRead ? " is-read" : ""}`}
                          aria-label={message.isRead ? text.read : text.sent}
                          title={message.isRead ? text.read : text.sent}
                        >
                          <CheckCheck size={14} aria-hidden="true" />
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 10 }}>
                  {flowMessages.map((message) => (
                    <div
                      key={message.id}
                      style={{
                        justifySelf: message.own ? "end" : "start",
                        maxWidth: "90%",
                        padding: "11px 13px",
                        borderRadius: message.own
                          ? "14px 14px 4px 14px"
                          : "14px 14px 14px 4px",
                        background: message.own
                          ? "var(--color-primary)"
                          : "var(--color-panel)",
                        color: message.own ? "#fff" : "var(--color-primary)",
                        fontSize: 14,
                        lineHeight: 1.55,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {message.text}
                    </div>
                  ))}
                </div>
                {stepLocale === locale && step?.options.length ? (
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      marginTop: 14,
                    }}
                  >
                    {step.options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={loading}
                        onClick={() => void chooseOption(option)}
                        style={choiceButtonStyle}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {stepLocale === locale && step?.handoff ? (
                  <form
                    onSubmit={(event) => void startConversation(event)}
                    style={{
                      display: "grid",
                      gap: 9,
                      marginTop: 14,
                      padding: 12,
                      border: "1px solid var(--color-border)",
                      borderRadius: 14,
                      background: "var(--color-panel)",
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>{text.contactTitle}</strong>
                    <label style={labelStyle}>
                      {text.name}
                      <input
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={100}
                        value={contactName}
                        onChange={(event) => setContactName(event.target.value)}
                        style={fieldStyle}
                      />
                    </label>
                    <label style={labelStyle}>
                      {text.email}
                      <input
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                        value={contactEmail}
                        onChange={(event) => setContactEmail(event.target.value)}
                        style={fieldStyle}
                      />
                    </label>
                    <label style={labelStyle}>
                      {text.details}
                      <textarea
                        required
                        maxLength={2000}
                        rows={3}
                        value={contactMessage}
                        onChange={(event) =>
                          setContactMessage(event.target.value)
                        }
                        style={{ ...fieldStyle, resize: "vertical" }}
                      />
                    </label>
                    <button type="submit" disabled={loading} style={primaryButtonStyle}>
                      {loading ? text.starting : text.start}
                    </button>
                  </form>
                ) : null}
                {!step || stepLocale !== locale ? (
                  <p style={{ color: "var(--color-muted)", fontSize: 14 }}>
                    {text.loading}
                  </p>
                ) : null}
              </>
            )}
            {error ? (
              <p role="alert" style={{ color: "var(--color-danger)", fontSize: 13 }}>
                {error}
              </p>
            ) : null}
          </div>

          {canShowThread ? (
            <form
              onSubmit={(event) => void sendCustomerMessage(event)}
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                padding: 12,
                borderTop: "1px solid var(--color-border)",
                background: "var(--color-panel)",
              }}
            >
              <textarea
                ref={inputRef}
                aria-label={text.message}
                placeholder={text.message}
                value={messageDraft}
                maxLength={2000}
                rows={1}
                onChange={(event) => setMessageDraft(event.target.value)}
                style={{ ...fieldStyle, flex: 1, resize: "vertical" }}
              />
              <button
                type="submit"
                aria-label={text.send}
                disabled={sending || !messageDraft.trim()}
                style={primaryIconButtonStyle}
              >
                <Send size={17} aria-hidden="true" />
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `${text.open}. ${text.unreadMessages(unreadCount)}`
            : text.open
        }
        aria-expanded={open}
        onClick={toggleOpen}
        className="support-chat-launcher"
        style={{
          position: "fixed",
          zIndex: 1100,
          insetInlineEnd: 18,
          bottom: 18,
          display: "grid",
          width: 58,
          height: 58,
          placeItems: "center",
          border: 0,
          borderRadius: "50%",
          background: "var(--color-secondary)",
          color: "var(--color-primary)",
          boxShadow: "0 8px 24px rgba(11, 30, 61, 0.22)",
          cursor: "pointer",
        }}
      >
        {open ? <X size={23} aria-hidden="true" /> : <MessageCircle size={23} aria-hidden="true" />}
        {unreadCount > 0 ? (
          <span
            className="support-chat-unread-badge"
            aria-live="polite"
            aria-atomic="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
    </>
  );
}

const iconButtonStyle: React.CSSProperties = {
  display: "grid",
  width: 44,
  height: 44,
  flex: "0 0 44px",
  placeItems: "center",
  border: "1px solid rgba(255,255,255,0.28)",
  borderRadius: 12,
  background: "transparent",
  color: "#fff",
  cursor: "pointer",
};

const choiceButtonStyle: React.CSSProperties = {
  minHeight: 44,
  padding: "9px 12px",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  background: "var(--color-panel)",
  color: "var(--color-primary)",
  textAlign: "start",
  font: "inherit",
  fontSize: 13,
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  fontSize: 12,
  fontWeight: 700,
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "9px 11px",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  background: "var(--color-panel)",
  color: "var(--color-primary)",
  font: "inherit",
  fontSize: 14,
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 44,
  padding: "10px 14px",
  border: 0,
  borderRadius: 11,
  background: "var(--color-secondary)",
  color: "var(--color-primary)",
  font: "inherit",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const primaryIconButtonStyle: React.CSSProperties = {
  display: "grid",
  width: 46,
  height: 46,
  flex: "0 0 46px",
  placeItems: "center",
  border: 0,
  borderRadius: 12,
  background: "var(--color-secondary)",
  color: "var(--color-primary)",
  cursor: "pointer",
};
