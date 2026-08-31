"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Loader2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

interface RefundRequestItem {
  _id: string;
  tripId?: {
    _id: string;
    tripNumber?: number;
    date: string;
    pickup?: { address: string };
    dropoff?: { address: string };
    priceEgp: number;
    status: string;
  };
  passengerId?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  requestedAt: string;
  refundAmount: number;
  retainedAmount: number;
  tier: string;
  status: "pending" | "approved" | "rejected";
  reviewedAt?: string;
  reviewedBy?: {
    name: string;
    email: string;
  };
  rejectionReason?: string;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function RefundRequestsClient() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [requests, setRequests] = useState<RefundRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Rejection modal state
  const [rejectingItem, setRejectingItem] = useState<RefundRequestItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function fetchRequests() {
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch(`/api/admin/refund-requests?status=${statusFilter}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load refund requests");
      setRequests(json.data || []);
    } catch (error: unknown) {
      setMessage({ type: "error", text: errorMessage(error, "Error loading requests") });
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      setActionLoadingId(id);
      setMessage(null);
      const res = await fetch(`/api/admin/refund-requests/${id}/approve`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Approval failed");

      setMessage({ type: "success", text: json.message || "Refund approved successfully" });
      fetchRequests();
    } catch (error: unknown) {
      setMessage({ type: "error", text: errorMessage(error, "Approval failed") });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleConfirmReject() {
    if (!rejectingItem) return;
    try {
      setActionLoadingId(rejectingItem._id);
      setMessage(null);
      const res = await fetch(`/api/admin/refund-requests/${rejectingItem._id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Rejection failed");

      setMessage({ type: "success", text: "Refund request rejected." });
      setRejectingItem(null);
      setRejectionReason("");
      fetchRequests();
    } catch (error: unknown) {
      setMessage({ type: "error", text: errorMessage(error, "Rejection failed") });
    } finally {
      setActionLoadingId(null);
    }
  }

  const filteredRequests = requests.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const pName = r.passengerId?.name?.toLowerCase() || "";
    const pEmail = r.passengerId?.email?.toLowerCase() || "";
    const tripNum = String(r.tripId?.tripNumber || "");
    return pName.includes(q) || pEmail.includes(q) || tripNum.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Status Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--color-panel)] p-6 rounded-lg border border-[var(--color-border)] shadow-[0_10px_28px_var(--color-shadow)]">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--color-primary)] flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[var(--color-secondary)]" />
            <span>Passenger Refund Approval Queue</span>
          </h2>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            Review and act on passenger trip cancellation refund requests.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchRequests}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-lg text-xs font-semibold transition-opacity hover:opacity-80 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Message notification */}
      {message && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl text-sm font-medium ${
            message.type === "success"
              ? "bg-[var(--color-success-tint)] border border-[var(--color-success)] text-[var(--color-success)]"
              : "bg-[var(--color-danger-tint)] border border-[var(--color-danger)] text-[var(--color-danger)]"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Filters & Search bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-[var(--color-background)] p-1.5 rounded-lg border border-[var(--color-border)]">
          {(["pending", "approved", "rejected", "all"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer ${
                statusFilter === tab
                  ? "bg-[var(--color-secondary)] text-[var(--color-primary)] shadow-md"
                  : "text-[var(--color-muted)] hover:text-[var(--color-primary)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="text"
            placeholder="Search passenger or trip #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg pl-9 pr-4 py-2 text-xs text-[var(--color-primary)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-secondary)]"
          />
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg overflow-hidden shadow-[0_10px_28px_var(--color-shadow)]">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-[var(--color-muted)] gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-secondary)]" />
            <span className="text-xs font-medium">Loading refund requests...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 text-center text-[var(--color-muted)] text-sm">
            No {statusFilter !== "all" ? statusFilter : ""} refund requests found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[var(--color-primary)]">
              <thead className="bg-[var(--color-background)] text-[var(--color-muted)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Requested At</th>
                  <th className="px-5 py-3.5">Passenger</th>
                  <th className="px-5 py-3.5">Trip Details</th>
                  <th className="px-5 py-3.5">Tier & Breakdown</th>
                  <th className="px-5 py-3.5">Refund Amount</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredRequests.map((reqItem) => {
                  const isOldPending =
                    reqItem.status === "pending" &&
                    new Date().getTime() - new Date(reqItem.requestedAt).getTime() >
                      24 * 60 * 60 * 1000;

                  return (
                    <tr
                      key={reqItem._id}
                      className={`hover:bg-[var(--color-primary-tint)] transition-colors ${
                        isOldPending ? "bg-[var(--color-warning-tint)]" : ""
                      }`}
                    >
                      {/* Requested At */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium text-[var(--color-primary)]">
                          <Clock className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                          <span>
                            {new Date(reqItem.requestedAt).toLocaleString("en-EG", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {isOldPending && (
                          <span className="inline-block mt-1 text-[10px] text-[var(--color-warning)] font-semibold bg-[var(--color-warning-tint)] px-2 py-0.5 rounded border border-[var(--color-warning)]">
                            Over 24h old
                          </span>
                        )}
                      </td>

                      {/* Passenger */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[var(--color-primary)]">
                          {reqItem.passengerId?.name || "Passenger"}
                        </div>
                        <div className="text-[11px] text-[var(--color-muted)]">
                          {reqItem.passengerId?.email}
                        </div>
                        {reqItem.passengerId?.phone && (
                          <div className="text-[11px] text-[var(--color-muted)]">
                            {reqItem.passengerId.phone}
                          </div>
                        )}
                      </td>

                      {/* Trip Details */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-[var(--color-secondary)]">
                          Trip #{reqItem.tripId?.tripNumber || "—"}
                        </div>
                        <div className="text-[11px] text-[var(--color-muted)]">
                          Date: {reqItem.tripId?.date}
                        </div>
                        <div className="text-[11px] text-[var(--color-muted)]">
                          Fare: {reqItem.tripId?.priceEgp} EGP
                        </div>
                      </td>

                      {/* Tier & Breakdown */}
                      <td className="px-5 py-4">
                        <span className="inline-block font-semibold text-[var(--color-primary)] capitalize bg-[var(--color-primary-tint)] px-2 py-0.5 rounded text-[11px]">
                          {reqItem.tier.replace(/_/g, " ")}
                        </span>
                        <div className="text-[11px] text-[var(--color-muted)] mt-1">
                          Retained: {reqItem.retainedAmount} EGP
                        </div>
                      </td>

                      {/* Refund Amount */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-extrabold text-sm text-[var(--color-success)]">
                          +{reqItem.refundAmount} EGP
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold capitalize ${
                            reqItem.status === "approved"
                              ? "bg-[var(--color-success-tint)] text-[var(--color-success)] border border-[var(--color-success)]"
                              : reqItem.status === "rejected"
                                ? "bg-[var(--color-danger-tint)] text-[var(--color-danger)] border border-[var(--color-danger)]"
                                : "bg-[var(--color-warning-tint)] text-[var(--color-warning)] border border-[var(--color-warning)]"
                          }`}
                        >
                          {reqItem.status}
                        </span>
                        {reqItem.reviewedBy && (
                          <div className="text-[10px] text-[var(--color-muted)] mt-1">
                            By: {reqItem.reviewedBy.name}
                          </div>
                        )}
                        {reqItem.rejectionReason && (
                          <div className="text-[10px] text-[var(--color-danger)] max-w-xs truncate" title={reqItem.rejectionReason}>
                            Reason: {reqItem.rejectionReason}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        {reqItem.status === "pending" ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleApprove(reqItem._id)}
                              disabled={actionLoadingId === reqItem._id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--color-success)] text-[var(--color-on-primary)] font-bold rounded-lg text-xs transition-opacity hover:opacity-80 shadow-sm cursor-pointer disabled:opacity-50"
                            >
                              {actionLoadingId === reqItem._id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Approve</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setRejectingItem(reqItem)}
                              disabled={actionLoadingId === reqItem._id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--color-danger)] text-[var(--color-on-primary)] font-bold rounded-lg text-xs transition-opacity hover:opacity-80 shadow-sm cursor-pointer disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[var(--color-muted)] text-xs italic">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)]">
          <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg max-w-md w-full p-6 text-[var(--color-primary)] space-y-4 shadow-[0_20px_60px_var(--color-shadow-strong)]">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-[var(--color-danger)] flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[var(--color-danger)]" />
                <span>Reject Refund Request</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="text-[var(--color-muted)] hover:text-[var(--color-primary)]"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-[var(--color-muted)]">
              Rejecting this refund request for passenger{" "}
              <strong>{rejectingItem.passengerId?.name}</strong> (Trip #
              {rejectingItem.tripId?.tripNumber}). No wallet credit will be issued.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-primary)] mb-1">
                Rejection Reason (Optional)
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Policy violation, duplicate claim"
                className="w-full bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg p-3 text-xs text-[var(--color-primary)] focus:outline-none focus:border-[var(--color-danger)]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="px-4 py-2 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={actionLoadingId === rejectingItem._id}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-[var(--color-on-primary)] bg-[var(--color-danger)] rounded-lg transition-opacity hover:opacity-80 shadow-lg cursor-pointer disabled:opacity-50"
              >
                {actionLoadingId === rejectingItem._id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
