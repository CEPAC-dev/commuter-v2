"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Car,
  Search,
  Mail,
  Phone,
  ExternalLink,
  Bell,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { AdminCard, AdminEmptyState } from "@/components/admin/layout";

type VerificationStatus = "incomplete" | "pending" | "verified";

type DriverRow = {
  _id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  userNumber?: number;
  gender?: "male" | "female";
  verificationStatus: VerificationStatus;
  carType?: string;
  carBrand?: string;
  carModel?: string;
  modelYear?: number;
  vehicleColor?: string;
  plateChar1?: string;
  plateChar2?: string;
  plateChar3?: string;
  plateDigits?: string;
  licenseExpiry?: string;
  carCapacity?: number;
  documents?: Record<string, string | null | undefined>;
  missingDocuments: string[];
  hasAllDocuments: boolean;
  hasVehicleInfo: boolean;
  createdAt?: string;
};

const DOC_LABELS: Record<string, string> = {
  nationalIdFront: "National ID (front)",
  nationalIdBack: "National ID (back)",
  drivingLicense: "Driving license",
  carLicenseFront: "Car license (front)",
  carLicenseBack: "Car license (back)",
  criminalRecord: "Criminal record",
  profilePic: "Profile picture",
  carImage: "Car image",
};

const STATUS_CONFIG = {
  incomplete: { label: "Incomplete", color: "#94A3B8", bg: "#F1F5F9" },
  pending: { label: "Pending Review", color: "#F59E0B", bg: "#FEF3C7" },
  verified: { label: "Verified", color: "#10B981", bg: "#D1FAE5" },
};

function getMissingProfileItems(driver: DriverRow) {
  const missingDocuments = driver.missingDocuments.map(
    (key) => DOC_LABELS[key] || key,
  );
  return [
    ...(!driver.hasVehicleInfo ? ["Vehicle information"] : []),
    ...(missingDocuments.length
      ? missingDocuments
      : !driver.hasAllDocuments
        ? ["Required documents"]
        : []),
  ];
}

