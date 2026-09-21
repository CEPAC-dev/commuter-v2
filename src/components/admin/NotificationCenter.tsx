"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Info,
  Megaphone,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
} from "lucide-react";

interface Recipient {
  id: string;
  name: string;
  email?: string;
  role: "passenger" | "driver";
  createdAt: string;
}

interface NotificationTemplate {
  id: string;
  name: string;
  title: string;
  message: string;
  icon: string;
  style: string;
  linkUrl: string;
  linkLabel: string;
}

const ICON_OPTIONS = [
  { value: "bell", label: "Bell", Icon: Bell },
  { value: "info", label: "Info", Icon: Info },
  { value: "megaphone", label: "Announcement", Icon: Megaphone },
  { value: "check", label: "Success", Icon: CheckCircle2 },
  { value: "alert", label: "Alert", Icon: AlertTriangle },
] as const;

const STYLE_OPTIONS = [
  {
    value: "info",
    label: "Information",
    color: "#0B1E3D",
    background: "#EEF5FF",
  },
  {
    value: "success",
    label: "Success",
    color: "#087F5B",
    background: "#E7F8F1",
  },
  {
    value: "warning",
    label: "Warning",
    color: "#A15C00",
    background: "#FFF5DB",
  },
  { value: "urgent", label: "Urgent", color: "#B42318", background: "#FFF0EF" },
] as const;

