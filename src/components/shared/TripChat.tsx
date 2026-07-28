"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getTripMessages, sendMessage, type ChatMessage } from "@/lib/api/chat";

interface TripChatProps {
  tripId: string;
  /** 'user' view shows "chat with driver", 'driver' view shows "chat with passenger" */
  role: "user" | "driver";
}

function formatTime(raw: string) {
  const d = new Date(raw);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function TripChat({ tripId, role }: TripChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await getTripMessages(tripId);
      const list = res.data ?? [];
      setMessages(list);
      setLoadError(null);
    } catch {
      setLoadError("Couldn't load messages. Try again.");
    }
  }, [tripId]);

  useEffect(() => {
    if (!open) return;
    fetchMessages();
    // Poll every 5 seconds for real-time feel
    pollRef.current = setInterval(fetchMessages, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  async function handleSend() {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    try {
      await sendMessage(tripId, msg);
      setText("");
      await fetchMessages();
    } catch {
      // ignore send error silently
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const btnLabel = role === "user" ? "Chat with driver" : "Chat with passenger";

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "12px 18px",
          background: "linear-gradient(135deg, #00C2A8 0%, #00A896 100%)",
          color: "#fff",
          border: "none",
          borderRadius: 14,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,194,168,0.25)",
        }}
      >
        <MessageIcon />
        {btnLabel}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(11,30,61,0.45)",
            zIndex: 1000,
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* Chat panel (bottom sheet) */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 560,
            height: "70vh",
            background: "#fff",
            borderRadius: "20px 20px 0 0",
            boxShadow: "0 -4px 32px rgba(11,30,61,0.15)",
            zIndex: 1001,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px 14px",
              borderBottom: "1px solid #F1F5F9",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: "#E0FAF6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#00C2A8",
                }}
              >
                <MessageIcon />
              </div>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 800,
                    color: "#0B1E3D",
                  }}
                >
                  {btnLabel}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "#9AA0A6" }}>
                  Trip #{tripId.slice(-6)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#F1F5F9",
                border: "none",
                cursor: "pointer",
                color: "#5A6A7A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 16px 8px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {loadError && (
              <p
                style={{ textAlign: "center", color: "#E74C3C", fontSize: 13 }}
              >
                {loadError}
              </p>
            )}
            {messages.length === 0 && !loadError && (
              <div
                style={{
                  textAlign: "center",
                  margin: "auto",
                  color: "#9AA0A6",
                }}
              >
                <p style={{ fontSize: 32, margin: "0 0 8px" }}>💬</p>
                <p style={{ fontSize: 13 }}>No messages yet. Say hello!</p>
              </div>
            )}
            {messages.map((msg) => {
              const isSelf = msg.is_mine;

              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isSelf ? "flex-end" : "flex-start",
                  }}
                >
                  {!isSelf && msg.sender?.name && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "#9AA0A6",
                        marginBottom: 2,
                        paddingInlineStart: 4,
                      }}
                    >
                      {msg.sender.name}
                    </span>
                  )}
                  <div
                    style={{
                      maxWidth: "78%",
                      padding: "9px 13px",
                      borderRadius: isSelf
                        ? "16px 16px 4px 16px"
                        : "16px 16px 16px 4px",
                      background: isSelf
                        ? "linear-gradient(135deg, #00C2A8 0%, #00A896 100%)"
                        : "#F1F5F9",
                      color: isSelf ? "#fff" : "#0B1E3D",
                      fontSize: 13,
                      lineHeight: 1.5,
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.message}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: "#B0B8C1",
                      marginTop: 3,
                      paddingInlineStart: 4,
                    }}
                  >
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div
            style={{
              padding: "10px 14px 14px",
              borderTop: "1px solid #F1F5F9",
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type a message…"
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 24,
                border: "1.5px solid #E2E8F0",
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
                background: "#F8F9FA",
                color: "#0B1E3D",
              }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!text.trim() || sending}
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background:
                  text.trim() && !sending
                    ? "linear-gradient(135deg, #00C2A8 0%, #00A896 100%)"
                    : "#E2E8F0",
                border: "none",
                cursor: text.trim() && !sending ? "pointer" : "default",
                color: text.trim() && !sending ? "#fff" : "#9AA0A6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.2s",
              }}
            >
              {sending ? (
                <span
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid rgba(255,255,255,0.4)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.6s linear infinite",
                  }}
                />
              ) : (
                <SendIcon />
              )}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
