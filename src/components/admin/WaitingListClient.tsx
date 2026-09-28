"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock3, Loader2, Mail, MapPin, Phone, X } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { useClientLocale } from "@/lib/i18n/client";
import { formatEgp } from "@/lib/i18n";
import {
  AdminButton,
  AdminCard,
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
  AdminPagination,
  AdminStatusBadge,
} from "@/components/admin/layout";
import {
  formatAdminBadgeCount,
  formatWaitingListAge,
  waitingListErrorKey,
  waitingListErrorMessageKey,
} from "@/lib/admin/waitingListUi";

type WaitingListTrip = {
  id: string;
  route: {
    pickup?: { address?: string } | null;
    dropoff?: { address?: string } | null;
  };
  date: string;
  pickupTime: string;
  arrivalTime: string;
  vehicleType: string;
  numberOfPassengers: number;
  fare: number;
};

type WaitingListItem = {
  id: string;
  createdAt: string;
  totalFare: number;
  promoCodes: string[];
  note: string;
  hasPastTrip: boolean;
  passenger: {
    name?: string;
    phone?: string;
    email?: string;
  } | null;
  trips: WaitingListTrip[];
};

type ListResponse = {
  data: WaitingListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type DialogState = {
  action: "approve" | "reject";
  item: WaitingListItem;
} | null;

function displayValue(value: string | undefined | null) {
  return value?.trim() || "—";
}

export default function WaitingListClient() {
  const { t, dir, locale } = useClientLocale();
  const [items, setItems] = useState<WaitingListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const dialogRef = useRef<HTMLDivElement>(null);

  const fetchRequests = useCallback(async (targetPage = page) => {
    setLoading(true);
    setErrorKey(null);
    try {
      const response = await fetch(`/api/admin/waiting-list?page=${targetPage}&limit=20`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | (Partial<ListResponse> & { errorCode?: string })
        | null;
      if (!response.ok) {
        setErrorKey(waitingListErrorKey(response.status, typeof payload?.errorCode === "string" ? payload.errorCode : undefined));
        return;
      }
      setItems(Array.isArray(payload?.data) ? payload.data : []);
      setPage(typeof payload?.page === "number" ? payload.page : targetPage);
      setTotalPages(Math.max(1, typeof payload?.totalPages === "number" ? payload.totalPages : 1));
    } catch {
      setErrorKey("waitingListErrorNetwork");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void fetchRequests(page);
  }, [fetchRequests, page]);

  useEffect(() => {
    const onFocus = () => void fetchRequests(page);
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [fetchRequests, page]);

  useEffect(() => {
    if (!dialog) return;
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      "button, textarea, input, a, [tabindex]:not([tabindex='-1'])",
    );
    firstFocusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyId) {
        setDialog(null);
        setReason("");
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button, textarea, input, a, [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busyId, dialog]);

  function openDialog(action: "approve" | "reject", item: WaitingListItem) {
    setReason("");
    setDialog({ action, item });
  }

  async function submitDecision() {
    if (!dialog) return;
    const { action, item } = dialog;
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/admin/waiting-list/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "reject" && reason.trim() ? { reason: reason.trim() } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        errorCode?: string;
      } | null;
      if (response.ok) {
        toast.success(
          action === "approve"
            ? t("admin.waiting_list.approved_success")
            : t("admin.waiting_list.rejected_success"),
        );
        setDialog(null);
        setReason("");
        setItems((current) => current.filter((entry) => entry.id !== item.id));
        window.dispatchEvent(new Event("waiting-list-updated"));
        return;
      }

      const message =
        response.status === 409 && payload?.errorCode === "WAITING_LIST_TRIP_IN_PAST"
          ? payload.error ?? t("admin.waiting_list.past_error")
          : response.status === 409
            ? t("admin.waiting_list.conflict")
            : t(`admin.waiting_list.${waitingListErrorMessageKey(waitingListErrorKey(response.status, payload?.errorCode))}`);
      toast.error(message);
      if (response.status === 409) await fetchRequests(page);
    } catch {
      toast.error(t("admin.waiting_list.error_network"));
    } finally {
      setBusyId(null);
    }
  }

  const errorMessage = errorKey
    ? t(`admin.waiting_list.${waitingListErrorMessageKey(errorKey as Parameters<typeof waitingListErrorMessageKey>[0])}`)
    : "";

  return (
    <div dir={dir} style={{ display: "grid", gap: 16, direction: dir }}>
      <Toaster position={dir === "rtl" ? "top-left" : "top-right"} />
      {loading && items.length === 0 ? (
        <AdminCard>
          <AdminLoadingState title={t("admin.waiting_list.loading")} />
        </AdminCard>
      ) : errorKey && items.length === 0 ? (
        <AdminCard>
          <AdminErrorState
            title={t("admin.waiting_list.error_title")}
            description={errorMessage}
            action={
              <AdminButton onClick={() => void fetchRequests(page)}>
                {t("admin.waiting_list.retry")}
              </AdminButton>
            }
          />
        </AdminCard>
      ) : items.length === 0 ? (
        <AdminCard>
          <AdminEmptyState
            title={t("admin.waiting_list.empty_title")}
            description={t("admin.waiting_list.empty_description")}
          />
        </AdminCard>
      ) : (
        <>
          {items.map((item) => {
            const age = formatWaitingListAge(item.createdAt, nowMs);
            const ageValue = age.unit === "justNow"
              ? t("admin.waiting_list.just_now")
              : t(`admin.waiting_list.${age.unit === "minutes" ? "minute" : age.unit === "hours" ? "hour" : "day"}`, { count: age.count });
            const isBusy = busyId === item.id;
            return (
              <AdminCard key={item.id} className="waiting-list-request-card">
                <div className="waiting-list-request-header">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <h2 style={{ margin: 0, color: "var(--color-primary)", fontSize: 18 }}>
                        {displayValue(item.passenger?.name)}
                      </h2>
                      {item.hasPastTrip ? (
                        <AdminStatusBadge status="warning" label={t("admin.waiting_list.past_badge")} />
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 13 }}>
                      <a href={item.passenger?.phone ? `tel:${item.passenger.phone}` : undefined} style={{ color: "var(--color-secondary)" }}>
                        <Phone size={14} aria-hidden="true" /> {displayValue(item.passenger?.phone)}
                      </a>
                      <a href={item.passenger?.email ? `mailto:${item.passenger.email}` : undefined} style={{ color: "var(--color-secondary)" }}>
                        <Mail size={14} aria-hidden="true" /> {displayValue(item.passenger?.email)}
                      </a>
                    </div>
                  </div>
                  <div style={{ textAlign: dir === "rtl" ? "left" : "right", flexShrink: 0 }}>
                    <strong style={{ display: "block", color: "var(--color-primary)", fontSize: 17 }}>{formatEgp(locale, item.totalFare)}</strong>
                    <time title={new Date(item.createdAt).toLocaleString()} style={{ display: "block", marginTop: 4, color: "var(--color-muted)", fontSize: 12 }}>
                      <Clock3 size={13} aria-hidden="true" /> {t("admin.waiting_list.waiting", { value: ageValue })}
                    </time>
                  </div>
                </div>

                {item.hasPastTrip ? (
                  <p className="waiting-list-past-note">{t("admin.waiting_list.past_description")}</p>
                ) : null}

                <div className="waiting-list-meta-grid">
                  <div><span>{t("admin.waiting_list.promo")}</span><strong>{item.promoCodes.length ? item.promoCodes.join(", ") : "—"}</strong></div>
                  <div><span>{t("admin.waiting_list.note")}</span><strong>{displayValue(item.note)}</strong></div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {item.trips.map((trip, index) => (
                    <div key={trip.id} className="waiting-list-trip">
                      <div className="waiting-list-trip-title">
                        <strong>{t("admin.waiting_list.trip", { count: index + 1 })}</strong>
                        <AdminStatusBadge status="pending" label={trip.vehicleType.replace(/_/g, " ")} />
                      </div>
                      <div className="waiting-list-route">
                        <span><MapPin size={14} aria-hidden="true" /><b>{t("admin.waiting_list.pickup")}:</b> <span dir="auto">{displayValue(trip.route.pickup?.address)}</span></span>
                        <span><MapPin size={14} aria-hidden="true" /><b>{t("admin.waiting_list.dropoff")}:</b> <span dir="auto">{displayValue(trip.route.dropoff?.address)}</span></span>
                      </div>
                      <div className="waiting-list-trip-facts">
                        <span><b>{t("admin.waiting_list.date")}:</b> {trip.date}</span>
                        <span><b>{t("admin.waiting_list.pickup_time")}:</b> {trip.pickupTime}</span>
                        <span><b>{t("admin.waiting_list.arrival_time")}:</b> {trip.arrivalTime}</span>
                        <span><b>{t("admin.waiting_list.passengers")}:</b> {trip.numberOfPassengers}</span>
                        <span><b>{t("admin.waiting_list.fare")}:</b> {formatEgp(locale, trip.fare)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="waiting-list-actions">
                  <AdminButton
                    variant="primary"
                    disabled={isBusy || item.hasPastTrip}
                    onClick={() => openDialog("approve", item)}
                    aria-label={`${t("admin.waiting_list.approve")} ${displayValue(item.passenger?.name)}`}
                  >
                    {isBusy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    {t("admin.waiting_list.approve")}
                  </AdminButton>
                  <AdminButton
                    variant="destructive"
                    disabled={isBusy}
                    onClick={() => openDialog("reject", item)}
                    aria-label={`${t("admin.waiting_list.reject")} ${displayValue(item.passenger?.name)}`}
                  >
                    {isBusy ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
                    {t("admin.waiting_list.reject")}
                  </AdminButton>
                </div>
              </AdminCard>
            );
          })}
          <AdminPagination page={page} totalPages={totalPages} onPageChange={(nextPage) => setPage(nextPage)} />
        </>
      )}

      {dialog ? (
        <div
          role="presentation"
          className="waiting-list-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busyId) {
              setDialog(null);
              setReason("");
            }
          }}
        >
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="waiting-list-dialog-title" className="waiting-list-dialog" dir={dir}>
            <h2 id="waiting-list-dialog-title">{t(dialog.action === "approve" ? "admin.waiting_list.confirm_approve_title" : "admin.waiting_list.confirm_reject_title")}</h2>
            <p>{t(dialog.action === "approve" ? "admin.waiting_list.confirm_approve_description" : "admin.waiting_list.confirm_reject_description")}</p>
            {dialog.action === "reject" ? (
              <label style={{ display: "grid", gap: 6 }}>
                <span>{t("admin.waiting_list.reason_label")}</span>
                <textarea value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} rows={4} />
                <small>{reason.length}/500</small>
              </label>
            ) : null}
            <div className="waiting-list-dialog-actions">
              <AdminButton variant="ghost" disabled={Boolean(busyId)} onClick={() => { setDialog(null); setReason(""); }}>
                {t("admin.waiting_list.cancel")}
              </AdminButton>
              <AdminButton variant={dialog.action === "approve" ? "primary" : "destructive"} disabled={Boolean(busyId)} onClick={() => void submitDecision()}>
                {busyId ? <Loader2 size={15} className="animate-spin" /> : null}
                {t("admin.waiting_list.confirm")}
              </AdminButton>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        .waiting-list-request-header { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; }
        .waiting-list-request-header a { display:inline-flex; align-items:center; gap:5px; text-decoration:none; }
        .waiting-list-past-note { margin:14px 0 0; color:var(--color-warning); font-size:13px; font-weight:700; }
        .waiting-list-meta-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin:16px 0; }
        .waiting-list-meta-grid > div { display:grid; gap:4px; min-width:0; padding:11px 12px; background:var(--color-background); border:1px solid var(--color-border); border-radius:var(--radius-sm); }
        .waiting-list-meta-grid span { color:var(--color-muted); font-size:11px; font-weight:800; text-transform:uppercase; }
        .waiting-list-meta-grid strong { color:var(--color-primary); font-size:13px; overflow-wrap:anywhere; }
        .waiting-list-trip { display:grid; gap:10px; padding:14px; background:color-mix(in srgb, var(--color-secondary-tint) 35%, var(--color-panel)); border:1px solid var(--color-border); border-radius:var(--radius-sm); }
        .waiting-list-trip-title { display:flex; justify-content:space-between; gap:12px; align-items:center; }
        .waiting-list-route { display:grid; gap:7px; color:var(--color-primary); font-size:13px; }
        .waiting-list-route span { display:flex; align-items:flex-start; gap:6px; min-width:0; }
        .waiting-list-route svg { color:var(--color-secondary); flex-shrink:0; margin-top:2px; }
        .waiting-list-trip-facts { display:flex; flex-wrap:wrap; gap:8px 16px; color:var(--color-muted); font-size:12px; }
        .waiting-list-actions { display:flex; gap:9px; flex-wrap:wrap; justify-content:flex-end; margin-top:16px; }
        .waiting-list-dialog-backdrop { position:fixed; inset:0; z-index:500; display:grid; place-items:center; padding:20px; background:rgba(11,30,61,.55); }
        .waiting-list-dialog { width:min(460px,100%); display:grid; gap:14px; padding:22px; background:var(--color-panel); color:var(--color-primary); border:1px solid var(--color-border); border-radius:var(--radius-md); box-shadow:0 20px 60px rgba(11,30,61,.25); }
        .waiting-list-dialog h2 { margin:0; font-size:19px; }
        .waiting-list-dialog p { margin:0; color:var(--color-muted); font-size:14px; line-height:1.55; }
        .waiting-list-dialog textarea { width:100%; box-sizing:border-box; resize:vertical; border:1px solid var(--color-border); border-radius:var(--radius-sm); padding:10px; background:var(--color-background); color:var(--color-primary); font:inherit; }
        .waiting-list-dialog small { color:var(--color-muted); text-align:end; }
        .waiting-list-dialog-actions { display:flex; justify-content:flex-end; gap:9px; flex-wrap:wrap; }
        @media (max-width: 640px) { .waiting-list-request-header { flex-direction:column; } .waiting-list-request-header > div:last-child { text-align:start !important; } .waiting-list-meta-grid { grid-template-columns:1fr; } .waiting-list-actions > button { flex:1 1 140px; justify-content:center; } }
      `}</style>
    </div>
  );
}
