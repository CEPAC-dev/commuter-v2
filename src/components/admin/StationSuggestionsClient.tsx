"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { AdminPageContainer, AdminPageHeader } from "@/components/admin/layout";
import AdminTripMap, { type TripMapPoint } from "@/components/admin/AdminTripMap";
import StationLocationPicker from "@/components/admin/StationLocationPicker";
import { useClientLocale } from "@/lib/locale.client";
import type { RegionCode } from "@/lib/config/regions";

type SuggestionRequest = {
  _id: string;
  requestNumber: number;
  requester: {
    userNumber: number;
    name: string;
    email: string;
    phone: string;
  };
  regionCode: RegionCode;
  locationType: "pickup" | "dropoff";
  targetLocation: { address: string; lat: number; lng: number };
  suggestedPoint: { lat: number; lng: number };
  zoneName?: string;
  description: string;
  status: "pending" | "processing" | "approved" | "rejected";
  rejectionReason?: string;
  createdAt: string;
};

type StationDraft = {
  name: string;
  direction: string;
  zones: string;
  landmark: string;
  stationType: string;
  lat: string;
  lng: string;
};

const STATUSES = ["pending", "processing", "approved", "rejected", "all"];

export default function StationSuggestionsClient({
  regionCode,
}: {
  regionCode: RegionCode;
}) {
  const { t, locale } = useClientLocale();
  const [requests, setRequests] = useState<SuggestionRequest[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<SuggestionRequest | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [station, setStation] = useState<StationDraft>({
    name: "",
    direction: "",
    zones: "",
    landmark: "",
    stationType: "1",
    lat: "",
    lng: "",
  });

  const loadRequests = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          status,
          search: query.trim(),
          region: regionCode,
        });
        const response = await fetch(
          `/api/admin/station-suggestions?${params.toString()}`,
          { signal },
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? t("admin.station_suggestions.load_error"));
        }
        const pages = Math.max(1, data.totalPages ?? 1);
        if (page > pages) {
          setPage(pages);
          return;
        }
        setRequests(data.requests ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(pages);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : t("admin.station_suggestions.load_error"),
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, query, regionCode, status, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadRequests(controller.signal);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadRequests]);

  useEffect(() => {
    if (!selected) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        setSelected(null);
        setDecision(null);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [saving, selected]);

  function openDetails(request: SuggestionRequest) {
    setSelected(request);
    setDecision(null);
    setRejectionReason("");
    setNotice("");
  }

  function beginApproval(request: SuggestionRequest) {
    setStation({
      name: request.description.slice(0, 100),
      direction: "",
      zones: request.zoneName ?? "",
      landmark: "",
      stationType: "1",
      lat: String(request.suggestedPoint.lat),
      lng: String(request.suggestedPoint.lng),
    });
    setDecision("approve");
  }

  async function reviewRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !decision) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/station-suggestions/${selected._id}?region=${encodeURIComponent(regionCode)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            decision === "approve"
              ? {
                  action: decision,
                  station: {
                    ...station,
                    lat: Number(station.lat),
                    lng: Number(station.lng),
                  },
                }
              : { action: decision, rejectionReason: rejectionReason.trim() },
          ),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error ?? t("admin.station_suggestions.review_error"),
        );
      }
      setSelected(null);
      setDecision(null);
      setNotice(
        decision === "approve"
          ? t("admin.station_suggestions.approved")
          : t("admin.station_suggestions.rejected"),
      );
      await loadRequests();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : t("admin.station_suggestions.review_error"),
      );
    } finally {
      setSaving(false);
    }
  }

  const mapPoints = useMemo<TripMapPoint[]>(
    () =>
      selected
        ? [
            {
              lat: selected.targetLocation.lat,
              lng: selected.targetLocation.lng,
              label: t("admin.station_suggestions.target_location"),
              kind: selected.locationType === "pickup" ? "pickup" : "dropoff",
            },
            {
              lat: selected.suggestedPoint.lat,
              lng: selected.suggestedPoint.lng,
              label: t("admin.station_suggestions.suggested_station"),
              kind: "station",
            },
          ]
        : [],
    [selected, t],
  );

  function statusLabel(value: string) {
    return t(`admin.station_suggestions.status_${value}`);
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  return (
    <AdminPageContainer>
      <AdminPageHeader
        title={t("admin.station_suggestions.title")}
        description={t("admin.station_suggestions.subtitle")}
      />
      <section className="station-suggestion-admin" dir={locale === "ar" ? "rtl" : "ltr"}>
        <div className="station-suggestion-toolbar">
          <label className="station-suggestion-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">
              {t("admin.station_suggestions.search_label")}
            </span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={t("admin.station_suggestions.search_placeholder")}
            />
          </label>
          <label className="station-suggestion-filter">
            <span>{t("admin.station_suggestions.filter_label")}</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {notice && (
          <p className="station-suggestion-admin-notice" role="status">
            <Check size={17} aria-hidden="true" />
            {notice}
          </p>
        )}
        {error && (
          <p className="station-suggestion-admin-error" role="alert">
            {error}
          </p>
        )}
        <div className="station-suggestion-table-wrap">
          <table className="station-suggestion-table">
            <thead>
              <tr>
                <th>{t("admin.station_suggestions.request_number")}</th>
                <th>{t("admin.station_suggestions.requester")}</th>
                <th>{t("admin.station_suggestions.location_type")}</th>
                <th>{t("admin.station_suggestions.description")}</th>
                <th>{t("admin.station_suggestions.status")}</th>
                <th>{t("admin.station_suggestions.submitted")}</th>
                <th>
                  <span className="sr-only">
                    {t("admin.station_suggestions.actions")}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="station-suggestion-empty">
                    <Loader2 className="spin" size={18} aria-hidden="true" />
                    {t("admin.station_suggestions.loading")}
                  </td>
                </tr>
              ) : requests.length ? (
                requests.map((request) => (
                  <tr key={request._id}>
                    <td data-label={t("admin.station_suggestions.request_number")}>
                      <strong>#{request.requestNumber}</strong>
                    </td>
                    <td data-label={t("admin.station_suggestions.requester")}>
                      <strong>{request.requester.name}</strong>
                      <small>
                        {t("admin.station_suggestions.user_code")}:{" "}
                        {request.requester.userNumber}
                      </small>
                    </td>
                    <td data-label={t("admin.station_suggestions.location_type")}>
                      {request.locationType === "pickup"
                        ? t("admin.station_suggestions.pickup")
                        : t("admin.station_suggestions.dropoff")}
                    </td>
                    <td data-label={t("admin.station_suggestions.description")}>
                      <span className="station-suggestion-description-cell">
                        {request.description}
                      </span>
                    </td>
                    <td data-label={t("admin.station_suggestions.status")}>
                      <span
                        className={`station-suggestion-status is-${request.status}`}
                      >
                        {statusLabel(request.status)}
                      </span>
                    </td>
                    <td data-label={t("admin.station_suggestions.submitted")}>
                      {formatDate(request.createdAt)}
                    </td>
                    <td data-label={t("admin.station_suggestions.actions")}>
                      <button
                        type="button"
                        className="station-suggestion-view"
                        onClick={() => openDetails(request)}
                      >
                        {t("admin.station_suggestions.view_details")}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="station-suggestion-empty">
                    {t("admin.station_suggestions.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="station-suggestion-pagination">
          <span>
            {t("admin.station_suggestions.result_count").replace(
              "{count}",
              String(total),
            )}
          </span>
          <div>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label={t("admin.station_suggestions.previous")}
            >
              {locale === "ar" ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
              {t("admin.station_suggestions.previous")}
            </button>
            <span>
              {t("admin.station_suggestions.page_of")
                .replace("{page}", String(page))
                .replace("{pages}", String(totalPages))}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              aria-label={t("admin.station_suggestions.next")}
            >
              {t("admin.station_suggestions.next")}
              {locale === "ar" ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
            </button>
          </div>
        </footer>
      </section>

      {selected && (
        <div className="station-suggestion-overlay">
          <section
            className="station-suggestion-dialog station-suggestion-review-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="station-suggestion-review-title"
          >
            <header className="station-suggestion-header">
              <div>
                <h2 id="station-suggestion-review-title">
                  {decision === "approve"
                    ? t("admin.station_suggestions.approval_title")
                    : decision === "reject"
                      ? t("admin.station_suggestions.rejection_title")
                      : t("admin.station_suggestions.details_title").replace(
                          "{requestNumber}",
                          String(selected.requestNumber),
                        )}
                </h2>
              </div>
              <button
                type="button"
                className="station-suggestion-close"
                disabled={saving}
                onClick={() => {
                  setSelected(null);
                  setDecision(null);
                }}
                aria-label={t("admin.station_suggestions.close")}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <div className="station-suggestion-review-body">
              <div className="station-suggestion-requester-card">
                <strong>{selected.requester.name}</strong>
                <span>
                  {t("admin.station_suggestions.user_code")}:{" "}
                  {selected.requester.userNumber}
                </span>
                <a href={`mailto:${selected.requester.email}`}>
                  {selected.requester.email || "—"}
                </a>
                <a href={`tel:${selected.requester.phone}`}>
                  {selected.requester.phone}
                </a>
              </div>
              <div className="station-suggestion-review-details">
                <div>
                  <strong>{t("admin.station_suggestions.location_type")}</strong>
                  <span>
                    {selected.locationType === "pickup"
                      ? t("admin.station_suggestions.pickup")
                      : t("admin.station_suggestions.dropoff")}
                  </span>
                </div>
                <div>
                  <strong>{t("admin.station_suggestions.target_location")}</strong>
                  <span>{selected.targetLocation.address}</span>
                </div>
                <div>
                  <strong>{t("admin.station_suggestions.description")}</strong>
                  <span>{selected.description}</span>
                </div>
                <div>
                  <strong>{t("admin.station_suggestions.suggested_station")}</strong>
                  <span>
                    {selected.suggestedPoint.lat.toFixed(6)},{" "}
                    {selected.suggestedPoint.lng.toFixed(6)}
                  </span>
                </div>
                <div>
                  <strong>{t("admin.station_suggestions.station_zones")}</strong>
                  <span>{selected.zoneName || "—"}</span>
                </div>
                <div>
                  <strong>{t("admin.station_suggestions.submitted")}</strong>
                  <span>{formatDate(selected.createdAt)}</span>
                </div>
                {selected.rejectionReason && (
                  <div>
                    <strong>{t("admin.station_suggestions.rejection_reason")}</strong>
                    <span>{selected.rejectionReason}</span>
                  </div>
                )}
              </div>
              <div className="station-suggestion-preview-map">
                <AdminTripMap points={mapPoints} stationOnly />
              </div>

              {!decision && selected.status === "pending" && (
                <div className="station-suggestion-decision-actions">
                  <button
                    type="button"
                    className="station-suggestion-approve"
                    onClick={() => beginApproval(selected)}
                  >
                    <Check size={16} aria-hidden="true" />
                    {t("admin.station_suggestions.approve")}
                  </button>
                  <button
                    type="button"
                    className="station-suggestion-reject"
                    onClick={() => setDecision("reject")}
                  >
                    {t("admin.station_suggestions.reject")}
                  </button>
                </div>
              )}

              {decision && (
                <form
                  onSubmit={reviewRequest}
                  className="station-suggestion-form station-suggestion-decision-form"
                >
                  {decision === "approve" ? (
                    <>
                      <p className="station-suggestion-form-intro">
                        {t("admin.station_suggestions.station_form_intro")}
                      </p>
                      <label>
                        {t("admin.station_suggestions.station_name")}
                        <input
                          value={station.name}
                          onChange={(event) =>
                            setStation({ ...station, name: event.target.value })
                          }
                          maxLength={100}
                        />
                      </label>
                      <label>
                        {t("admin.station_suggestions.station_direction")}
                        <input
                          value={station.direction}
                          onChange={(event) =>
                            setStation({
                              ...station,
                              direction: event.target.value,
                            })
                          }
                          maxLength={300}
                        />
                      </label>
                      <label>
                        {t("admin.station_suggestions.station_zones")}
                        <input
                          value={station.zones}
                          readOnly
                          aria-readonly="true"
                        />
                      </label>
                      <label>
                        {t("admin.station_suggestions.station_landmark")}
                        <input
                          value={station.landmark}
                          onChange={(event) =>
                            setStation({
                              ...station,
                              landmark: event.target.value,
                            })
                          }
                          maxLength={300}
                        />
                      </label>
                      <label>
                        {t("admin.station_suggestions.station_type")}
                        <select
                          value={station.stationType}
                          onChange={(event) =>
                            setStation({
                              ...station,
                              stationType: event.target.value,
                            })
                          }
                          required
                        >
                          <option value="1">
                            {t("admin.station_suggestions.station_type_option_1")}
                          </option>
                          <option value="2">
                            {t("admin.station_suggestions.station_type_option_2")}
                          </option>
                          <option value="3">
                            {t("admin.station_suggestions.station_type_option_3")}
                          </option>
                        </select>
                      </label>
                      <div className="station-suggestion-coordinate-grid">
                        <label>
                          {t("admin.station_suggestions.latitude")} *
                          <input
                            type="number"
                            step="any"
                            min="-90"
                            max="90"
                            value={station.lat}
                            onChange={(event) =>
                              setStation({ ...station, lat: event.target.value })
                            }
                            required
                          />
                        </label>
                        <label>
                          {t("admin.station_suggestions.longitude")} *
                          <input
                            type="number"
                            step="any"
                            min="-180"
                            max="180"
                            value={station.lng}
                            onChange={(event) =>
                              setStation({ ...station, lng: event.target.value })
                            }
                            required
                          />
                        </label>
                      </div>
                      <StationLocationPicker
                        initialPoint={{
                          lat: Number(station.lat),
                          lng: Number(station.lng),
                        }}
                        onSelect={(point, zoneName) => {
                          setStation((current) => ({
                            ...current,
                            lat: String(point.lat),
                            lng: String(point.lng),
                            zones: zoneName,
                          }));
                        }}
                      />
                    </>
                  ) : (
                    <label>
                      {t("admin.station_suggestions.rejection_reason")}
                      <textarea
                        value={rejectionReason}
                        onChange={(event) =>
                          setRejectionReason(event.target.value)
                        }
                        rows={3}
                        maxLength={400}
                      />
                    </label>
                  )}
                  {error && (
                    <p role="alert" className="station-suggestion-error">
                      {error}
                    </p>
                  )}
                  <div className="station-suggestion-actions">
                    <button
                      type="button"
                      className="station-suggestion-secondary"
                      onClick={() => setDecision(null)}
                      disabled={saving}
                    >
                      {t("admin.station_suggestions.cancel")}
                    </button>
                    <button
                      type="submit"
                      className={
                        decision === "approve"
                          ? "station-suggestion-submit"
                          : "station-suggestion-submit is-danger"
                      }
                      disabled={saving}
                    >
                      {saving && (
                        <Loader2 size={16} className="spin" aria-hidden="true" />
                      )}
                      {decision === "approve"
                        ? t("admin.station_suggestions.create_and_approve")
                        : t("admin.station_suggestions.confirm_rejection")}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </div>
      )}
    </AdminPageContainer>
  );
}