export default function NotificationCenter({
  recipients,
  initialTemplates,
}: {
  recipients: Recipient[];
  initialTemplates: NotificationTemplate[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [audience, setAudience] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<"all" | "passenger" | "driver">(
    "all",
  );
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [icon, setIcon] = useState("bell");
  const [style, setStyle] = useState("info");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const visibleRecipients = useMemo(
    () =>
      recipients.filter(
        (recipient) => roleFilter === "all" || recipient.role === roleFilter,
      ),
    [recipients, roleFilter],
  );
  const selectedIcon =
    ICON_OPTIONS.find((option) => option.value === icon) ?? ICON_OPTIONS[0];
  const SelectedIcon = selectedIcon.Icon;
  const selectedStyle =
    STYLE_OPTIONS.find((option) => option.value === style) ?? STYLE_OPTIONS[0];

  const selectedTemplate = templates.find(
    (template) => template.id === templateId,
  );

  function applyTemplate(id: string) {
    const template = templates.find((item) => item.id === id);
    setTemplateId(id);
    if (!template) return;
    setTemplateName(template.name);
    setTitle(template.title);
    setMessage(template.message);
    setIcon(template.icon);
    setStyle(template.style);
    setLinkUrl(template.linkUrl);
    setLinkLabel(template.linkLabel);
  }

  async function saveTemplate() {
    if (!templateName.trim() || !title.trim() || !message.trim()) {
      setFeedback({
        type: "error",
        text: "Template name, title, and message are required.",
      });
      return;
    }
    const payload = {
      name: templateName,
      title,
      message,
      icon,
      style,
      linkUrl,
      linkLabel,
    };
    const response = await fetch(
      templateId
        ? `/api/admin/notifications/templates/${templateId}`
        : "/api/admin/notifications/templates",
      {
        method: templateId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = await response.json();
    if (!response.ok) {
      setFeedback({
        type: "error",
        text: result.error ?? "Could not save template",
      });
      return;
    }
    const saved = result.data as NotificationTemplate;
    setTemplates((current) =>
      templateId
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [...current, saved],
    );
    setTemplateId(saved.id);
    setFeedback({ type: "success", text: "Template saved." });
  }

  async function deleteTemplate() {
    if (
      !selectedTemplate ||
      !window.confirm(`Delete template "${selectedTemplate.name}"?`)
    )
      return;
    const response = await fetch(
      `/api/admin/notifications/templates/${selectedTemplate.id}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      const result = await response.json();
      setFeedback({
        type: "error",
        text: result.error ?? "Could not delete template",
      });
      return;
    }
    setTemplates((current) =>
      current.filter((item) => item.id !== selectedTemplate.id),
    );
    setTemplateId("");
    setTemplateName("");
    setFeedback({ type: "success", text: "Template deleted." });
  }

  function toggleRecipient(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function selectVisible() {
    const ids = visibleRecipients.map((recipient) => recipient.id);
    setSelectedIds((current) => Array.from(new Set([...current, ...ids])));
  }

  function clearVisible() {
    const ids = new Set(visibleRecipients.map((recipient) => recipient.id));
    setSelectedIds((current) => current.filter((id) => !ids.has(id)));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setSending(true);
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          audience,
          userIds: audience === "selected" ? selectedIds : undefined,
          icon,
          style,
          linkUrl,
          linkLabel,
          createdFrom: audience === "created" ? createdFrom : undefined,
          createdTo: audience === "created" ? createdTo : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not send notification");

      setFeedback({
        type: "success",
        text: `Notification sent to ${result.sent} user${result.sent === 1 ? "" : "s"}.`,
      });
      setTitle("");
      setMessage("");
      setLinkUrl("");
      setLinkLabel("");
      setSelectedIds([]);
    } catch (error) {
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not send notification",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <section style={{ marginTop: 22 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "var(--color-secondary-tint)",
            color: "var(--color-secondary)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Bell size={21} />
        </div>
        <div>
          <h2
            style={{ margin: 0, color: "var(--color-primary)", fontSize: 20 }}
          >
            Notification center
          </h2>
          <p
            style={{
              margin: "3px 0 0",
              color: "var(--color-muted)",
              fontSize: 13,
            }}
          >
            Send targeted in-app notifications to passengers and drivers.
          </p>
        </div>
      </div>

      <form
        onSubmit={submit}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(280px, .9fr)",
          gap: 18,
        }}
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div className="admin-notification-panel">
            <div className="admin-notification-panel-title">
              <Bell size={16} /> Ready templates
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto auto auto",
                gap: 8,
              }}
            >
              <select
                className="admin-notification-template-select"
                value={templateId}
                onChange={(event) => applyTemplate(event.target.value)}
              >
                <option value="">Start from scratch</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="admin-notification-icon-button"
                onClick={() => {
                  setTemplateId("");
                  setTemplateName("");
                }}
                title="New template"
                aria-label="New template"
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                className="admin-notification-icon-button"
                onClick={saveTemplate}
                title="Save template"
                aria-label="Save template"
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                className="admin-notification-icon-button danger"
                onClick={deleteTemplate}
                disabled={!selectedTemplate}
                title="Delete template"
                aria-label="Delete template"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <label className="admin-notification-label">
              Template name
              <input
                maxLength={80}
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Name this template before saving"
              />
            </label>
          </div>
          <div className="admin-notification-panel">
            <div className="admin-notification-panel-title">
              <Send size={16} /> Compose message
            </div>
            <label className="admin-notification-label">
              Title
              <input
                required
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Service update"
              />
            </label>
            <label className="admin-notification-label">
              Message
              <textarea
                required
                maxLength={1000}
                rows={5}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Write the notification message..."
              />
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <label className="admin-notification-label">
                Icon
                <select
                  value={icon}
                  onChange={(event) => setIcon(event.target.value)}
                >
                  {ICON_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-notification-label">
                Style
                <select
                  value={style}
                  onChange={(event) => setStyle(event.target.value)}
                >
                  {STYLE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr .8fr",
                gap: 12,
              }}
            >
              <label className="admin-notification-label">
                App page or URL
                <input
                  maxLength={300}
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="/my-trips or https://..."
                />
              </label>
              <label className="admin-notification-label">
                Button label
                <input
                  maxLength={40}
                  value={linkLabel}
                  onChange={(event) => setLinkLabel(event.target.value)}
                  placeholder="View details"
                />
              </label>
            </div>
          </div>

          <div
            className="admin-notification-preview"
            style={{
              borderColor: selectedStyle.color,
              background: selectedStyle.background,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                className="admin-notification-preview-icon"
                style={{ color: selectedStyle.color }}
              >
                <SelectedIcon size={18} />
              </span>
              <strong>{title || "Notification title"}</strong>
            </div>
            <p>{message || "Your notification preview will appear here."}</p>
            {linkUrl && linkLabel ? (
              <span className="admin-notification-preview-link">
                {linkLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <div className="admin-notification-panel">
            <div className="admin-notification-panel-title">
              <Users size={16} /> Recipients
            </div>
            <label className="admin-notification-label">
              Audience
              <select
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
              >
                <option value="all">All passengers and drivers</option>
                <option value="passengers">All passengers</option>
                <option value="drivers">All drivers</option>
                <option value="created">Users created during dates</option>
                <option value="selected">Selected users</option>
              </select>
            </label>
            {audience === "created" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <label className="admin-notification-label">
                  From
                  <input
                    type="date"
                    value={createdFrom}
                    onChange={(event) => setCreatedFrom(event.target.value)}
                  />
                </label>
                <label className="admin-notification-label">
                  To
                  <input
                    type="date"
                    value={createdTo}
                    onChange={(event) => setCreatedTo(event.target.value)}
                  />
                </label>
              </div>
            )}
            {audience === "selected" && (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: 7,
                    flexWrap: "wrap",
                    marginBottom: 9,
                  }}
                >
                  <button
                    type="button"
                    className={`admin-notification-filter ${roleFilter === "all" ? "active" : ""}`}
                    onClick={() => setRoleFilter("all")}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`admin-notification-filter ${roleFilter === "passenger" ? "active" : ""}`}
                    onClick={() => setRoleFilter("passenger")}
                  >
                    Passengers
                  </button>
                  <button
                    type="button"
                    className={`admin-notification-filter ${roleFilter === "driver" ? "active" : ""}`}
                    onClick={() => setRoleFilter("driver")}
                  >
                    Drivers
                  </button>
                  <button
                    type="button"
                    className="admin-notification-text-button"
                    onClick={selectVisible}
                  >
                    Select visible
                  </button>
                  <button
                    type="button"
                    className="admin-notification-text-button"
                    onClick={clearVisible}
                  >
                    Clear visible
                  </button>
                </div>
                <div className="admin-notification-recipient-list">
                  {visibleRecipients.map((recipient) => (
                    <label
                      key={recipient.id}
                      className="admin-notification-recipient"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(recipient.id)}
                        onChange={() => toggleRecipient(recipient.id)}
                      />
                      <span>
                        <strong>{recipient.name}</strong>
                        <small>
                          {recipient.role}{" "}
                          {recipient.email ? `· ${recipient.email}` : ""}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
                <small style={{ color: "var(--color-muted)" }}>
                  {selectedIds.length} selected
                </small>
              </>
            )}
          </div>

          {feedback && (
            <div
              style={{
                padding: "11px 13px",
                borderRadius: 9,
                background: feedback.type === "success" ? "#E8F8F1" : "#FFF0EF",
                color: feedback.type === "success" ? "#087F5B" : "#B42318",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {feedback.type === "success" ? (
                <Check
                  size={15}
                  style={{ verticalAlign: "-3px", marginRight: 5 }}
                />
              ) : (
                <AlertTriangle
                  size={15}
                  style={{ verticalAlign: "-3px", marginRight: 5 }}
                />
              )}
              {feedback.text}
            </div>
          )}
          <button
            type="submit"
            disabled={
              sending || (audience === "selected" && selectedIds.length === 0)
            }
            className="admin-notification-submit"
          >
            <Send size={16} />
            {sending ? "Sending..." : "Send notification"}
          </button>
        </div>
      </form>

      <style>{`
        .admin-notification-panel { background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 18px; display: grid; gap: 13px; }
        .admin-notification-panel-title { display: flex; align-items: center; gap: 7px; color: var(--color-primary); font-size: 14px; font-weight: 800; }
        .admin-notification-label { display: grid; gap: 6px; color: var(--color-muted); font-size: 12px; font-weight: 700; }
        .admin-notification-label input, .admin-notification-label textarea, .admin-notification-label select { width: 100%; box-sizing: border-box; border: 1px solid var(--color-border); border-radius: 8px; padding: 10px 11px; background: #fff; color: var(--color-primary); font: inherit; font-size: 13px; outline: none; }
        .admin-notification-label textarea { resize: vertical; min-height: 112px; line-height: 1.5; }
        .admin-notification-label input:focus, .admin-notification-label textarea:focus, .admin-notification-label select:focus { border-color: var(--color-secondary); box-shadow: 0 0 0 3px rgba(0,194,168,.12); }
        .admin-notification-preview { border: 1px solid; border-radius: var(--radius-lg); padding: 16px; color: var(--color-primary); }
        .admin-notification-preview-icon { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,.75); display: grid; place-items: center; }
        .admin-notification-preview p { margin: 10px 0 0; color: var(--color-muted); font-size: 13px; line-height: 1.5; }
        .admin-notification-preview-link { display: inline-block; margin-top: 12px; color: var(--color-secondary); font-size: 12px; font-weight: 800; }
        .admin-notification-filter, .admin-notification-text-button { border: 1px solid var(--color-border); background: #fff; color: var(--color-muted); border-radius: 999px; padding: 6px 9px; font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
        .admin-notification-filter.active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
        .admin-notification-text-button { border: 0; color: var(--color-secondary); padding-inline: 3px; }
        .admin-notification-recipient-list { max-height: 220px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 8px; }
        .admin-notification-recipient { display: flex; align-items: center; gap: 9px; padding: 9px 10px; border-bottom: 1px solid #f0f2f4; cursor: pointer; }
        .admin-notification-recipient:last-child { border-bottom: 0; }
        .admin-notification-recipient span { display: grid; gap: 2px; min-width: 0; }
        .admin-notification-recipient strong { color: var(--color-primary); font-size: 12px; }
        .admin-notification-recipient small { color: var(--color-muted); font-size: 11px; }
        .admin-notification-submit { border: 0; border-radius: 9px; background: var(--color-primary); color: #fff; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; }
        .admin-notification-submit:disabled { opacity: .5; cursor: not-allowed; }
        .admin-notification-template-select { min-width: 0; border: 1px solid var(--color-border); border-radius: 8px; padding: 10px 11px; background: #fff; color: var(--color-primary); font: inherit; font-size: 13px; }
        .admin-notification-icon-button { width: 38px; height: 38px; border: 1px solid var(--color-border); border-radius: 8px; background: #fff; color: var(--color-primary); display: grid; place-items: center; cursor: pointer; }
        .admin-notification-icon-button:hover { border-color: var(--color-secondary); color: var(--color-secondary); }
        .admin-notification-icon-button.danger { color: var(--color-danger); }
        .admin-notification-icon-button:disabled { opacity: .45; cursor: not-allowed; }
        @media (max-width: 850px) { form:has(.admin-notification-panel) { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>
  );
}
