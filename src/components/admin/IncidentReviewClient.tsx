"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/layout";
import { useClientLocale } from "@/lib/i18n/client";
import { formatEgp } from "@/lib/i18n";

type IncidentStatus = "open" | "resolved";
type ResolutionAction = "continue" | "cancel_no_penalty" | "cancel_with_penalty";

interface IncidentRow {
  id: string;
  rideId: string;
  rideNumber: number | null;
  driverId: string;
  type: string;
  rideStatusAtReport: string;
  status: IncidentStatus;
  createdAt: string;
  resolution: string | null;
  resolvedAt: string | null;
}

interface IncidentDetail {
  incident: {
    id: string;
    rideId: string;
    driverId: string;
    type: string;
    note: string;
    rideStatusAtReport: string;
    status: IncidentStatus;
    resolution: string | null;
    adminNote: string;
    needsFollowUpTripIds: string[];
    createdAt: string;
    resolvedAt: string | null;
  };
  ride: {
    id: string;
    rideNumber?: number;
    status: string;
    date: string;
    startTime: string;
    endTime: string;
    route: { point?: { address?: string } }[];
    vehicleType: string;
    priceEgp: number;
  } | null;
  driver: {
    id: string;
    name: string;
    phone: string;
    balanceEgp: number;
    owedEgp: number;
  } | null;
  affectedTrips: {
    id: string;
    status: string;
    passengerNumber: number | null;
    passengerLabel: string;
    pickupStatus: string;
    paymentStatus: string;
    priceEgp: number | null;
    pickup: string | null;
    dropoff: string | null;
  }[];
  suggestedPenaltyEgp: number | null;
}

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleString(locale === "ar" ? "ar-EG" : "en-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function IncidentReviewClient() {
  const { t, dir, locale } = useClientLocale();
  const [status, setStatus] = useState<IncidentStatus>("open");
  const [page, setPage] = useState(1);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [openCount, setOpenCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState<ResolutionAction | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [penaltyEgp, setPenaltyEgp] = useState("");

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/incidents?status=${status}&page=${page}&limit=20`,
        { cache: "no-store" },
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || t("admin.incidents.load_error"));
      }
      const rows = body.incidents as IncidentRow[];
      setIncidents(rows);
      setOpenCount(body.openCount ?? 0);
      setTotalPages(body.totalPages ?? 1);
      setSelectedId((current) =>
        rows.some((incident) => incident.id === current)
          ? current
          : rows[0]?.id ?? null,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("admin.incidents.load_error"),
      );
      setIncidents([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [page, status, t]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      try {
        const response = await fetch(`/api/admin/incidents/${id}`, {
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || t("admin.incidents.detail_error"));
        }
        setDetail(body as IncidentDetail);
        setAdminNote(body.incident.adminNote ?? "");
      } catch (cause) {
        setDetail(null);
        setError(
          cause instanceof Error
            ? cause.message
            : t("admin.incidents.detail_error"),
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    // This effect starts an async fetch; its state updates follow the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadIncidents();
  }, [loadIncidents]);

  useEffect(() => {
    if (!selectedId) {
      // Clear stale detail when the selected incident is removed from the list.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  const openResolutionDialog = (nextAction: ResolutionAction) => {
    if (!detail) return;
    setAdminNote("");
    setPenaltyEgp(
      String(detail.suggestedPenaltyEgp ?? 0),
    );
    setAction(nextAction);
    setError(null);
  };

  const resolveIncident = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail || !action || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/admin/incidents/${detail.incident.id}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            adminNote,
            ...(action === "cancel_with_penalty"
              ? { penaltyEgp: Number(penaltyEgp) }
              : {}),
          }),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || t("admin.incidents.resolve_error"));
      }
      setNotice(t("admin.incidents.resolve_saved"));
      setAction(null);
      setStatus("resolved");
      setPage(1);
      await loadDetail(detail.incident.id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("admin.incidents.resolve_error"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir={dir} className="space-y-6">
      <AdminPageHeader
        title={t("admin.incidents.title")}
        description={t("admin.incidents.subtitle", { count: openCount })}
        icon={AlertTriangle}
        actions={
          <button
            type="button"
            onClick={() => void loadIncidents()}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-on-primary)] disabled:opacity-60"
          >
            <RefreshCw size={16} />
            {t("admin.incidents.refresh")}
          </button>
        }
      />

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-tint)] p-3 text-sm text-[var(--color-danger)]"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-[var(--color-secondary)] bg-[var(--color-secondary-tint)] p-3 text-sm text-[var(--color-primary)]"
        >
          {notice}
        </p>
      )}

      <section className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 shadow-[0_10px_28px_var(--color-shadow)]">
        <label className="grid gap-1 text-sm font-semibold text-[var(--color-primary)]">
          {t("admin.incidents.filter")}
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as IncidentStatus);
              setPage(1);
            }}
            className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 font-normal"
          >
            <option value="open">{t("admin.incidents.status.open")}</option>
            <option value="resolved">
              {t("admin.incidents.status.resolved")}
            </option>
          </select>
        </label>
        <div className="flex items-center gap-3 text-sm text-[var(--color-muted)]">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => current - 1)}
            className="min-h-10 rounded-lg border border-[var(--color-border)] px-3 disabled:opacity-50"
          >
            {t("admin.incidents.previous")}
          </button>
          <span>
            {t("admin.incidents.page", { page, totalPages })}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => current + 1)}
            className="min-h-10 rounded-lg border border-[var(--color-border)] px-3 disabled:opacity-50"
          >
            {t("admin.incidents.next")}
          </button>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.7fr)]">
        <section
          aria-label={t("admin.incidents.title")}
          className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[0_10px_28px_var(--color-shadow)]"
        >
          {loading ? (
            <p role="status" className="p-5 text-sm text-[var(--color-muted)]">
              {t("admin.incidents.loading")}
            </p>
          ) : incidents.length === 0 ? (
            <p className="p-5 text-sm text-[var(--color-muted)]">
              {t("admin.incidents.empty")}
            </p>
          ) : (
            <ul className="m-0 list-none divide-y divide-[var(--color-border)] p-0">
              {incidents.map((incident) => (
                <li key={incident.id}>
                  <button
                    type="button"
                    aria-current={selectedId === incident.id ? "true" : undefined}
                    onClick={() => setSelectedId(incident.id)}
                    className={`grid w-full gap-2 p-4 text-start transition hover:bg-[var(--color-surface)] ${
                      selectedId === incident.id
                        ? "bg-[var(--color-surface)]"
                        : "bg-transparent"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <strong className="text-sm text-[var(--color-primary)]">
                        {t(`admin.incidents.type.${incident.type}`)}
                      </strong>
                      <span className="rounded-full bg-[var(--color-secondary-tint)] px-2 py-1 text-xs text-[var(--color-primary)]">
                        {t(`admin.incidents.status.${incident.status}`)}
                      </span>
                    </span>
                    <span className="text-xs text-[var(--color-muted)]">
                      {t("admin.incidents.ride_number", {
                        number: incident.rideNumber ?? incident.rideId.slice(-6),
                      })}
                      {" · "}
                      {formatDate(incident.createdAt, locale)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 shadow-[0_10px_28px_var(--color-shadow)]">
          {detailLoading ? (
            <p role="status" className="text-sm text-[var(--color-muted)]">
              {t("admin.incidents.loading")}
            </p>
          ) : !detail ? (
            <p className="text-sm text-[var(--color-muted)]">
              {t("admin.incidents.select")}
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="m-0 text-lg font-extrabold text-[var(--color-primary)]">
                    {t(`admin.incidents.type.${detail.incident.type}`)}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {t("admin.incidents.reported_at", {
                      date: formatDate(detail.incident.createdAt, locale),
                    })}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--color-secondary-tint)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                  {t(`admin.incidents.status.${detail.incident.status}`)}
                </span>
              </div>

              {detail.ride ? (
                <section className="grid gap-3 rounded-xl border border-[var(--color-border)] p-4 sm:grid-cols-2">
                  <Info
                    label={t("admin.incidents.ride")}
                    value={t("admin.incidents.ride_number", {
                      number: detail.ride.rideNumber ?? "—",
                    })}
                  />
                  <Info
                    label={t("admin.incidents.ride_status")}
                    value={detail.ride.status}
                  />
                  <Info
                    label={t("admin.incidents.date_time")}
                    value={`${detail.ride.date} · ${detail.ride.startTime}–${detail.ride.endTime}`}
                  />
                  <Info
                    label={t("admin.incidents.vehicle")}
                    value={detail.ride.vehicleType}
                  />
                  <Info
                    label={t("admin.incidents.price")}
                    value={formatEgp(locale, detail.ride.priceEgp)}
                  />
                  <Info
                    label={t("admin.incidents.route")}
                    value={
                      detail.ride.route
                        .map((stop) => stop.point?.address)
                        .filter((address): address is string => Boolean(address))
                        .join(" → ") || "—"
                    }
                  />
                </section>
              ) : (
                <p className="text-sm text-[var(--color-muted)]">
                  {t("admin.incidents.ride_unavailable")}
                </p>
              )}

              <section className="grid gap-3 rounded-xl border border-[var(--color-border)] p-4 sm:grid-cols-2">
                <Info
                  label={t("admin.incidents.driver")}
                  value={detail.driver?.name || t("admin.incidents.unavailable")}
                />
                <Info
                  label={t("admin.incidents.driver_id")}
                  value={detail.driver?.id ?? "—"}
                />
                <Info
                  label={t("admin.incidents.phone")}
                  value={detail.driver?.phone || "—"}
                />
                <Info
                  label={t("admin.incidents.wallet_balance")}
                  value={formatEgp(locale, detail.driver?.balanceEgp ?? 0)}
                />
                <Info
                  label={t("admin.incidents.wallet_debt")}
                  value={formatEgp(locale, detail.driver?.owedEgp ?? 0)}
                />
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold text-[var(--color-primary)]">
                  {t("admin.incidents.report_note")}
                </h3>
                <p className="m-0 whitespace-pre-wrap text-sm text-[var(--color-muted)]">
                  {detail.incident.note || "—"}
                </p>
              </section>

              <section className="overflow-x-auto">
                <h3 className="mb-2 text-sm font-bold text-[var(--color-primary)]">
                  {t("admin.incidents.affected_trips")}
                </h3>
                <table className="w-full min-w-[660px] border-collapse text-start text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                      <th className="p-2 text-start">{t("admin.incidents.passenger")}</th>
                      <th className="p-2 text-start">{t("admin.incidents.trip_status")}</th>
                      <th className="p-2 text-start">{t("admin.incidents.pickup_status")}</th>
                      <th className="p-2 text-start">{t("admin.incidents.payment_status")}</th>
                      <th className="p-2 text-start">{t("admin.incidents.price")}</th>
                      <th className="p-2 text-start">{t("admin.incidents.route")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.affectedTrips.map((trip) => (
                      <tr key={trip.id} className="border-b border-[var(--color-border)]">
                        <td className="p-2">{trip.passengerLabel}</td>
                        <td className="p-2">{trip.status}</td>
                        <td className="p-2">{trip.pickupStatus}</td>
                        <td className="p-2">{trip.paymentStatus}</td>
                        <td className="p-2">
                          {trip.priceEgp == null ? "—" : formatEgp(locale, trip.priceEgp)}
                        </td>
                        <td className="max-w-[220px] truncate p-2">
                          {trip.pickup ?? "—"} → {trip.dropoff ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {detail.incident.status === "open" ? (
                <section className="space-y-3 border-t border-[var(--color-border)] pt-4">
                  <p className="m-0 text-sm text-[var(--color-muted)]">
                    {t("admin.incidents.suggested_penalty", {
                      amount:
                        detail.suggestedPenaltyEgp == null
                          ? t("admin.incidents.not_applicable")
                          : formatEgp(locale, detail.suggestedPenaltyEgp),
                    })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openResolutionDialog("continue")}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-secondary)] px-4 text-sm font-bold text-[var(--color-primary)]"
                    >
                      <CheckCircle2 size={16} />
                      {t("admin.incidents.action.continue")}
                    </button>
                    <button
                      type="button"
                      onClick={() => openResolutionDialog("cancel_no_penalty")}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-danger)] px-4 text-sm font-bold text-white"
                    >
                      <XCircle size={16} />
                      {t("admin.incidents.action.cancel_no_penalty")}
                    </button>
                    <button
                      type="button"
                      onClick={() => openResolutionDialog("cancel_with_penalty")}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--color-danger)] px-4 text-sm font-bold text-[var(--color-danger)]"
                    >
                      <AlertTriangle size={16} />
                      {t("admin.incidents.action.cancel_with_penalty")}
                    </button>
                  </div>
                </section>
              ) : (
                <section className="space-y-2 border-t border-[var(--color-border)] pt-4">
                  <Info
                    label={t("admin.incidents.resolution")}
                    value={detail.incident.resolution ?? "—"}
                  />
                  <Info
                    label={t("admin.incidents.admin_note")}
                    value={detail.incident.adminNote || "—"}
                  />
                </section>
              )}

              {detail.incident.needsFollowUpTripIds.length > 0 && (
                <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="m-0 font-bold">
                    {t("admin.incidents.follow_up", {
                      count: detail.incident.needsFollowUpTripIds.length,
                    })}
                  </p>
                  <ul className="my-2 list-inside list-disc">
                    {detail.incident.needsFollowUpTripIds.map((tripId) => (
                      <li key={tripId}>{tripId}</li>
                    ))}
                  </ul>
                  <Link
                    href="/admin/refund-requests"
                    className="font-bold underline"
                  >
                    {t("admin.incidents.refund_link")}
                  </Link>
                </section>
              )}
            </div>
          )}
        </section>
      </div>

      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="incident-resolution-title"
            className="w-full max-w-lg space-y-4 rounded-2xl bg-[var(--color-panel)] p-5 shadow-xl"
          >
            <h2
              id="incident-resolution-title"
              className="m-0 text-lg font-extrabold text-[var(--color-primary)]"
            >
              {t(`admin.incidents.action.${action}`)}
            </h2>
            <form onSubmit={resolveIncident} className="grid gap-4">
              {action === "cancel_with_penalty" && (
                <label className="grid gap-1 text-sm font-semibold text-[var(--color-primary)]">
                  {t("admin.incidents.penalty_amount")}
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={penaltyEgp}
                    onChange={(event) => setPenaltyEgp(event.target.value)}
                    className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3"
                  />
                  <span className="font-normal text-[var(--color-danger)]">
                    {t("admin.incidents.penalty_debt_warning")}
                  </span>
                </label>
              )}
              <label className="grid gap-1 text-sm font-semibold text-[var(--color-primary)]">
                {t("admin.incidents.admin_note")}
                <textarea
                  required
                  maxLength={500}
                  rows={4}
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setAction(null)}
                  className="min-h-10 rounded-lg border border-[var(--color-border)] px-4 text-sm font-semibold disabled:opacity-60"
                >
                  {t("admin.incidents.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving || !adminNote.trim()}
                  className="min-h-10 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-bold text-[var(--color-on-primary)] disabled:opacity-60"
                >
                  {saving
                    ? t("admin.incidents.saving")
                    : t("admin.incidents.confirm")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-[var(--color-muted)]">{label}</dt>
      <dd className="m-0 break-words text-sm font-medium text-[var(--color-primary)]">
        {value}
      </dd>
    </div>
  );
}
