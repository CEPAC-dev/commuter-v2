"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  CheckCheck,
  LoaderCircle,
  MessageSquarePlus,
  Search,
  Send,
} from "lucide-react";
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

interface SupportUser {
  id: string;
  userNumber: number | null;
  name: string;
  email: string;
  phone: string;
  role: "passenger" | "driver";
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
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<SupportUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SupportUser | null>(null);
  const [userSearchError, setUserSearchError] = useState("");
  const [newConversationError, setNewConversationError] = useState("");
  const [newConversationMessage, setNewConversationMessage] = useState("");
  const [newConversationCategory, setNewConversationCategory] = useState("other");
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);

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

  async function searchUsers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = userQuery.trim();
    if (query.length < 2) {
      setUserSearchError("Enter at least 2 characters to search.");
      return;
    }
    setSearchingUsers(true);
    setUserSearchError("");
    setSelectedUser(null);
    try {
      const response = await fetch(
        `/api/admin/support/users?q=${encodeURIComponent(query)}`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not search users.");
      setUserResults(result.data);
      if (!result.data.length) setUserSearchError("No matching users found.");
    } catch (error) {
      setUserResults([]);
      setUserSearchError(
        error instanceof Error ? error.message : "Could not search users.",
      );
    } finally {
      setSearchingUsers(false);
    }
  }

  async function startConversation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser || !newConversationMessage.trim() || creatingConversation)
      return;
    setCreatingConversation(true);
    setNewConversationError("");
    try {
      const response = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          category: newConversationCategory,
          message: newConversationMessage.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not start conversation.");
      setNewConversationMessage("");
      setUserQuery("");
      setUserResults([]);
      setSelectedUser(null);
      setFilter("all");
      setSelectedId(result.data.id);
      setDetail(null);
    } catch (error) {
      setNewConversationError(
        error instanceof Error ? error.message : "Could not start conversation.",
      );
    } finally {
      setCreatingConversation(false);
    }
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title="Support center"
        description="Start conversations with users, reply to messages, and resolve support requests."
      />
      <section className="support-center-panel support-center-start" aria-label="Start a conversation">
        <h2>Start a conversation</h2>
        <p>Search for any passenger or driver to contact them directly.</p>
        <form className="support-center-user-search" onSubmit={(event) => void searchUsers(event)}>
          <label className="support-center-visually-hidden" htmlFor="support-user-search">
            Search users by name, email, phone, or user number
          </label>
          <input
            id="support-user-search"
            value={userQuery}
            onChange={(event) => {
              setUserQuery(event.target.value);
              setSelectedUser(null);
              setUserResults([]);
              setUserSearchError("");
            }}
            placeholder="Name, email, phone, or #user number"
            maxLength={100}
          />
          <button type="submit" disabled={searchingUsers}>
            {searchingUsers ? (
              <LoaderCircle size={16} className="support-center-spin" aria-hidden="true" />
            ) : (
              <Search size={16} aria-hidden="true" />
            )}
            Search
          </button>
        </form>
        {userSearchError ? (
          <p role="status" className="support-center-error">{userSearchError}</p>
        ) : null}
        {userResults.length ? (
          <div className="support-center-user-results" aria-label="Search results">
            {userResults.map((user) => (
              <button
                key={user.id}
                type="button"
                aria-pressed={selectedUser?.id === user.id}
                className={`support-center-user-result${selectedUser?.id === user.id ? " is-selected" : ""}`}
                onClick={() => {
                  setSelectedUser(user);
                  setNewConversationError("");
                }}
              >
                <strong>{user.name}</strong>
                <span>
                  {user.role} · {user.phone}
                  {user.email ? ` · ${user.email}` : ""}
                  {user.userNumber ? ` · #${user.userNumber}` : ""}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {selectedUser ? (
          <form className="support-center-start-form" onSubmit={(event) => void startConversation(event)}>
            <p>
              Message to <strong>{selectedUser.name}</strong>
              {selectedUser.email ? ` (${selectedUser.email})` : ""}
            </p>
            <label htmlFor="support-new-category">Category</label>
            <select
              id="support-new-category"
              value={newConversationCategory}
              onChange={(event) => setNewConversationCategory(event.target.value)}
            >
              <option value="booking">Booking</option>
              <option value="trip">Trip</option>
              <option value="payment">Payment</option>
              <option value="account">Account</option>
              <option value="safety">Safety</option>
              <option value="other">Other</option>
            </select>
            <label htmlFor="support-new-message">First message</label>
            <textarea
              id="support-new-message"
              rows={3}
              required
              maxLength={2000}
              value={newConversationMessage}
              onChange={(event) => setNewConversationMessage(event.target.value)}
              placeholder="Write a message to start the conversation…"
            />
            {newConversationError ? (
              <p role="alert" className="support-center-error">{newConversationError}</p>
            ) : null}
            <button type="submit" disabled={creatingConversation || !newConversationMessage.trim()}>
              <MessageSquarePlus size={16} aria-hidden="true" />
              {creatingConversation ? "Starting…" : "Start conversation"}
            </button>
          </form>
        ) : null}
      </section>
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
                  {selectedConversation.conversation.contactEmail ? (
                    <a href={`mailto:${selectedConversation.conversation.contactEmail}`}>
                      {selectedConversation.conversation.contactEmail}
                    </a>
                  ) : (
                    <span>No email address on file</span>
                  )}
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
