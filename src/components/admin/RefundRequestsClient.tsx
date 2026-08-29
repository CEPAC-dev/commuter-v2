"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  User,
  DollarSign,
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
  }, [statusFilter]);

  async function fetchRequests() {
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch(`/api/admin/refund-requests?status=${statusFilter}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load refund requests");
      setRequests(json.data || []);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Error loading requests" });
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
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Approval failed" });
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
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Rejection failed" });
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0B1E3D]/80 p-6 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#00C2A8]" />
            <span>Passenger Refund Approval Queue</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Review and act on passenger trip cancellation refund requests.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchRequests}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors self-start sm:self-auto cursor-pointer"
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
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
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
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
          {(["pending", "approved", "rejected", "all"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer ${
                statusFilter === tab
                  ? "bg-[#00C2A8] text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search passenger or trip #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00C2A8]"
          />
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-[#0B1E3D]/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#00C2A8]" />
            <span className="text-xs font-medium">Loading refund requests...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No {statusFilter !== "all" ? statusFilter : ""} refund requests found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold">
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
              <tbody className="divide-y divide-slate-800/60">
                {filteredRequests.map((reqItem) => {
                  const isOldPending =
                    reqItem.status === "pending" &&
                    new Date().getTime() - new Date(reqItem.requestedAt).getTime() >
                      24 * 60 * 60 * 1000;

                  return (
                    <tr
                      key={reqItem._id}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        isOldPending ? "bg-amber-500/5" : ""
                      }`}
                    >
                      {/* Requested At */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium text-white">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
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
                          <span className="inline-block mt-1 text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            Over 24h old
                          </span>
                        )}
                      </td>

                      {/* Passenger */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white">
                          {reqItem.passengerId?.name || "Passenger"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {reqItem.passengerId?.email}
                        </div>
                        {reqItem.passengerId?.phone && (
                          <div className="text-[11px] text-slate-500">
                            {reqItem.passengerId.phone}
                          </div>
                        )}
                      </td>

                      {/* Trip Details */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-[#00C2A8]">
                          Trip #{reqItem.tripId?.tripNumber || "—"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Date: {reqItem.tripId?.date}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Fare: {reqItem.tripId?.priceEgp} EGP
                        </div>
                      </td>

                      {/* Tier & Breakdown */}
                      <td className="px-5 py-4">
                        <span className="inline-block font-semibold text-white capitalize bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                          {reqItem.tier.replace(/_/g, " ")}
                        </span>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Retained: {reqItem.retainedAmount} EGP
                        </div>
                      </td>

                      {/* Refund Amount */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-extrabold text-sm text-emerald-400">
                          +{reqItem.refundAmount} EGP
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold capitalize ${
                            reqItem.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : reqItem.status === "rejected"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {reqItem.status}
                        </span>
                        {reqItem.reviewedBy && (
                          <div className="text-[10px] text-slate-500 mt-1">
                            By: {reqItem.reviewedBy.name}
                          </div>
                        )}
                        {reqItem.rejectionReason && (
                          <div className="text-[10px] text-rose-400 max-w-xs truncate" title={reqItem.rejectionReason}>
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
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors shadow-sm cursor-pointer disabled:opacity-50"
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
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white font-bold rounded-lg text-xs transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs italic">Reviewed</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                <span>Reject Refund Request</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Rejecting this refund request for passenger{" "}
              <strong>{rejectingItem.passengerId?.name}</strong> (Trip #
              {rejectingItem.tripId?.tripNumber}). No wallet credit will be issued.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Rejection Reason (Optional)
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Policy violation, duplicate claim"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={actionLoadingId === rejectingItem._id}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors shadow-lg shadow-rose-600/20 cursor-pointer disabled:opacity-50"
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
