"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  XCircle,
  AlertTriangle,
  Wallet,
  Clock,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from "lucide-react";

interface EvaluationResult {
  allowed: boolean;
  tierLabel: string;
  refundPercent: number;
  penaltyPercent: number;
  refundAmount: number;
  retainedAmount: number;
  daysBefore: number;
  timeStr: string;
  message?: string;
}

interface CancelTripModalProps {
  tripId: string;
  tripNumber?: number;
  date: string;
  priceEgp: number;
  status: string;
  onCancelled?: () => void;
}

export default function CancelTripModal({
  tripId,
  tripNumber,
  date,
  priceEgp,
  status,
  onCancelled,
}: CancelTripModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Exclude cancelled and completed trips
  if (status === "cancelled" || status === "completed" || status === "time_out") {
    return null;
  }

  async function openModal() {
    setIsOpen(true);
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/trips/${tripId}/cancel`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load cancellation details");
      }
      setEvaluation(json.evaluation);
    } catch (err: any) {
      setError(err.message || "Failed to load cancellation policy");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmCancel() {
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/trips/${tripId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to cancel trip");
      }

      setSuccessMsg(json.message || "Trip cancelled successfully");
      setTimeout(() => {
        setIsOpen(false);
        if (onCancelled) onCancelled();
        router.refresh();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Cancellation failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
      >
        <XCircle size={14} />
        <span>Cancel Trip</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden text-slate-900">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-slate-900 text-base">
                  Cancel Trip {tripNumber ? `#${tripNumber}` : ""}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={submitting}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1 rounded"
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>{successMsg}</span>
                </div>
              )}

              {loading ? (
                <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#00C2A8]" />
                  <span className="text-xs font-medium">
                    Calculating cancellation policy & refund...
                  </span>
                </div>
              ) : evaluation ? (
                <>
                  {/* Trip Summary Card */}
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-500 block font-medium">Pickup Date</span>
                      <span className="font-bold text-slate-900">{date}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 block font-medium">Trip Fare</span>
                      <span className="font-bold text-slate-900">{priceEgp} EGP</span>
                    </div>
                  </div>

                  {/* Policy evaluation details */}
                  {!evaluation.allowed ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Cancellation Blocked</span>
                      </div>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        {evaluation.message ||
                          "Cancellation is blocked during the driver matching window (5:00 PM – 7:00 PM the day before pickup)."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2.5">
                        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
                          <span className="text-slate-600 font-medium">Refund Tier</span>
                          <span className="font-bold text-slate-900 capitalize">
                            {evaluation.tierLabel.replace(/_/g, " ")}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">Refund Percentage</span>
                          <span className="font-extrabold text-emerald-600">
                            {evaluation.refundPercent}%
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">Penalty (Retained)</span>
                          <span className="font-bold text-rose-500">
                            {evaluation.penaltyPercent}% ({evaluation.retainedAmount} EGP)
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                          <span className="font-bold text-slate-900">Net Wallet Refund</span>
                          <span className="font-extrabold text-slate-900 text-sm text-[#00806E]">
                            + {evaluation.refundAmount} EGP
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 p-2.5 rounded-lg">
                        <Wallet className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Your refund of {evaluation.refundAmount} EGP will be reviewed by an admin before it is credited to your wallet.</span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Cancellation Reason (Optional)
                        </label>
                        <input
                          type="text"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="e.g. Schedule changed, emergency"
                          className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#00C2A8]"
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Actions */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Keep Trip
              </button>

              {evaluation?.allowed && (
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={submitting || !!successMsg}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? "Cancelling..." : "Confirm Cancellation"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
