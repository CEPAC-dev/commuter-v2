"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CheckCheck, LoaderCircle, Send } from "lucide-react";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";

type ConversationStatus = "open" | "waiting" | "resolved";
type StatusFilter = "all" | ConversationStatus;

interface Conversation {
  id: string;
  contactName: string;
  contactEmail: string;
  category: string;
  status: ConversationStatus;
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
  unreadCount: number;
}

interface ThreadMessage {
  id: string;
  senderRole: "customer" | "admin" | "system";
  eventType?: "status_change" | null;
  status?: ConversationStatus | null;
  text: string;
  createdAt: string;
  isRead?: boolean;
}

interface ConversationDetail {
  conversation: Pick<
    Conversation,
    "id" | "contactName" | "contactEmail" | "category" | "status" | "createdAt"
  >;
  messages: ThreadMessage[];
}

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All conversations" },
  { id: "open", label: "Needs reply" },
  { id: "waiting", label: "Waiting for customer" },
  { id: "resolved", label: "Resolved" },
];

const STATUS_LABEL: Record<ConversationStatus, string> = {
  open: "Needs reply",
  waiting: "Waiting for customer",
  resolved: "Resolved",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SupportCenter() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [listError, setListError] = useState("");
  const [threadError, setThreadError] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/admin/support?status=${filter}`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Could not load support conversations.",
        );
      }
      setConversations(result.data);
      setUnreadCount(result.unreadCount ?? 0);
      setListError("");
      setSelectedId((current) =>
        current && result.data.some((item: Conversation) => item.id === current)
          ? current
          : (result.data[0]?.id ?? ""),
      );
    } catch (error) {
      setListError(
        error instanceof Error
          ? error.message
          : "Could not load support conversations.",
      );
    } finally {
      setLoadingList(false);
    }
  }, [filter]);

  const loadConversation = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const response = await fetch(`/api/admin/support/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Could not load this conversation.",
        );
      }
      setDetail(result.data);
      setThreadError("");
    } catch (error) {
      setThreadError(
        error instanceof Error
          ? error.message
          : "Could not load this conversation.",
      );
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadConversations(), 0);
    const interval = window.setInterval(() => void loadConversations(), 15000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    const initialLoad = window.setTimeout(
      () => void loadConversation(selectedId),
      0,
    );
    const interval = window.setInterval(
      () => void loadConversation(selectedId),
      8000,
    );
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadConversation, selectedId]);

  const selectedConversation =
    detail?.conversation.id === selectedId ? detail : null;

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!selectedId || !message || sending) return;
    setSending(true);
    setThreadError("");
    try {
      const response = await fetch(
        `/api/admin/support/${encodeURIComponent(selectedId)}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: message }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Could not send your reply.",
        );
      }
      setDraft("");
      await Promise.all([loadConversation(selectedId), loadConversations()]);
    } catch (error) {
      setThreadError(
        error instanceof Error ? error.message : "Could not send your reply.",
      );
    } finally {
      setSending(false);
    }
  }

  async function updateStatus(status: ConversationStatus) {
    if (!selectedId || !detail) return;
    setThreadError("");
    try {
      const response = await fetch(
        `/api/admin/support/${encodeURIComponent(selectedId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Could not update conversation status.",
        );
      }
      await Promise.all([
        loadConversation(selectedId),
        loadConversations(),
      ]);
    } catch (error) {
      setThreadError(
        error instanceof Error
          ? error.message
          : "Could not update conversation status.",
      );
    }
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Support center"
        description="Review customer handoffs, reply to messages, and resolve conversations."
      />
      <div className="support-center-grid">
        <section className="support-center-panel" aria-label="Support inbox">
          <div className="support-center-filters" role="group" aria-label="Filter conversations">
            {unreadCount > 0 ? (
              <span className="support-center-unread-total" aria-live="polite">
                {unreadCount > 99 ? "99+" : unreadCount} unread in this list
              </span>
            ) : null}
            {FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                aria-pressed={filter === id}
                className={`support-center-filter${filter === id ? " is-active" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
          {listError ? (
            <p role="alert" className="support-center-error">{listError}</p>
          ) : null}
          {loadingList && !conversations.length ? (
            <p className="support-center-empty">
              <LoaderCircle size={17} className="support-center-spin" aria-hidden="true" />
              Loading conversations…
            </p>
          ) : conversations.length ? (
            <div className="support-center-list">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedId(conversation.id)}
                  aria-current={selectedId === conversation.id ? "true" : undefined}
                  className={`support-center-conversation${selectedId === conversation.id ? " is-selected" : ""}`}
                >
                  <span className="support-center-conversation-top">
                    <strong>{conversation.contactName}</strong>
                    {conversation.unreadCount > 0 ? (
                      <span
                        className="support-center-unread-badge"
                        aria-label={`${conversation.unreadCount} unread messages`}
                      >
                        {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                      </span>
                    ) : null}
                    <span className={`support-center-status status-${conversation.status}`}>
                      {STATUS_LABEL[conversation.status]}
                    </span>
                  </span>
                  <span className="support-center-conversation-meta">
                    {conversation.category} · {formatDate(conversation.lastMessageAt)}
                  </span>
                  <span className="support-center-preview">{conversation.lastMessage}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="support-center-empty">
              No conversations here yet. New customer handoffs will appear in this inbox.
            </p>
          )}
        </section>

        <section className="support-center-panel" aria-label="Conversation details">
          {selectedConversation ? (
            <>
              <header className="support-center-thread-header">
                <div>
                  <h2>{selectedConversation.conversation.contactName}</h2>
                  <a href={`mailto:${selectedConversation.conversation.contactEmail}`}>
                    {selectedConversation.conversation.contactEmail}
                  </a>
                  <p>
                    {selectedConversation.conversation.category} · Opened{" "}
                    {formatDate(selectedConversation.conversation.createdAt)}
                  </p>
                </div>
                <div className="support-center-thread-actions">
                  <span
                    className={`support-center-status status-${selectedConversation.conversation.status}`}
                  >
                    {STATUS_LABEL[selectedConversation.conversation.status]}
                  </span>
                  {selectedConversation.conversation.status === "resolved" ? (
                    <button
                      type="button"
                      className="support-center-action"
                      onClick={() => void updateStatus("open")}
                    >
                      Reopen
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="support-center-action"
                      onClick={() => void updateStatus("resolved")}
                    >
                      <Check size={15} aria-hidden="true" />
                      Resolve
                    </button>
                  )}
                </div>
              </header>
              {threadError ? (
                <p role="alert" className="support-center-error">{threadError}</p>
              ) : null}
              <div className="support-center-messages" aria-live="polite">
                {selectedConversation.messages.map((message) => (
                    <article
                      key={message.id}
                      className={`support-center-message${message.senderRole === "admin" ? " is-admin" : ""}${message.senderRole === "system" ? " is-system" : ""}`}
                    >
                      {message.eventType === "status_change" && message.status ? (
                        <p>
                          Status changed: {STATUS_LABEL[message.status]}.
                        </p>
                      ) : (
                        <>
                          <strong>
                            {message.senderRole === "admin" ? "Support team" : selectedConversation.conversation.contactName}
                          </strong>
                          <p>{message.text}</p>
                        </>
                      )}
                      <span className="support-center-message-footer">
                        <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
                        {message.senderRole === "admin" ? (
                          <span
                            className={`support-center-read-receipt${message.isRead ? " is-read" : ""}`}
                            aria-label={message.isRead ? "Read by customer" : "Sent"}
                            title={message.isRead ? "Read by customer" : "Sent"}
                          >
                            <CheckCheck size={14} aria-hidden="true" />
                          </span>
                        ) : null}
                      </span>
                    </article>
                  ))}
              </div>
              <form className="support-center-reply" onSubmit={(event) => void sendReply(event)}>
                <label htmlFor="support-reply">Reply to customer</label>
                <textarea
                  id="support-reply"
                  rows={3}
                  required
                  maxLength={2000}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write a helpful reply…"
                />
                <button type="submit" disabled={sending || !draft.trim()}>
                  <Send size={16} aria-hidden="true" />
                  {sending ? "Sending…" : "Send reply"}
                </button>
              </form>
            </>
          ) : (
            <div className="support-center-empty support-center-no-selection">
              {selectedId
                ? "Loading conversation…"
                : "Select a conversation to view the messages."}
              {threadError ? (
                <span role="alert" className="support-center-error">{threadError}</span>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </AdminPageContainer>
  );
}
