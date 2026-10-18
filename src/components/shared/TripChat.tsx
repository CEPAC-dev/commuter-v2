"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatRequestError, getChatUnreadCounts, getTripMessages, markTripChatRead, sendMessage, submitChatReport, type ChatMessage } from "@/lib/api/chat";
import { useClientLocale } from "@/lib/i18n/client";
import { translate } from "@/lib/i18n";

interface TripChatProps {
  tripId: string;
  role: "user" | "driver";
  triggerLabel?: string;
  passengerNumber?: number;
}

const PASSENGER_PRESETS = [
  "on_my_way",
  "at_pickup",
  "running_late",
  "cant_see_you",
  "thanks",
] as const;
const DRIVER_PRESETS = [
  "arrived",
  "running_late_2",
  "running_late_5",
  "where_are_you",
  "cant_find_you",
  "waiting",
  "starting_now",
] as const;

function formatTime(raw: string, locale: string) {
  return new Date(raw).toLocaleTimeString(locale === "ar" ? "ar-EG" : "en-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function TripChat({
  tripId,
  role,
  triggerLabel,
  passengerNumber,
}: TripChatProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [freeTextEnabled, setFreeTextEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabVisible, setTabVisible] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportConfirm, setReportConfirm] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportSending, setReportSending] = useState(false);
  const [reportReason, setReportReason] = useState<"abuse" | "contact_sharing" | "harassment" | "other">("abuse");
  const [reportNote, setReportNote] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMessageId = useRef<string | undefined>(undefined);
  const { t, dir, locale } = useClientLocale();
  const presets = role === "driver" ? DRIVER_PRESETS : PASSENGER_PRESETS;
  const title =
    triggerLabel ??
    (role === "user" ? t("chat.with_driver") : t("chat.with_passenger"));

  const applySnapshot = useCallback(
    (snapshot: Awaited<ReturnType<typeof getTripMessages>>, initial: boolean) => {
      setServerOpen(snapshot.open);
      setCanWrite(snapshot.canWrite);
      setFreeTextEnabled(snapshot.freeTextAllowed);
      setReady(true);
      setError(null);
      setMessages((current) => {
        const next = initial ? snapshot.messages : [...current, ...snapshot.messages];
        const unique = Array.from(new Map(next.map((message) => [message.id, message])).values());
        lastMessageId.current = unique.at(-1)?.id;
        return unique;
      });
    },
    [],
  );

  const refresh = useCallback(
    async (initial = false) => {
      try {
        const snapshot = await getTripMessages(
          tripId,
          initial ? undefined : lastMessageId.current,
        );
        applySnapshot(snapshot, initial);
      } catch (cause) {
        if (cause instanceof ChatRequestError && cause.code === "CHAT_CLOSED") {
          setServerOpen(false);
          setCanWrite(false);
          setReady(true);
          setError(t("chat.closed"));
          return;
        }
        setServerOpen(false);
        setCanWrite(false);
        setReady(true);
        setError(t("chat.load_error"));
      }
    },
    [applySnapshot, t, tripId],
  );

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  useEffect(() => {
    const updateVisibility = () => setTabVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (!panelOpen || !serverOpen || !tabVisible) return;
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [panelOpen, refresh, serverOpen, tabVisible]);

  useEffect(() => {
    if (!serverOpen || !tabVisible || panelOpen) {
      return;
    }
    let cancelled = false;
    const updateUnread = async () => {
      try {
        const counts = await getChatUnreadCounts([tripId]);
        if (!cancelled) setUnreadCount(counts[tripId] ?? 0);
      } catch {
        if (!cancelled) setUnreadCount(0);
      }
    };
    void updateUnread();
    const timer = setInterval(() => void updateUnread(), 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [panelOpen, serverOpen, tabVisible, tripId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const latestMessageId = messages.at(-1)?.id;
  useEffect(() => {
    if (!panelOpen || !tabVisible || !serverOpen) return;
    void markTripChatRead(tripId).catch(() => {
      setError(t("chat.mark_read_error"));
    });
  }, [latestMessageId, panelOpen, serverOpen, t, tabVisible, tripId]);

  useEffect(() => {
    if (panelOpen && freeTextEnabled) inputRef.current?.focus();
  }, [freeTextEnabled, panelOpen]);

  const handleSend = async (
    body: { kind: "text"; text: string } | { kind: "preset"; presetKey: string },
  ) => {
    if (!canWrite || !serverOpen || sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await sendMessage(tripId, body);
      setMessages((current) => {
        const next = [...current.filter((message) => message.id !== result.message.id), result.message];
        lastMessageId.current = next.at(-1)?.id;
        return next;
      });
      if (body.kind === "text") setText("");
    } catch (cause) {
      if (cause instanceof ChatRequestError && cause.code === "CHAT_CLOSED") {
        setServerOpen(false);
        setCanWrite(false);
        setError(t("chat.closed"));
      } else if (cause instanceof ChatRequestError && cause.code === "FREE_TEXT_DISABLED") {
        setFreeTextEnabled(false);
        setError(t("chat.free_text_disabled"));
      } else if (cause instanceof ChatRequestError && cause.code === "CONTACT_INFO_BLOCKED") {
        setError(t("chat.contact_info_blocked"));
      } else if (cause instanceof ChatRequestError && cause.code === "FREE_TEXT_SUSPENDED") {
        setFreeTextEnabled(false);
        setError(t("chat.free_text_suspended"));
      } else {
        setError(t("chat.send_error"));
      }
    } finally {
      setSending(false);
    }
  };

  const handleKey = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend({ kind: "text", text });
    }
  };

  const handleReport = async () => {
    if (reportSending) return;
    setReportSending(true);
    setReportError(null);
    try {
      await submitChatReport(tripId, {
        reason: reportReason,
        ...(reportNote.trim() ? { note: reportNote.trim() } : {}),
      });
      setReportSubmitted(true);
      setReportConfirm(false);
      setReportOpen(false);
    } catch (cause) {
      if (cause instanceof ChatRequestError && cause.code === "CHAT_CLOSED") {
        setServerOpen(false);
        setCanWrite(false);
        setReportError(t("chat.closed"));
      } else if (cause instanceof ChatRequestError && cause.code === "ALREADY_REPORTED") {
        setReportError(t("chat.report_already_submitted"));
      } else if (cause instanceof ChatRequestError && cause.code === "CHAT_REPORT_RATE_LIMITED") {
        setReportError(t("chat.report_rate_limited"));
      } else {
        setReportError(t("chat.report_error"));
      }
    } finally {
      setReportSending(false);
    }
  };

  return (
    <>
      {!ready ? (
        <p role="status" style={{ margin: 0, color: "#5A6A7A", fontSize: 12 }}>
          {t("chat.checking")}
        </p>
      ) : !serverOpen ? (
        <p role="status" style={{ margin: 0, color: "#5A6A7A", fontSize: 12 }}>
          {error ?? t("chat.closed")}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => {
            setUnreadCount(0);
            setPanelOpen(true);
          }}
          aria-label={title}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: triggerLabel ? "auto" : "100%",
            minHeight: triggerLabel ? 46 : 48,
            padding: "10px 16px",
            background: "linear-gradient(135deg, #00C2A8 0%, #00A896 100%)",
            color: "#fff",
            border: 0,
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <MessageIcon />
          {title}
          {unreadCount > 0 && (
            <span
              role="status"
              aria-label={t("chat.unread_aria", { count: unreadCount })}
              style={{
                display: "inline-flex",
                minWidth: 22,
                height: 22,
                padding: "0 6px",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                background: "#F5A623",
                color: "#0B1E3D",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {panelOpen && (
        <div
          onClick={() => setPanelOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(11,30,61,0.45)", zIndex: 1000 }}
        />
      )}
      {panelOpen && (
        <section
          dir={dir}
          aria-label={title}
          style={{
            position: "fixed",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 560,
            height: "75vh",
            background: "#fff",
            borderRadius: "20px 20px 0 0",
            boxShadow: "0 -4px 32px rgba(11,30,61,0.15)",
            zIndex: 1001,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <header style={{ padding: "14px 18px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ color: "#0B1E3D" }}>{title}</strong>
            <button type="button" onClick={() => setPanelOpen(false)} aria-label={t("chat.close")} style={{ minWidth: 44, minHeight: 44, border: 0, borderRadius: 12, background: "#F1F5F9", fontSize: 20, cursor: "pointer" }}>×</button>
          </header>
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.length === 0 && <p style={{ textAlign: "center", color: "#7A8794" }}>{t("chat.no_messages")}</p>}
            {messages.map((message) => {
              const senderLabel = message.senderRole === "driver"
                ? t("chat.driver_label")
                : role === "driver"
                  ? t("chat.passenger_label", { n: passengerNumber ?? 1 })
                  : message.isMine
                    ? t("chat.you")
                    : t("chat.passenger_label", { n: passengerNumber ?? 1 });
              const messageText = message.kind === "preset" && message.presetKey
                ? translate(locale, `chat.preset.${message.presetKey}`)
                : message.text;
              return (
                <div key={message.id} style={{ alignSelf: message.isMine ? "flex-end" : "flex-start", maxWidth: "88%" }}>
                  <span style={{ display: "block", marginBottom: 3, paddingInlineStart: 4, fontSize: 11, color: "#75808A" }}>{senderLabel}</span>
                  <div style={{ padding: "10px 14px", borderRadius: 14, background: message.isMine ? "#00A896" : "#F1F5F9", color: message.isMine ? "#fff" : "#0B1E3D", fontSize: 14, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                    {messageText}
                  </div>
                  <time style={{ display: "block", marginTop: 3, fontSize: 10, color: "#9AA0A6" }}>{formatTime(message.createdAt, locale)}</time>
                </div>
              );
            })}
          </div>
          {error && <p role="alert" style={{ margin: "0 14px 8px", color: "#B42318", fontSize: 12 }}>{error}</p>}
          {serverOpen && canWrite && (
            <div style={{ padding: "10px 12px 14px", borderTop: "1px solid #F1F5F9", display: "flex", flexDirection: "column", gap: 9, maxHeight: "38vh", overflowY: "auto" }}>
              {reportSubmitted ? (
                <p role="status" style={{ margin: 0, color: "#26734D", fontSize: 13 }}>
                  {t("chat.report_submitted")}
                </p>
              ) : reportOpen ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {reportConfirm ? (
                    <>
                      <p style={{ margin: 0, color: "#0B1E3D", fontSize: 13 }}>{t("chat.report_confirm")}</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" disabled={reportSending} onClick={() => setReportConfirm(false)} style={{ minHeight: 44, padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 10, background: "#fff", cursor: "pointer" }}>{t("chat.report_edit")}</button>
                        <button type="button" disabled={reportSending} onClick={() => void handleReport()} style={{ minHeight: 44, padding: "8px 12px", border: 0, borderRadius: 10, background: "#B42318", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{reportSending ? t("chat.report_sending") : t("chat.report_confirm_action")}</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#5A6A7A" }}>
                        {t("chat.report_reason")}
                        <select value={reportReason} onChange={(event) => setReportReason(event.target.value as typeof reportReason)} style={{ minHeight: 44, border: "1px solid #CBD5E1", borderRadius: 10, padding: "8px 10px", font: "inherit" }}>
                          {(["abuse", "contact_sharing", "harassment", "other"] as const).map((reason) => (
                            <option key={reason} value={reason}>{t(`chat.report_reason.${reason}`)}</option>
                          ))}
                        </select>
                      </label>
                      <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#5A6A7A" }}>
                        {t("chat.report_note")}
                        <textarea maxLength={300} value={reportNote} onChange={(event) => setReportNote(event.target.value)} rows={3} style={{ border: "1px solid #CBD5E1", borderRadius: 10, padding: 10, resize: "vertical", font: "inherit" }} />
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => { setReportOpen(false); setReportError(null); }} style={{ minHeight: 44, padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 10, background: "#fff", cursor: "pointer" }}>{t("chat.report_cancel")}</button>
                        <button type="button" onClick={() => { setReportConfirm(true); setReportError(null); }} style={{ minHeight: 44, padding: "8px 12px", border: 0, borderRadius: 10, background: "#B42318", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{t("chat.report_review")}</button>
                      </div>
                    </>
                  )}
                  {reportError && <p role="alert" style={{ margin: 0, color: "#B42318", fontSize: 12 }}>{reportError}</p>}
                </div>
              ) : (
                <button type="button" onClick={() => { setReportOpen(true); setReportError(null); }} style={{ alignSelf: "flex-start", minHeight: 40, padding: "7px 12px", border: "1px solid #F1B8B4", borderRadius: 10, background: "#FFF8F7", color: "#B42318", fontWeight: 700, cursor: "pointer" }}>{t("chat.report")}</button>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                {presets.map((presetKey) => (
                  <button
                    key={presetKey}
                    type="button"
                    disabled={sending}
                    onClick={() => void handleSend({ kind: "preset", presetKey })}
                    style={{ minHeight: 48, padding: "8px 10px", border: "1px solid #D6E4E3", borderRadius: 12, background: "#F3FBFA", color: "#0B1E3D", fontSize: 13, fontWeight: 700, cursor: sending ? "wait" : "pointer" }}
                  >
                    {t(`chat.preset.${presetKey}`)}
                  </button>
                ))}
              </div>
              {freeTextEnabled ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input ref={inputRef} type="text" maxLength={500} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={handleKey} placeholder={t("chat.type_placeholder")} style={{ flex: 1, minWidth: 0, padding: "11px 14px", borderRadius: 24, border: "1.5px solid #E2E8F0", fontSize: 14 }} />
                  <button type="button" onClick={() => void handleSend({ kind: "text", text })} disabled={!text.trim() || sending} style={{ minWidth: 48, minHeight: 48, border: 0, borderRadius: 24, background: "#00A896", color: "#fff", fontWeight: 800, cursor: "pointer" }}>{t("chat.send")}</button>
                </div>
              ) : null}
            </div>
          )}
          {!canWrite && serverOpen && (
            <p style={{ margin: 0, padding: 14, borderTop: "1px solid #F1F5F9", color: "#5A6A7A", fontSize: 13 }}>{t("chat.read_only")}</p>
          )}
          {!serverOpen && (
            <p role="status" style={{ margin: 0, padding: 14, borderTop: "1px solid #F1F5F9", color: "#5A6A7A", fontSize: 13 }}>{t("chat.closed")}</p>
          )}
        </section>
      )}
    </>
  );
}