function getDocumentExtension(url: string) {
  const path = url.split(/[?#]/, 1)[0].toLowerCase();
  const lastDot = path.lastIndexOf(".");
  return lastDot === -1 ? "" : path.slice(lastDot);
}

function DocumentPreview({ url, label }: { url: string; label: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const extension = getDocumentExtension(url);
  const canPreview = [".jpg", ".jpeg", ".png", ".webp"].includes(extension);

  if (!canPreview || imageFailed) {
    return (
      <div
        style={{
          minHeight: 112,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: 8,
          borderRadius: 6,
          background: "#fff",
        }}
      >
        <FileText size={28} color="#64748B" aria-hidden="true" />
        <div
          style={{
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 12,
            color: "#475569",
          }}
          title={label}
        >
          {label}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#10B981",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          <ExternalLink size={12} />
          Open
        </a>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: "block", textDecoration: "none" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label}
        loading="lazy"
        decoding="async"
        onError={() => setImageFailed(true)}
        style={{
          display: "block",
          width: "100%",
          aspectRatio: "4 / 3",
          maxHeight: 160,
          borderRadius: 6,
          background: "#fff",
          objectFit: "contain",
        }}
      />
    </a>
  );
}

export default function DriverManagementClient({
  initialDrivers,
  initialDriverId,
}: {
  initialDrivers: DriverRow[];
  initialDriverId?: string;
}) {
  const [drivers, setDrivers] = useState(initialDrivers);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | "all">(
    "all",
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [highlightedDriverId, setHighlightedDriverId] = useState<string | null>(
    null,
  );
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [statusConfirmation, setStatusConfirmation] = useState<{
    driverId: string;
    fromStatus: VerificationStatus;
    toStatus: VerificationStatus;
  } | null>(null);
  const [statusConfirmationError, setStatusConfirmationError] = useState<
    string | null
  >(null);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const statusRequestInFlight = useRef(false);
  const deepLinkAppliedRef = useRef(false);
  const cancelStatusButtonRef = useRef<HTMLButtonElement>(null);
  const [feedback, setFeedback] = useState<Record<
    string,
    { type: "success" | "error"; message: string }
  >>({});

  const filtered = useMemo(() => {
    let result = drivers;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.userName?.toLowerCase().includes(q) ||
          d.userEmail?.toLowerCase().includes(q) ||
          d.userPhone?.includes(q) ||
          d.carBrand?.toLowerCase().includes(q) ||
          d.carModel?.toLowerCase().includes(q),
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((d) => d.verificationStatus === statusFilter);
    }

    return result;
  }, [drivers, searchQuery, statusFilter]);

  const deepLinkedDriverId = useMemo(
    () =>
      initialDriverId
        ? drivers.find((driver) => driver.userId === initialDriverId)?._id
        : undefined,
    [drivers, initialDriverId],
  );

  const stats = useMemo(() => {
    return {
      total: drivers.length,
      incomplete: drivers.filter((d) => d.verificationStatus === "incomplete")
        .length,
      pending: drivers.filter((d) => d.verificationStatus === "pending").length,
      verified: drivers.filter((d) => d.verificationStatus === "verified")
        .length,
    };
  }, [drivers]);

  useEffect(() => {
    if (statusConfirmation) cancelStatusButtonRef.current?.focus();
  }, [statusConfirmation]);

  useEffect(() => {
    if (!initialDriverId || deepLinkAppliedRef.current) return;
    deepLinkAppliedRef.current = true;
    if (!deepLinkedDriverId) return;

    setSearchQuery("");
    setStatusFilter("all");
    setExpandedId(deepLinkedDriverId);
    setHighlightedDriverId(deepLinkedDriverId);

    const scrollTimer = window.setTimeout(() => {
      document
        .getElementById(`driver-card-${deepLinkedDriverId}`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 0);
    const highlightTimer = window.setTimeout(() => {
      setHighlightedDriverId(null);
    }, 2000);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(highlightTimer);
      deepLinkAppliedRef.current = false;
    };
  }, [deepLinkedDriverId, initialDriverId]);

  useEffect(() => {
    if (!statusConfirmation) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !statusRequestInFlight.current) {
        setStatusConfirmation(null);
        setStatusConfirmationError(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [statusConfirmation]);

  function openStatusConfirmation(
    driver: DriverRow,
    newStatus: VerificationStatus,
  ) {
    setStatusConfirmationError(null);
    setStatusConfirmation({
      driverId: driver._id,
      fromStatus: driver.verificationStatus,
      toStatus: newStatus,
    });
  }

  function closeStatusConfirmation() {
    if (statusRequestInFlight.current) return;
    setStatusConfirmation(null);
    setStatusConfirmationError(null);
  }

  async function confirmStatusUpdate() {
    if (!statusConfirmation || statusRequestInFlight.current) return;
    const { driverId, toStatus } = statusConfirmation;
    const driver = drivers.find((item) => item._id === driverId);
    if (!driver) return;
    if (
      toStatus === "verified" &&
      (!driver.hasAllDocuments || !driver.hasVehicleInfo)
    ) {
      return;
    }

    statusRequestInFlight.current = true;
    setSavingStatusId(driverId);
    setStatusConfirmationError(null);
    try {
      const res = await fetch(`/api/admin/drivers/${driverId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationStatus: toStatus }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      setDrivers((prev) =>
        prev.map((d) =>
          d._id === driverId ? { ...d, verificationStatus: toStatus } : d,
        ),
      );

      setFeedback((prev) => ({
        ...prev,
        [driverId]: { type: "success", message: "Status updated successfully" },
      }));

      setTimeout(() => {
        setFeedback((prev) => {
          const next = { ...prev };
          delete next[driverId];
          return next;
        });
      }, 3000);
      setStatusConfirmation(null);
      setStatusConfirmationError(null);
    } catch (err) {
      setStatusConfirmationError(
        err instanceof Error ? err.message : "Update failed",
      );
    } finally {
      statusRequestInFlight.current = false;
      setSavingStatusId(null);
    }
  }

  const statusDialogDriver = statusConfirmation
    ? drivers.find((driver) => driver._id === statusConfirmation.driverId)
    : undefined;
  const statusDialogMissingItems = statusDialogDriver
    ? getMissingProfileItems(statusDialogDriver)
    : [];
  const verifiedStatusBlocked = Boolean(
    statusConfirmation?.toStatus === "verified" &&
      statusDialogDriver &&
      (!statusDialogDriver.hasAllDocuments ||
        !statusDialogDriver.hasVehicleInfo),
  );

  async function sendReminder(driverId: string, userId: string) {
    setSendingReminder(driverId);
    try {
      const res = await fetch(`/api/admin/drivers/${driverId}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send reminder");
      }

      setFeedback((prev) => ({
        ...prev,
        [driverId]: {
          type: "success",
          message: "Reminder sent successfully (Email + SMS)",
        },
      }));

      setTimeout(() => {
        setFeedback((prev) => {
          const next = { ...prev };
          delete next[driverId];
          return next;
        });
      }, 5000);
    } catch (err) {
      setFeedback((prev) => ({
        ...prev,
        [driverId]: {
          type: "error",
          message: err instanceof Error ? err.message : "Failed to send reminder",
        },
      }));
    } finally {
      setSendingReminder(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        {[
          { label: "Total Drivers", value: stats.total, color: "#0B1E3D" },
          {
            label: "Incomplete",
            value: stats.incomplete,
            color: "#94A3B8",
          },
          { label: "Pending Review", value: stats.pending, color: "#F59E0B" },
          { label: "Verified", value: stats.verified, color: "#10B981" },
        ].map((stat, idx) => (
          <div
            key={idx}
            style={{
              background: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 13, color: "#64748B", marginBottom: 8 }}>
              {stat.label}
            </div>
            <div
              style={{ fontSize: 32, fontWeight: 800, color: stat.color }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <AdminCard>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", flex: "1 1 300px" }}>
            <Search
              size={18}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94A3B8",
              }}
            />
            <input
              type="text"
              placeholder="Search by name, email, phone, car..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px 10px 40px",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as VerificationStatus | "all")
            }
            style={{
              padding: "10px 12px",
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              fontSize: 14,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all">All Status</option>
            <option value="incomplete">Incomplete</option>
            <option value="pending">Pending Review</option>
            <option value="verified">Verified</option>
          </select>
        </div>
      </AdminCard>

      {/* Driver List */}
      {filtered.length === 0 ? (
        <AdminEmptyState
          title="No drivers found"
          description="Try adjusting your search or filters."
        />
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {filtered.map((driver) => {
            const isExpanded = expandedId === driver._id;
            const statusConfig = STATUS_CONFIG[driver.verificationStatus];
            const fb = feedback[driver._id];
            const docsCount = Object.keys(DOC_LABELS).filter((k) =>
              Boolean(driver.documents?.[k]),
            ).length;
            const completionPercent = Math.round(
              ((docsCount + (driver.hasVehicleInfo ? 1 : 0)) / 9) * 100,
            );
            const isComplete =
              driver.hasAllDocuments && driver.hasVehicleInfo;

            return (
              <AdminCard
                key={driver._id}
                id={`driver-card-${driver._id}`}
                style={{
                  scrollMarginTop: 88,
                  outline:
                    highlightedDriverId === driver._id
                      ? "3px solid rgba(0, 194, 168, 0.45)"
                      : "3px solid transparent",
                  transition: "outline-color 400ms ease",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "start",
                    justifyContent: "space-between",
                    gap: 16,
                    marginBottom: isExpanded ? 20 : 0,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 8,
                      }}
                    >
                      <h3
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: "#0B1E3D",
                        }}
                      >
                        {driver.userName || "Unnamed Driver"}
                      </h3>
                      <span
                        style={{
                          padding: "4px 12px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 700,
                          background: statusConfig.bg,
                          color: statusConfig.color,
                        }}
                      >
                        {statusConfig.label}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px 20px",
                        fontSize: 13,
                        color: "#64748B",
                      }}
                    >
                      {driver.userPhone && (
                        <span style={{ display: "flex", gap: 6 }}>
                          <Phone size={14} />
                          {driver.userPhone}
                        </span>
                      )}
                      {driver.userEmail && (
                        <span style={{ display: "flex", gap: 6 }}>
                          <Mail size={14} />
                          {driver.userEmail}
                        </span>
                      )}
                      {driver.carBrand && driver.carModel && (
                        <span style={{ display: "flex", gap: 6 }}>
                          <Car size={14} />
                          {driver.carBrand} {driver.carModel} ({driver.modelYear})
                        </span>
                      )}
                    </div>

                    {/* Completion progress */}
                    <div style={{ marginTop: 12, maxWidth: 320 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#64748B",
                          marginBottom: 5,
                        }}
                      >
                        <span>Profile completion</span>
                        <span>
                          {docsCount}/8 docs ·{" "}
                          {driver.hasVehicleInfo ? "vehicle ✓" : "vehicle ✗"}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 3,
                          background: "#E2E8F0",
                          overflow: "hidden",
                        }}
                        role="progressbar"
                        aria-valuenow={completionPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          style={{
                            width: `${completionPercent}%`,
                            height: "100%",
                            borderRadius: 3,
                            background: isComplete ? "#10B981" : "#F59E0B",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    {(driver.verificationStatus === "incomplete" || !isComplete) && (
                      <button
                        onClick={() =>
                          sendReminder(driver._id, driver.userId)
                        }
                        disabled={sendingReminder === driver._id}
                        title="Send a bilingual reminder to complete the profile"
                        style={{
                          padding: "8px 14px",
                          border: "1px solid #F59E0B",
                          borderRadius: 8,
                          background: "#FEF3C7",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#92400E",
                          cursor:
                            sendingReminder === driver._id
                              ? "not-allowed"
                              : "pointer",
                          opacity: sendingReminder === driver._id ? 0.6 : 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Bell size={13} />
                        {sendingReminder === driver._id ? "…" : "Remind"}
                      </button>
                    )}

                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : driver._id)
                      }
                      style={{
                        padding: "8px 16px",
                        border: "1px solid #E2E8F0",
                        borderRadius: 8,
                        background: "#fff",
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#0B1E3D",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isExpanded ? "Hide Details" : "View Details"}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div
                    style={{
                      display: "grid",
                      gap: 20,
                      paddingTop: 20,
                      borderTop: "1px solid #E2E8F0",
                    }}
                  >
                    {/* Completion Status */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          padding: 16,
                          borderRadius: 10,
                          background: driver.hasVehicleInfo
                            ? "#D1FAE5"
                            : "#FEE2E2",
                          border: `1px solid ${driver.hasVehicleInfo ? "#10B981" : "#EF4444"}`,
                        }}
                      >
                        {driver.hasVehicleInfo ? (
                          <CheckCircle size={20} color="#10B981" />
                        ) : (
                          <XCircle size={20} color="#EF4444" />
                        )}
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 14,
                            fontWeight: 600,
                            color: driver.hasVehicleInfo ? "#065F46" : "#991B1B",
                          }}
                        >
                          Vehicle Info:{" "}
                          {driver.hasVehicleInfo ? "Complete" : "Incomplete"}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: 16,
                          borderRadius: 10,
                          background: driver.hasAllDocuments
                            ? "#D1FAE5"
                            : "#FEE2E2",
                          border: `1px solid ${driver.hasAllDocuments ? "#10B981" : "#EF4444"}`,
                        }}
                      >
                        {driver.hasAllDocuments ? (
                          <CheckCircle size={20} color="#10B981" />
                        ) : (
                          <XCircle size={20} color="#EF4444" />
                        )}
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 14,
                            fontWeight: 600,
                            color: driver.hasAllDocuments ? "#065F46" : "#991B1B",
                          }}
                        >
                          Documents: {driver.hasAllDocuments ? "Complete" : `${driver.missingDocuments.length} Missing`}
                        </div>
                      </div>
                    </div>

                    {/* Missing Items Alert */}
                    {(!driver.hasVehicleInfo || !driver.hasAllDocuments) && (
                      <div
                        style={{
                          padding: 16,
                          borderRadius: 10,
                          background: "#FEF3C7",
                          border: "1px solid #F59E0B",
                          display: "flex",
                          alignItems: "start",
                          gap: 12,
                        }}
                      >
                        <AlertTriangle size={20} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <div style={{ fontWeight: 700, color: "#92400E", marginBottom: 6 }}>
                            Incomplete Profile
                          </div>
                          {!driver.hasVehicleInfo && (
                            <div style={{ fontSize: 13, color: "#78350F", marginBottom: 4 }}>
                              • Vehicle information is missing
                            </div>
                          )}
                          {driver.missingDocuments.length > 0 && (
                            <div style={{ fontSize: 13, color: "#78350F" }}>
                              • Missing documents: {driver.missingDocuments.map((doc) => DOC_LABELS[doc] || doc).join(", ")}
                            </div>
                          )}

                          {/* Send Reminder Button */}
                          <button
                            onClick={() => sendReminder(driver._id, driver.userId)}
                            disabled={sendingReminder === driver._id}
                            style={{
                              marginTop: 12,
                              padding: "8px 16px",
                              borderRadius: 8,
                              border: "none",
                              background: "#F59E0B",
                              color: "#fff",
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: sendingReminder === driver._id ? "not-allowed" : "pointer",
                              opacity: sendingReminder === driver._id ? 0.6 : 1,
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Bell size={14} />
                            {sendingReminder === driver._id
                              ? "Sending..."
                              : "Send Reminder (Email + SMS)"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Vehicle Details */}
                    {driver.hasVehicleInfo && (
                      <div>
                        <h4
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#0B1E3D",
                            marginBottom: 12,
                          }}
                        >
                          Vehicle Details
                        </h4>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                            gap: 12,
                            fontSize: 13,
                          }}
                        >
                          {[
                            { label: "Type", value: driver.carType },
                            {
                              label: "Brand",
                              value: driver.carBrand,
                            },
                            { label: "Model", value: driver.carModel },
                            { label: "Year", value: driver.modelYear },
                            { label: "Color", value: driver.vehicleColor },
                            {
                              label: "Plate",
                              value: `${driver.plateChar1} ${driver.plateChar2} ${driver.plateChar3} - ${driver.plateDigits}`,
                            },
                            {
                              label: "License Expiry",
                              value: driver.licenseExpiry,
                            },
                            {
                              label: "Capacity",
                              value: driver.carCapacity ? `${driver.carCapacity} seats` : undefined,
                            },
                          ].map(
                            (field, idx) =>
                              field.value && (
                                <div key={idx}>
                                  <div
                                    style={{ color: "#64748B", marginBottom: 4 }}
                                  >
                                    {field.label}
                                  </div>
                                  <div style={{ fontWeight: 600, color: "#0B1E3D" }}>
                                    {field.value}
                                  </div>
                                </div>
                              ),
                          )}
                        </div>
                      </div>
                    )}

                    {/* Documents */}
                    <div>
                      <h4
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#0B1E3D",
                          marginBottom: 12,
                        }}
                      >
                        Documents ({docsCount}/8)
                      </h4>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                          gap: 12,
                        }}
                      >
                        {Object.entries(DOC_LABELS).map(([key, label]) => {
                          const url = driver.documents?.[key];
                          const hasDoc = !!url;

                          return (
                            <div
                              key={key}
                              style={{
                                padding: 12,
                                borderRadius: 8,
                                border: `1px solid ${hasDoc ? "#10B981" : "#E2E8F0"}`,
                                background: hasDoc ? "#F0FDF4" : "#F8FAFC",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: hasDoc ? "#065F46" : "#64748B",
                                  marginBottom: 8,
                                }}
                              >
                                {label}
                              </div>
                              {hasDoc ? (
                                <DocumentPreview url={url} label={label} />
                              ) : (
                                <span style={{ fontSize: 12, color: "#94A3B8" }}>
                                  Not uploaded
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Status Actions */}
                    <div>
                      <h4
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#0B1E3D",
                          marginBottom: 12,
                        }}
                      >
                        Verification Status
                      </h4>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {(
                          [
                            "incomplete",
                            "pending",
                            "verified",
                          ] as VerificationStatus[]
                        ).map((status) => {
                          const config = STATUS_CONFIG[status];
                          const isCurrent = driver.verificationStatus === status;
                          const isSaving = savingStatusId === driver._id;

                          return (
                            <button
                              key={status}
                              onClick={() => openStatusConfirmation(driver, status)}
                              disabled={isCurrent || isSaving}
                              style={{
                                padding: "10px 20px",
                                borderRadius: 8,
                                border: `2px solid ${isCurrent ? config.color : "#E2E8F0"}`,
                                background: isCurrent ? config.bg : "#fff",
                                color: isCurrent ? config.color : "#64748B",
                                fontSize: 14,
                                fontWeight: 600,
                                cursor:
                                  isCurrent || isSaving ? "not-allowed" : "pointer",
                                opacity: isCurrent ? 1 : isSaving ? 0.5 : 0.7,
                              }}
                            >
                              {config.label}
                              {isCurrent && " ✓"}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Feedback */}
                    {fb && (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          background: fb.type === "success" ? "#D1FAE5" : "#FEE2E2",
                          border: `1px solid ${fb.type === "success" ? "#10B981" : "#EF4444"}`,
                          color: fb.type === "success" ? "#065F46" : "#991B1B",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {fb.message}
                      </div>
                    )}
                  </div>
                )}
              </AdminCard>
            );
          })}
        </div>
      )}
      {statusConfirmation && statusDialogDriver && (
        <div
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeStatusConfirmation();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(15, 23, 42, 0.55)",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="driver-status-confirm-title"
            style={{
              width: "min(100%, 480px)",
              maxHeight: "calc(100vh - 40px)",
              overflowY: "auto",
              padding: 24,
              borderRadius: 8,
              background: "#fff",
              boxShadow: "0 24px 64px rgba(15, 23, 42, 0.28)",
            }}
          >
            <h2
              id="driver-status-confirm-title"
              style={{ margin: "0 0 16px", fontSize: 18, color: "#0B1E3D" }}
            >
              Confirm driver status change
            </h2>
            <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#0B1E3D" }}>
              {statusDialogDriver.userName || "Driver"}
            </p>
            <p style={{ margin: "0 0 16px", color: "#475569" }}>
              Change status from{" "}
              {` ${STATUS_CONFIG[statusConfirmation.fromStatus].label} to ${STATUS_CONFIG[statusConfirmation.toStatus].label}?`}
            </p>
            {statusConfirmation.toStatus === "verified" &&
              statusDialogMissingItems.length > 0 && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #F59E0B",
                    background: "#FEF3C7",
                    color: "#78350F",
                  }}
                >
                  <p style={{ margin: "0 0 8px", fontWeight: 700 }}>
                    Complete these items before verifying:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {statusDialogMissingItems.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            {statusConfirmationError && (
              <p
                role="alert"
                style={{
                  margin: "0 0 16px",
                  color: "#991B1B",
                  fontWeight: 600,
                }}
              >
                {statusConfirmationError}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                ref={cancelStatusButtonRef}
                type="button"
                onClick={closeStatusConfirmation}
                disabled={savingStatusId === statusConfirmation.driverId}
                style={{
                  padding: "9px 16px",
                  border: "1px solid #CBD5E1",
                  borderRadius: 8,
                  background: "#fff",
                  color: "#334155",
                  fontWeight: 600,
                  cursor:
                    savingStatusId === statusConfirmation.driverId
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStatusUpdate}
                disabled={
                  savingStatusId === statusConfirmation.driverId ||
                  verifiedStatusBlocked
                }
                style={{
                  padding: "9px 16px",
                  border: "1px solid #0B1E3D",
                  borderRadius: 8,
                  background: "#0B1E3D",
                  color: "#fff",
                  fontWeight: 600,
                  cursor:
                    savingStatusId === statusConfirmation.driverId ||
                    verifiedStatusBlocked
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    savingStatusId === statusConfirmation.driverId ||
                    verifiedStatusBlocked
                      ? 0.55
                      : 1,
                }}
              >
                {savingStatusId === statusConfirmation.driverId
                  ? "Saving…"
                  : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
