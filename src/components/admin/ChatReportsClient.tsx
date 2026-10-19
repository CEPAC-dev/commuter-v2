"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/layout";
import { useClientLocale } from "@/lib/i18n/client";
import { translate } from "@/lib/i18n";

type ChatReportItem = {
  id: string;
  tripId: string;
  rideId: string;
  reporterRole: "passenger" | "driver";
  reporter: Identity | null;
  passenger: Identity | null;
  driver: Identity | null;
  tripNumber: number | null;
  tripDate: string | null;
  rideNumber: number | null;
  reason: "abuse" | "contact_sharing" | "harassment" | "other";
  note: string;
  status: "open" | "reviewed" | "dismissed";
  adminNote: string;
  snapshot: {
    senderRole: "user" | "driver";
    kind: "text" | "preset";
    presetKey?: string;
    text?: string;
    createdAt: string;
  }[];
  createdAt: string;
  reviewedAt: string | null;
};

type Identity = {
  id: string;
  name: string;
  email: string;
  phone: string;
  userNumber: number | null;
};

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleString(locale === "ar" ? "ar-EG" : "en-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ChatReportsClient() {
  const { t, dir, locale } = useClientLocale();
  const [status, setStatus] = useState<"open" | "reviewed" | "dismissed" | "all">("open");
  const [page, setPage] = useState(1);
  const [reports, setReports] = useState<ChatReportItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/chat-reports?status=${status}&page=${page}&limit=20`,
        { cache: "no-store" },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t("admin.chat_reports.load_error"));
      const nextReports = body.reports as ChatReportItem[];
      setReports(nextReports);
      setTotalPages(body.totalPages ?? 1);
      setSelectedId((current) =>
        nextReports.some((report) => report.id === current)
          ? current
          : nextReports[0]?.id ?? null,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("admin.chat_reports.load_error"));
      setReports([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [page, status, t]);

  useEffect(() => {
    // This effect starts an async fetch; its state updates follow the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReports();
  }, [loadReports]);

  const selected = reports.find((report) => report.id === selectedId) ?? null;
  useEffect(() => {
    // Keep the editable note aligned with the selected report.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAdminNote(selected?.adminNote ?? "");
  }, [selected?.id, selected?.adminNote]);

  const review = async (nextStatus: "reviewed" | "dismissed") => {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/chat-reports/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, adminNote }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t("admin.chat_reports.review_error"));
      setNotice(t("admin.chat_reports.review_saved"));
      await loadReports();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("admin.chat_reports.review_error"));
    } finally {
      setSaving(false);
    }
  };

  const identityCard = (title: string, identity: Identity | null) => (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
      <h3 className="mb-2 text-sm font-bold text-[var(--color-primary)]">{title}</h3>
      {identity ? (
        <dl className="grid gap-1 text-sm text-[var(--color-muted)]">
          <div><dt className="inline font-semibold">{t("admin.chat_reports.name")}: </dt><dd className="inline" dir="auto">{identity.name || "—"}</dd></div>
          <div><dt className="inline font-semibold">{t("admin.chat_reports.email")}: </dt><dd className="inline break-all" dir="auto">{identity.email || "—"}</dd></div>
          <div><dt className="inline font-semibold">{t("admin.chat_reports.phone")}: </dt><dd className="inline" dir="auto">{identity.phone || "—"}</dd></div>
          {identity.userNumber != null && <div><dt className="inline font-semibold">{t("admin.chat_reports.user_number")}: </dt><dd className="inline">{identity.userNumber}</dd></div>}
        </dl>
      ) : (
        <p className="m-0 text-sm text-[var(--color-muted)]">{t("admin.chat_reports.identity_unavailable")}</p>
      )}
    </div>
  );

  return (
    <div dir={dir} className="space-y-6">
      <AdminPageHeader
        title={t("admin.chat_reports.title")}
        description={t("admin.chat_reports.subtitle")}
        icon={ShieldAlert}
        actions={
          <button type="button" onClick={() => void loadReports()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-60">
            <RefreshCw size={16} />{t("admin.chat_reports.refresh")}
          </button>
        }
      />

      {error && <p role="alert" className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-tint)] p-3 text-sm text-[var(--color-danger)]">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-[var(--color-secondary)] bg-[var(--color-secondary-tint)] p-3 text-sm text-[var(--color-primary)]">{notice}</p>}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-[0_10px_28px_var(--color-shadow)]">
        <label className="grid gap-1 text-sm font-semibold text-[var(--color-primary)]">
          {t("admin.chat_reports.filter")}
          <select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }} className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 font-normal">
            {(["open", "reviewed", "dismissed", "all"] as const).map((item) => <option key={item} value={item}>{t(`admin.chat_reports.status.${item}`)}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-3 text-sm text-[var(--color-muted)]">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="min-h-10 rounded-lg border border-[var(--color-border)] px-3 disabled:opacity-50">{t("admin.chat_reports.previous")}</button>
          <span>{t("admin.chat_reports.page", { page, totalPages })}</span>
          <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="min-h-10 rounded-lg border border-[var(--color-border)] px-3 disabled:opacity-50">{t("admin.chat_reports.next")}</button>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.7fr)]">
        <section aria-label={t("admin.chat_reports.title")} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[0_10px_28px_var(--color-shadow)]">
          {loading ? (
            <p role="status" className="p-5 text-sm text-[var(--color-muted)]">{t("admin.chat_reports.loading")}</p>
          ) : reports.length === 0 ? (
            <p className="p-5 text-sm text-[var(--color-muted)]">{t("admin.chat_reports.empty")}</p>
          ) : reports.map((report) => (
            <button key={report.id} type="button" onClick={() => setSelectedId(report.id)} aria-current={report.id === selectedId} className={`block w-full border-b border-[var(--color-border)] p-4 text-start transition-colors ${report.id === selectedId ? "bg-[var(--color-secondary-tint)]" : "hover:bg-[var(--color-surface)]"}`}>
              <span className="flex items-center justify-between gap-2">
                <strong className="text-sm text-[var(--color-primary)]">{t(`admin.chat_reports.reason.${report.reason}`)}</strong>
                <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-muted)]">{t(`admin.chat_reports.status.${report.status}`)}</span>
              </span>
              <span className="mt-2 block text-xs text-[var(--color-muted)]">
                {report.tripNumber != null ? `Trip #${report.tripNumber}` : report.tripId.slice(-7)}
                {" · "}
                {formatDate(report.createdAt, locale)}
              </span>
            </button>
          ))}
        </section>

        {selected ? (
          <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 shadow-[0_10px_28px_var(--color-shadow)]">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="m-0 text-lg font-extrabold text-[var(--color-primary)]">{t(`admin.chat_reports.reason.${selected.reason}`)}</h2>
                <p className="mt-1 text-xs text-[var(--color-muted)]">{formatDate(selected.createdAt, locale)} · {t(`admin.chat_reports.status.${selected.status}`)}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm font-semibold">
                <Link href="/admin/trips" className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 text-[var(--color-primary)]">
                  {selected.tripNumber != null ? `Trip #${selected.tripNumber}` : t("admin.chat_reports.trip_link")} <ExternalLink size={14} />
                </Link>
                <Link href="/admin/rides" className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 text-[var(--color-primary)]">
                  {selected.rideNumber != null ? `Ride #${selected.rideNumber}` : t("admin.chat_reports.ride_link")} <ExternalLink size={14} />
                </Link>
              </div>
            </header>

            <div className="grid gap-3 md:grid-cols-2">
              {identityCard(t("admin.chat_reports.passenger"), selected.passenger)}
              {identityCard(t("admin.chat_reports.driver"), selected.driver)}
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <h3 className="mb-2 text-sm font-bold text-[var(--color-primary)]">{t("admin.chat_reports.report_details")}</h3>
              <p className="m-0 text-sm text-[var(--color-muted)]">{t("admin.chat_reports.reporter_role")}: {t(`admin.chat_reports.role.${selected.reporterRole}`)}</p>
              {selected.reporter && <p className="mt-1 text-sm text-[var(--color-muted)]">{t("admin.chat_reports.reporter")}: {selected.reporter.name} ({selected.reporter.email})</p>}
              {selected.note && <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-primary)]">{selected.note}</p>}
            </div>

            <div className="space-y-3">
              <h3 className="m-0 text-sm font-bold text-[var(--color-primary)]">{t("admin.chat_reports.snapshot")}</h3>
              {selected.snapshot.length === 0 ? (
                <p className="m-0 text-sm text-[var(--color-muted)]">{t("admin.chat_reports.snapshot_empty")}</p>
              ) : selected.snapshot.map((message, index) => (
                <article key={`${message.createdAt}-${index}`} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
                  <div className="mb-1 flex justify-between gap-2 text-xs text-[var(--color-muted)]">
                    <span>{message.senderRole === "driver" ? t("chat.driver_label") : t("chat.passenger_label", { n: selected.passenger?.userNumber ?? 1 })}</span>
                    <time>{formatDate(message.createdAt, locale)}</time>
                  </div>
                  <p className="m-0 whitespace-pre-wrap break-words text-sm text-[var(--color-primary)]" dir="auto">
                    {message.kind === "preset" && message.presetKey
                      ? translate(locale, `chat.preset.${message.presetKey}`)
                      : message.text ?? ""}
                  </p>
                </article>
              ))}
            </div>

            {selected.status === "open" ? (
              <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
                <label className="grid gap-1 text-sm font-semibold text-[var(--color-primary)]">
                  {t("admin.chat_reports.admin_note")}
                  <textarea value={adminNote} maxLength={1000} onChange={(event) => setAdminNote(event.target.value)} rows={3} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3 font-normal" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={saving} onClick={() => void review("reviewed")} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-secondary)] px-4 text-sm font-bold text-[var(--color-primary)] disabled:opacity-50"><CheckCircle2 size={16} />{t("admin.chat_reports.mark_reviewed")}</button>
                  <button type="button" disabled={saving} onClick={() => void review("dismissed")} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-danger)] px-4 text-sm font-bold text-white disabled:opacity-50"><XCircle size={16} />{t("admin.chat_reports.dismiss")}</button>
                </div>
              </div>
            ) : (
              <div className="border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-muted)]">
                {t("admin.chat_reports.reviewed_at")}: {selected.reviewedAt ? formatDate(selected.reviewedAt, locale) : "—"}
                {selected.adminNote && <p className="mt-2 whitespace-pre-wrap">{selected.adminNote}</p>}
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-8 text-center text-sm text-[var(--color-muted)]">
            {loading ? t("admin.chat_reports.loading") : t("admin.chat_reports.select_report")}
          </section>
        )}
      </div>
    </div>
  );
}
