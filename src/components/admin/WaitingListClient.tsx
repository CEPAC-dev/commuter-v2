"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, Mail, MapPin, Phone, X } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { useClientLocale } from "@/lib/i18n/client";
import { formatDate, formatEgp, formatTime } from "@/lib/i18n";
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
  formatWaitingListAge,
  waitingListErrorKey,
  waitingListErrorMessageKey,
} from "@/lib/admin/waitingListUi";
import {
  groupIdenticalWaitingListTripFields,
  type WaitingListTripField,
} from "@/lib/admin/waitingListTripFields";

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
  preferedGender: "male" | "female" | null;
  fare: number;
};

type WaitingListItem = {
  kind: "trip" | "request";
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
  const [sharedRideWaitingListEnabled, setSharedRideWaitingListEnabled] =
    useState(true);
  const [settingUpdatedByName, setSettingUpdatedByName] = useState<string | null>(null);
  const [settingUpdatedAt, setSettingUpdatedAt] = useState<string | null>(null);
  const [settingLoading, setSettingLoading] = useState(true);
  const [settingSaving, setSettingSaving] = useState(false);
  const [confirmTurnOff, setConfirmTurnOff] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const fetchWaitingListSetting = useCallback(async () => {
    setSettingLoading(true);
    try {
      const response = await fetch("/api/admin/settings/waiting-list", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.data) throw new Error("settings-load");
      setSharedRideWaitingListEnabled(
        payload.data.sharedRideWaitingListEnabled !== false,
      );
      setSettingUpdatedByName(payload.data.updatedByName ?? null);
      setSettingUpdatedAt(payload.data.updatedAt ?? null);
    } catch {
      toast.error(t("admin.waiting_list.settings_load_error"));
    } finally {
      setSettingLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchWaitingListSetting();
  }, [fetchWaitingListSetting]);

  async function saveWaitingListSetting(enabled: boolean) {
    setSettingSaving(true);
    try {
      const response = await fetch("/api/admin/settings/waiting-list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharedRideWaitingListEnabled: enabled }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.data) throw new Error("settings-save");
      setSharedRideWaitingListEnabled(
        payload.data.sharedRideWaitingListEnabled !== false,
      );
      setSettingUpdatedByName(payload.data.updatedByName ?? null);
      setSettingUpdatedAt(payload.data.updatedAt ?? null);
      setConfirmTurnOff(false);
      toast.success(
        t(
          enabled
            ? "admin.waiting_list.settings_enabled_success"
            : "admin.waiting_list.settings_disabled_success",
        ),
      );
    } catch {
      toast.error(t("admin.waiting_list.settings_save_error"));
    } finally {
      setSettingSaving(false);
    }
  }

  function handleWaitingListToggle() {
    if (settingLoading || settingSaving) return;
    if (sharedRideWaitingListEnabled) {
      setConfirmTurnOff(true);
    } else {
      void saveWaitingListSetting(true);
    }
  }

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
    if (action === "reject" && !reason.trim()) {
      return;
    }
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/admin/waiting-list/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "reject" ? { reason: reason.trim() } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        errorCode?: string;
      } | null;
      if (response.ok) {
        toast.success(
          action === "approve"
            ? t(item.kind === "trip" ? "admin.waiting_list.trip_approved_success" : "admin.waiting_list.approved_success")
            : t(item.kind === "trip" ? "admin.waiting_list.trip_rejected_success" : "admin.waiting_list.rejected_success"),
        );
        setDialog(null);
        setReason("");
        setItems((current) => current.filter((entry) => entry.id !== item.id));
        window.dispatchEvent(new Event("waiting-list-updated"));
        return;
      }

      const message =
        response.status === 409 && payload?.errorCode === "WAITING_LIST_TRIP_IN_PAST"
          ? t(item.kind === "trip" ? "admin.waiting_list.trip_past_error" : "admin.waiting_list.past_error")
          : response.status === 409
            ? t(item.kind === "trip" ? "admin.waiting_list.trip_conflict" : "admin.waiting_list.conflict")
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
      <AdminCard className="waiting-list-setting-card">
        <div className="waiting-list-setting-row">
          <div className="waiting-list-setting-copy">
            <h2>{t("admin.waiting_list.settings_title")}</h2>
            <p>
              {t(
                sharedRideWaitingListEnabled
                  ? "admin.waiting_list.settings_enabled_description"
                  : "admin.waiting_list.settings_disabled_description",
              )}
            </p>
            {settingUpdatedAt ? (
              <small>
                {t("admin.waiting_list.settings_last_changed", {
                  name: settingUpdatedByName ?? "—",
                  date: new Date(settingUpdatedAt).toLocaleString(
                    locale === "ar" ? "ar-EG" : "en-EG",
                  ),
                })}
              </small>
            ) : null}
          </div>
          <div className="waiting-list-setting-control">
            <span className="waiting-list-setting-state">
              {t(
                sharedRideWaitingListEnabled
                  ? "admin.waiting_list.settings_on"
                  : "admin.waiting_list.settings_off",
              )}
            </span>
            <button
              type="button"
              role="switch"
              aria-label={t("admin.waiting_list.settings_toggle_label")}
              aria-checked={sharedRideWaitingListEnabled}
              disabled={settingLoading || settingSaving}
              onClick={handleWaitingListToggle}
              className="waiting-list-setting-switch"
            >
              <span className="waiting-list-setting-switch-knob" />
            </button>
          </div>
        </div>
      </AdminCard>

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
            const tripFields = groupIdenticalWaitingListTripFields(
              item.trips.map((trip) => ({
                pickup: trip.route.pickup?.address?.trim() ?? "",
                dropoff: trip.route.dropoff?.address?.trim() ?? "",
                pickupTime: trip.pickupTime,
                arrivalTime: trip.arrivalTime,
                numberOfPassengers: trip.numberOfPassengers,
                preferedGender: trip.preferedGender,
              })),
            );
            const isSharedField = (field: WaitingListTripField) =>
              tripFields.sharedFields.includes(field);
            const hasSharedRoute =
              isSharedField("pickup") && isSharedField("dropoff");
            return (
              <AdminCard key={item.id} className="waiting-list-request-card" padding={16}>
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
                    <div className="waiting-list-contact-links">
                      {item.passenger?.phone?.trim() ? (
                        <a href={`tel:${item.passenger.phone}`}>
                          <Phone size={14} aria-hidden="true" /> {item.passenger.phone}
                        </a>
                      ) : null}
                      {item.passenger?.email?.trim() ? (
                        <a href={`mailto:${item.passenger.email}`}>
                          <Mail size={14} aria-hidden="true" /> {item.passenger.email}
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="waiting-list-header-end">
                    <AdminStatusBadge
                      status="warning"
                      label={t("admin.waiting_list.waiting", { value: ageValue })}
                    />
                    <strong className="waiting-list-total-fare">
                      {formatEgp(locale, item.totalFare)}
                    </strong>
                  </div>
                </div>

                {item.hasPastTrip ? (
                  <p className="waiting-list-past-note">
                    {t(item.kind === "trip" ? "admin.waiting_list.trip_past_description" : "admin.waiting_list.past_description")}
                  </p>
                ) : null}

                {(item.promoCodes.length > 0 || item.note.trim()) && (
                  <div className="waiting-list-meta-lines">
                    {item.promoCodes.length > 0 && (
                      <p><b>{t("admin.waiting_list.promo")}:</b> {item.promoCodes.join(", ")}</p>
                    )}
                    {item.note.trim() && (
                      <p><b>{t("admin.waiting_list.note")}:</b> {item.note}</p>
                    )}
                  </div>
                )}

                <div className="waiting-list-shared-details">
                  {hasSharedRoute && item.trips[0] && (
                    <div className="waiting-list-shared-route">
                      <MapPin size={15} aria-hidden="true" />
                      <span dir="auto">{displayValue(item.trips[0].route.pickup?.address)}</span>
                      <ArrowRight className="rtl-directional-icon" size={15} aria-hidden="true" />
                      <span dir="auto">{displayValue(item.trips[0].route.dropoff?.address)}</span>
                    </div>
                  )}
                  <div className="waiting-list-trip-facts">
                    {isSharedField("pickupTime") && item.trips[0] && (
                      <span><b>{t("admin.waiting_list.pickup_time")}:</b> {formatTime(locale, item.trips[0].pickupTime)}</span>
                    )}
                    {isSharedField("arrivalTime") && item.trips[0] && (
                      <span><b>{t("admin.waiting_list.arrival_time")}:</b> {formatTime(locale, item.trips[0].arrivalTime)}</span>
                    )}
                    {isSharedField("numberOfPassengers") && item.trips[0] && (
                      <span><b>{t("admin.waiting_list.passengers")}:</b> {item.trips[0].numberOfPassengers}</span>
                    )}
                    {isSharedField("preferedGender") && item.trips[0] && (
                      <span><b>{t("admin.waiting_list.gender_preference")}:</b> {item.trips[0].preferedGender ? t(`gender.${item.trips[0].preferedGender}`) : t("admin.waiting_list.no_gender_preference")}</span>
                    )}
                  </div>
                  {item.trips.length > 1 && (
                    <strong className="waiting-list-days-count">
                      {t("admin.waiting_list.days_count", { count: item.trips.length })}
                    </strong>
                  )}
                  <div className="waiting-list-days">
                    {item.trips.map((trip, index) => {
                      const perDayFields = tripFields.perTripFields[index]?.fields ?? [];
                      const isPerDay = (field: WaitingListTripField) =>
                        perDayFields.includes(field);
                      const showRoutePerDay =
                        !hasSharedRoute &&
                        (isPerDay("pickup") || isPerDay("dropoff"));
                      const variableDetailFields: WaitingListTripField[] = [
                        "pickupTime",
                        "arrivalTime",
                        "numberOfPassengers",
                        "preferedGender",
                      ];
                      const hasVariableDetails =
                        showRoutePerDay ||
                        variableDetailFields.some(isPerDay);
                      return (
                        <div key={trip.id} className="waiting-list-day">
                          <div className="waiting-list-day-heading">
                            <time>{formatDate(locale, trip.date)}</time>
                            <strong>{formatEgp(locale, trip.fare)}</strong>
                          </div>
                          {hasVariableDetails && (
                            <div className="waiting-list-day-details">
                              {showRoutePerDay && (
                                <div className="waiting-list-shared-route">
                                  <MapPin size={14} aria-hidden="true" />
                                  <span dir="auto">{displayValue(trip.route.pickup?.address)}</span>
                                  <ArrowRight className="rtl-directional-icon" size={14} aria-hidden="true" />
                                  <span dir="auto">{displayValue(trip.route.dropoff?.address)}</span>
                                </div>
                              )}
                              {isPerDay("pickupTime") && <span><b>{t("admin.waiting_list.pickup_time")}:</b> {formatTime(locale, trip.pickupTime)}</span>}
                              {isPerDay("arrivalTime") && <span><b>{t("admin.waiting_list.arrival_time")}:</b> {formatTime(locale, trip.arrivalTime)}</span>}
                              {isPerDay("numberOfPassengers") && <span><b>{t("admin.waiting_list.passengers")}:</b> {trip.numberOfPassengers}</span>}
                              {isPerDay("preferedGender") && <span><b>{t("admin.waiting_list.gender_preference")}:</b> {trip.preferedGender ? t(`gender.${trip.preferedGender}`) : t("admin.waiting_list.no_gender_preference")}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="waiting-list-actions">
                  <AdminButton
                    variant="primary"
                    size="md"
                    disabled={isBusy || item.hasPastTrip}
                    onClick={() => openDialog("approve", item)}
                    aria-label={`${t("admin.waiting_list.approve")} ${displayValue(item.passenger?.name)}`}
                  >
                    {isBusy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    {t("admin.waiting_list.approve")}
                  </AdminButton>
                  <AdminButton
                    variant="secondary"
                    size="md"
                    disabled={isBusy}
                    onClick={() => openDialog("reject", item)}
                    aria-label={`${t("admin.waiting_list.reject")} ${displayValue(item.passenger?.name)}`}
                    style={{
                      color: "var(--color-danger)",
                      border: "1px solid color-mix(in srgb, var(--color-danger) 45%, white)",
                      background: "var(--color-panel)",
                    }}
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
            <p>{t(dialog.action === "approve" ? "admin.waiting_list.confirm_approve_description" : dialog.item.kind === "trip" ? "admin.waiting_list.trip_reject_description" : "admin.waiting_list.confirm_reject_description")}</p>
            {dialog.action === "reject" ? (
              <label style={{ display: "grid", gap: 6 }}>
                <span>{t("admin.waiting_list.reason_label")}</span>
                <textarea required value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} rows={4} />
                <small>{reason.length}/500</small>
              </label>
            ) : null}
            <div className="waiting-list-dialog-actions">
              <AdminButton variant="ghost" disabled={Boolean(busyId)} onClick={() => { setDialog(null); setReason(""); }}>
                {t("admin.waiting_list.cancel")}
              </AdminButton>
              <AdminButton variant={dialog.action === "approve" ? "primary" : "destructive"} disabled={Boolean(busyId) || (dialog.action === "reject" && !reason.trim())} onClick={() => void submitDecision()}>
                {busyId ? <Loader2 size={15} className="animate-spin" /> : null}
                {t("admin.waiting_list.confirm")}
              </AdminButton>
            </div>
          </div>
        </div>
      ) : null}

      {confirmTurnOff ? (
        <div
          role="presentation"
          className="waiting-list-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !settingSaving) {
              setConfirmTurnOff(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="waiting-list-toggle-dialog-title"
            className="waiting-list-dialog"
            dir={dir}
          >
            <h2 id="waiting-list-toggle-dialog-title">
              {t("admin.waiting_list.settings_confirm_title")}
            </h2>
            <p>{t("admin.waiting_list.settings_confirm_description")}</p>
            <div className="waiting-list-dialog-actions">
              <AdminButton
                variant="ghost"
                disabled={settingSaving}
                onClick={() => setConfirmTurnOff(false)}
              >
                {t("admin.waiting_list.cancel")}
              </AdminButton>
              <AdminButton
                variant="destructive"
                disabled={settingSaving}
                onClick={() => void saveWaitingListSetting(false)}
              >
                {settingSaving ? <Loader2 size={15} className="animate-spin" /> : null}
                {t("admin.waiting_list.settings_confirm_off")}
              </AdminButton>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        .waiting-list-setting-row { display:flex; justify-content:space-between; align-items:center; gap:20px; }
        .waiting-list-setting-copy { min-width:0; }
        .waiting-list-setting-copy h2 { margin:0; color:var(--color-primary); font-size:16px; }
        .waiting-list-setting-copy p { margin:5px 0 0; color:var(--color-muted); font-size:13px; line-height:1.5; }
        .waiting-list-setting-copy small { display:block; margin-top:7px; color:var(--color-muted); font-size:12px; }
        .waiting-list-setting-control { display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .waiting-list-setting-state { color:var(--color-primary); font-size:13px; font-weight:800; }
        .waiting-list-setting-switch { position:relative; width:48px; height:28px; padding:3px; border:0; border-radius:999px; background:${sharedRideWaitingListEnabled ? "var(--color-secondary)" : "var(--color-border)"}; cursor:pointer; transition:background .15s ease; }
        .waiting-list-setting-switch:disabled { cursor:not-allowed; opacity:.6; }
        .waiting-list-setting-switch-knob { display:block; width:22px; height:22px; border-radius:50%; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,.2); transform:translateX(${sharedRideWaitingListEnabled ? (dir === "rtl" ? "-20px" : "20px") : "0"}); transition:transform .15s ease; }
        .waiting-list-request-header { display:flex; justify-content:space-between; gap:16px; align-items:center; }
        .waiting-list-contact-links { display:flex; gap:12px 16px; flex-wrap:wrap; margin-top:6px; font-size:12px; }
        .waiting-list-contact-links a { display:inline-flex; align-items:center; gap:5px; color:var(--color-muted); text-decoration:none; overflow-wrap:anywhere; }
        .waiting-list-contact-links a:hover { color:var(--color-secondary); }
        .waiting-list-header-end { display:flex; align-items:center; justify-content:flex-end; gap:12px; flex-wrap:wrap; flex-shrink:0; }
        .waiting-list-total-fare { color:var(--color-primary); font-size:17px; font-variant-numeric:tabular-nums; white-space:nowrap; }
        .waiting-list-past-note { margin:12px 0 0; color:var(--color-warning); font-size:13px; font-weight:700; }
        .waiting-list-meta-lines { display:grid; gap:5px; margin-top:12px; color:var(--color-muted); font-size:12px; line-height:1.5; }
        .waiting-list-meta-lines p { margin:0; overflow-wrap:anywhere; }
        .waiting-list-meta-lines b { color:var(--color-primary); }
        .waiting-list-shared-details { display:grid; gap:10px; margin-top:14px; }
        .waiting-list-shared-route { display:flex; align-items:center; gap:8px; min-width:0; color:var(--color-primary); font-size:13px; font-weight:700; }
        .waiting-list-shared-route > span { min-width:0; overflow-wrap:anywhere; }
        .waiting-list-shared-route > svg { flex:0 0 auto; color:var(--color-secondary); }
        .waiting-list-trip-facts { display:flex; flex-wrap:wrap; gap:7px 16px; color:var(--color-muted); font-size:12px; }
        .waiting-list-trip-facts b, .waiting-list-day-details b { color:var(--color-primary); }
        .waiting-list-days-count { color:var(--color-muted); font-size:12px; }
        .waiting-list-days { display:flex; flex-wrap:wrap; gap:8px; }
        .waiting-list-day { display:grid; flex:1 1 200px; gap:5px; min-width:0; max-width:100%; padding:8px 10px; border:1px solid var(--color-border); border-radius:var(--radius-sm); background:var(--color-background); }
        .waiting-list-day-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; color:var(--color-primary); font-size:12px; }
        .waiting-list-day-heading time { color:var(--color-muted); }
        .waiting-list-day-heading strong { white-space:nowrap; font-variant-numeric:tabular-nums; }
        .waiting-list-day-details { display:grid; gap:4px; color:var(--color-muted); font-size:11px; line-height:1.4; }
        .waiting-list-day-details > span { overflow-wrap:anywhere; }
        .waiting-list-actions { display:flex; gap:9px; flex-wrap:wrap; justify-content:flex-end; margin-top:14px; }
        .waiting-list-actions > button { min-width:120px; min-height:42px; justify-content:center; }
        .waiting-list-dialog-backdrop { position:fixed; inset:0; z-index:500; display:grid; place-items:center; padding:20px; background:rgba(11,30,61,.55); }
        .waiting-list-dialog { width:min(460px,100%); display:grid; gap:14px; padding:22px; background:var(--color-panel); color:var(--color-primary); border:1px solid var(--color-border); border-radius:var(--radius-md); box-shadow:0 20px 60px rgba(11,30,61,.25); }
        .waiting-list-dialog h2 { margin:0; font-size:19px; }
        .waiting-list-dialog p { margin:0; color:var(--color-muted); font-size:14px; line-height:1.55; }
        .waiting-list-dialog textarea { width:100%; box-sizing:border-box; resize:vertical; border:1px solid var(--color-border); border-radius:var(--radius-sm); padding:10px; background:var(--color-background); color:var(--color-primary); font:inherit; }
        .waiting-list-dialog small { color:var(--color-muted); text-align:end; }
        .waiting-list-dialog-actions { display:flex; justify-content:flex-end; gap:9px; flex-wrap:wrap; }
        @media (max-width: 640px) { .waiting-list-setting-row { align-items:flex-start; flex-direction:column; } .waiting-list-setting-control { width:100%; justify-content:space-between; } .waiting-list-request-header { align-items:stretch; flex-direction:column; } .waiting-list-header-end { justify-content:space-between; } .waiting-list-actions { display:grid; grid-template-columns:minmax(0,1fr); } .waiting-list-actions > button { width:100%; } }
      `}</style>
    </div>
  );
}
