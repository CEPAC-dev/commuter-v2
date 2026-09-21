"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Users,
  Search,
  Car,
  ShieldCheck,
  Clock,
  CircleAlert,
  CircleCheck,
  CircleX,
  Phone,
  Mail,
  CalendarDays,
  FileText,
  ExternalLink,
  Gauge,
  Palette,
  Gift,
  KeyRound,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  AdminCard,
  AdminEmptyState,
  AdminStatusBadge,
} from "@/components/admin/layout";
import { REGION_CODES, REGIONS, type RegionCode } from "@/lib/config/regions";

/**
 * ---------------------------------------------------------------------
 * Types (kept as JSDoc-style comments since this file is plain JSX)
 * ---------------------------------------------------------------------
 * DriverProfile: {
 *   verificationStatus?: "incomplete" | "pending" | "verified",
 *   carType, carBrand, carModel, modelYear, vehicleColor,
 *   plateChar1, plateChar2, plateChar3, plateDigits,
 *   licenseExpiry, carCapacity, documents: Record<string, string|null>
 * }
 * UserRow: { _id, name, phone, email, role, createdAt, driver? }
 */

type UserRole = "passenger" | "driver" | "admin";
type VerificationStatus = "incomplete" | "pending" | "verified";
type ToneKey = "slate" | "amber" | "teal" | "navy";
type UserSort = "createdAt" | "referralUsageCount";
type SortDirection = "asc" | "desc";

type DriverProfile = {
  verificationStatus?: VerificationStatus;
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
};

type UserRow = {
  _id: string;
  userNumber?: number;
  name?: string;
  phone?: string;
  email?: string;
  gender?: "male" | "female" | null;
  securityQuestionVerified?: boolean;
  otpVerified?: boolean;
  role?: string;
  defaultRegionCode?: RegionCode;
  allowedRegionCodes?: RegionCode[];
  createdAt?: string;
  referralCode?: string;
  referralUsageCount?: number;
  referralAdditions?: {
    name: string;
    userNumber: number | null;
    phone: string;
  }[];
  driver?: DriverProfile;
};

type FeedbackState = Record<
  string,
  { type: "success" | "error"; message: string }
>;

type UserManagementClientProps = {
  initialUsers?: UserRow[];
  title?: string;
  description?: string;
  emptyMessage?: string;
};

const ROLE_OPTIONS: string[] = ["passenger", "driver", "admin"];

const VERIFICATION_META: Record<
  VerificationStatus,
  { label: string; tone: ToneKey; Icon: LucideIcon }
> = {
  incomplete: { label: "Incomplete", tone: "slate", Icon: CircleAlert },
  pending: { label: "Pending", tone: "amber", Icon: Clock },
  verified: { label: "Verified", tone: "teal", Icon: CircleCheck },
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

const TONE_CLASSES: Record<ToneKey, string> = {
  slate:
    "bg-[var(--color-background)] text-[var(--color-muted)] ring-[var(--color-border)]",
  amber:
    "bg-[var(--color-warning-tint)] text-[var(--color-warning)] ring-[var(--color-warning)]",
  teal: "bg-[var(--color-success-tint)] text-[var(--color-success)] ring-[var(--color-success)]",
  navy: "bg-[var(--color-primary-tint)] text-[var(--color-primary)] ring-[var(--color-primary)]",
};

// Sample data so this component renders standalone in preview.
const SAMPLE_USERS: UserRow[] = [
  {
    _id: "1",
    name: "Mona El-Sayed",
    phone: "+20 100 123 4567",
    email: "mona.elsayed@example.com",
    role: "driver",
    createdAt: "2025-02-11T10:00:00.000Z",
    driver: {
      verificationStatus: "pending",
      carType: "Sedan",
      carBrand: "Hyundai",
      carModel: "Elantra",
      modelYear: 2021,
      vehicleColor: "White",
      plateChar1: "A",
      plateChar2: "B",
      plateChar3: "D",
      plateDigits: "4471",
      licenseExpiry: "2027-05-01",
      carCapacity: 4,
      documents: {
        nationalIdFront:
          "https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=400",
        drivingLicense:
          "https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=400",
        carImage:
          "https://images.unsplash.com/photo-1541443131876-44b03de101c5?w=400",
      },
    },
  },
  {
    _id: "2",
    name: "Youssef Kamal",
    phone: "+20 122 987 6543",
    email: "youssef.kamal@example.com",
    role: "passenger",
    createdAt: "2025-06-03T10:00:00.000Z",
  },
  {
    _id: "3",
    name: "Admin Account",
    phone: "+20 101 555 0199",
    email: "ops@fleet.example.com",
    role: "admin",
    createdAt: "2024-11-19T10:00:00.000Z",
  },
];

export default function UserManagementClient({
  initialUsers = SAMPLE_USERS,
  title = "User management",
  description = "Review accounts, verify drivers, and manage access levels.",
  emptyMessage = "No users match your search.",
}: UserManagementClientProps) {
  const [rows, setRows] = useState<UserRow[]>(initialUsers);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<FeedbackState>({});
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole>("passenger");
  const [verificationFilter, setVerificationFilter] =
    useState<VerificationStatus | null>(null);
  const [signupDate, setSignupDate] = useState("");
  const [sortBy, setSortBy] = useState<UserSort>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function resetFilters() {
    setQuery("");
    setRoleFilter("passenger");
    setVerificationFilter(null);
    setSignupDate("");
    setSortBy("createdAt");
    setSortDirection("desc");
  }

  const summary = useMemo(() => {
    const passengerCount = rows.filter((r) => r.role === "passenger").length;
    const driverCount = rows.filter((r) => r.role === "driver").length;
    const adminCount = rows.filter((r) => r.role === "admin").length;
    return { total: rows.length, passengerCount, driverCount, adminCount };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const visibleRows = rows.filter((row) => {
      if (signupDate) {
        const rowDate = row.createdAt?.slice(0, 10);
        if (rowDate !== signupDate) return false;
      }
      const rowRole = row.role || "passenger";
      if (rowRole !== roleFilter) return false;
      if (
        roleFilter === "driver" &&
        verificationFilter &&
        row.driver?.verificationStatus !== verificationFilter
      )
        return false;
      const search = query.trim();
      if (!search) return true;

      const normalizedSearch = search.toLowerCase();
      const numberMatch = normalizedSearch.match(/^#(\d+)$/);
      if (numberMatch) {
        return String(row.userNumber ?? "").includes(numberMatch[1]);
      }

      const haystack =
        `${row.name || ""} ${row.phone || ""} ${row.email || ""}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });

    return [...visibleRows].sort((left, right) => {
      const leftValue =
        sortBy === "createdAt"
          ? new Date(left.createdAt ?? 0).getTime()
          : (left.referralUsageCount ?? 0);
      const rightValue =
        sortBy === "createdAt"
          ? new Date(right.createdAt ?? 0).getTime()
          : (right.referralUsageCount ?? 0);
      const comparison = leftValue - rightValue;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [
    rows,
    query,
    roleFilter,
    verificationFilter,
    signupDate,
    sortBy,
    sortDirection,
  ]);

  const signupDateCount = useMemo(() => {
    if (!signupDate) return null;
    return rows.filter((row) => row.createdAt?.slice(0, 10) === signupDate)
      .length;
  }, [rows, signupDate]);

  function toggleExpanded(userId: string) {
    setExpandedId((current) => (current === userId ? null : userId));
  }

  function updateRow(userId: string, patch: Partial<UserRow>) {
    setRows((current) =>
      current.map((row) => (row._id === userId ? { ...row, ...patch } : row)),
    );
  }

  async function saveChanges(user: UserRow) {
    const userId = user._id;
    const defaultRegionCode = user.defaultRegionCode ?? "EG-CAIRO";
    const allowedRegionCodes = Array.from(
      new Set([...(user.allowedRegionCodes ?? []), defaultRegionCode]),
    ) as RegionCode[];
    setSavingIds((current) => ({ ...current, [userId]: true }));
    setFeedback((current) => ({
      ...current,
      [userId]: { type: "success", message: "Saving…" },
    }));

    try {
      const payload: {
        role: string;
        defaultRegionCode?: RegionCode;
        allowedRegionCodes?: RegionCode[];
        verificationStatus?: VerificationStatus;
      } = {
        role: user.role ?? "passenger",
        defaultRegionCode,
        allowedRegionCodes,
      };
      if (user.driver) {
        payload.verificationStatus =
          user.driver.verificationStatus ?? "incomplete";
      }

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || "Unable to update user.");
      }

      setFeedback((current) => ({
        ...current,
        [userId]: { type: "success", message: "Changes saved successfully." },
      }));
    } catch (error) {
      setFeedback((current) => ({
        ...current,
        [userId]: {
          type: "error",
          message: error instanceof Error ? error.message : "Unexpected error.",
        },
      }));
    } finally {
      setSavingIds((current) => ({ ...current, [userId]: false }));
    }
  }

  async function requestAdminAction(
    user: UserRow,
    action: "delete" | "reset-password",
  ) {
    const password = window.prompt(
      `Enter ADMIN_PASSWORD to confirm ${action}.`,
    );
    if (password === null) return;
    const userId = user._id;
    setSavingIds((current) => ({ ...current, [userId]: true }));
    try {
      const response = await fetch(
        action === "delete"
          ? `/api/admin/users/${userId}`
          : `/api/admin/users/${userId}/reset-password`,
        {
          method: action === "delete" ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": password,
          },
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result?.error || "Admin action failed.");

      if (action === "delete") {
        setRows((current) => current.filter((row) => row._id !== userId));
        setExpandedId(null);
      }
      setFeedback((current) => ({
        ...current,
        [userId]: {
          type: "success",
          message:
            action === "delete"
              ? "User deleted successfully."
              : "Password reset successfully.",
        },
      }));
    } catch (error) {
      setFeedback((current) => ({
        ...current,
        [userId]: {
          type: "error",
          message: error instanceof Error ? error.message : "Unexpected error.",
        },
      }));
    } finally {
      setSavingIds((current) => ({ ...current, [userId]: false }));
    }
  }

  return (
    <AdminCard padding={0}>
      {/* Header */}
      <div className="flex flex-col gap-5 border-b border-[var(--color-border)] p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--color-primary)]">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatPill
              icon={Users}
              tone="navy"
              label="Total"
              value={summary.total}
            />
            <StatPill
              icon={Users}
              tone="navy"
              label="Passenger"
              value={summary.passengerCount}
            />
            <StatPill
              icon={Car}
              tone="teal"
              label="Driver"
              value={summary.driverCount}
            />
            <StatPill
              icon={ShieldCheck}
              tone="slate"
              label="Admin"
              value={summary.adminCount}
            />
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by #number, name, phone, or email"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] py-2.5 pl-10 pr-3 text-sm text-[var(--color-primary)] placeholder:text-[var(--color-muted)] outline-none transition focus:border-[var(--color-secondary)] focus:bg-[var(--color-panel)] focus:ring-2 focus:ring-[var(--color-secondary-tint)]"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {ROLE_OPTIONS.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setRoleFilter(role as UserRole)}
                className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold capitalize transition ${
                  roleFilter === role
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-sm"
                    : "bg-[var(--color-background)] text-[var(--color-muted)] hover:bg-[var(--color-primary-tint)]"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
          {roleFilter === "driver" && (
            <div className="flex gap-2 overflow-x-auto">
              {Object.entries(VERIFICATION_META).map(([value, meta]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setVerificationFilter(value as VerificationStatus)
                  }
                  className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                    verificationFilter === value
                      ? "bg-[var(--color-secondary)] text-[var(--color-on-secondary)] shadow-sm"
                      : "bg-[var(--color-background)] text-[var(--color-muted)] hover:bg-[var(--color-secondary-tint)]"
                  }`}
                >
                  {value === "verified" ? "Completed" : meta.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-muted)]">
              Signed up on
              <input
                type="date"
                value={signupDate}
                onChange={(event) => setSignupDate(event.target.value)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs font-semibold text-[var(--color-primary)] outline-none focus:border-[var(--color-secondary)]"
                style={{ accentColor: "var(--color-secondary)" }}
              />
            </label>
            {signupDateCount !== null && (
              <span className="flex items-center rounded-lg bg-[var(--color-secondary-tint)] px-3 py-2 text-xs font-semibold text-[var(--color-secondary-deep)]">
                {signupDateCount} {signupDateCount === 1 ? "person" : "people"}{" "}
                signed up
              </span>
            )}
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-muted)]">
              Sort by
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as UserSort)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs font-semibold text-[var(--color-primary)] outline-none focus:border-[var(--color-secondary)]"
              >
                <option value="createdAt">Date joined</option>
                <option value="referralUsageCount">Referral usage</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-muted)]">
              Order
              <select
                value={sortDirection}
                onChange={(event) =>
                  setSortDirection(event.target.value as SortDirection)
                }
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs font-semibold text-[var(--color-primary)] outline-none focus:border-[var(--color-secondary)]"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-xs font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-secondary)] hover:text-[var(--color-primary)]"
            >
              Reset filters
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {filteredRows.length === 0 ? (
        <AdminEmptyState title={emptyMessage} />
      ) : (
        <div className="grid gap-3 p-4 sm:p-5">
          {filteredRows.map((user) => {
            const expanded = expandedId === user._id;
            const feedbackMessage = feedback[user._id];
            const verification = user.driver?.verificationStatus
              ? VERIFICATION_META[user.driver.verificationStatus]
              : null;

            return (
              <div
                key={user._id}
                className={`overflow-hidden rounded-2xl border transition-shadow ${
                  expanded
                    ? "border-[var(--color-border)] shadow-md"
                    : "border-[var(--color-border)] hover:border-[var(--color-secondary)] hover:shadow-sm"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(user._id)}
                  className="flex w-full items-center justify-between gap-4 bg-[var(--color-panel)] px-4 py-3.5 text-left sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={user.name} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[var(--color-primary)]">
                        {user.name || "Unnamed user"}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                        #{user.userNumber ?? "—"} · {user.phone || "—"} ·{" "}
                        {user.email || "—"}
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-[var(--color-muted)]">
                        {user.referralCode || "No referral code"} · Used by{" "}
                        {user.referralUsageCount ?? 0}
                      </div>
                      <div className="mt-1 truncate text-xs font-semibold text-[#00877A]">
                        Referral additions:{" "}
                        {user.referralAdditions?.length ?? 0}
                      </div>
                      <div className="mt-1 truncate text-xs text-[var(--color-muted)]">
                        Joined:{" "}
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleString([], {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-[var(--color-primary-tint)] px-2 py-1 text-[11px] font-semibold capitalize text-[var(--color-primary)]">
                          Gender: {user.gender || "—"}
                        </span>
                        <VerificationMethodBadge
                          label="Security Question"
                          verified={Boolean(user.securityQuestionVerified)}
                        />
                        <VerificationMethodBadge
                          label="OTP Verified"
                          verified={Boolean(user.otpVerified)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <RoleBadge role={user.role} />
                    {verification && (
                      <span className="hidden sm:inline-flex">
                        <AdminStatusBadge
                          status={
                            user.driver?.verificationStatus ?? "incomplete"
                          }
                          label={verification.label}
                          tone={
                            verification.tone === "teal"
                              ? "success"
                              : verification.tone === "amber"
                                ? "warning"
                                : "muted"
                          }
                        />
                      </span>
                    )}
                    <ChevronDown
                      className={`h-4 w-4 text-[var(--color-muted)] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>

                {expanded && (
                  <div className="grid gap-4 border-t border-[var(--color-border)] bg-[var(--color-background)] p-4 sm:p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <InfoCard title="Basic info">
                        <InfoRow
                          icon={Phone}
                          label="Phone"
                          value={user.phone}
                        />
                        <InfoRow icon={Mail} label="Email" value={user.email} />
                        <InfoRow
                          icon={Users}
                          label="Gender"
                          value={user.gender || "—"}
                        />
                        <InfoRow
                          icon={CalendarDays}
                          label="Joined"
                          value={
                            user.createdAt
                              ? new Date(user.createdAt).toLocaleString([], {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })
                              : "—"
                          }
                        />
                        <InfoRow
                          icon={Gift}
                          label="Referral code"
                          value={user.referralCode || "—"}
                        />
                        <InfoRow
                          icon={Users}
                          label="Referral uses"
                          value={user.referralUsageCount ?? 0}
                        />
                        <div className="mt-1 grid gap-2 border-t border-[var(--color-border)] pt-3">
                          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                            Verification methods
                          </span>
                          <VerificationMethodRow
                            label="Security Question"
                            verified={Boolean(user.securityQuestionVerified)}
                          />
                          <VerificationMethodRow
                            label="OTP Verified"
                            verified={Boolean(user.otpVerified)}
                          />
                        </div>
                      </InfoCard>

                      <InfoCard title="Admin controls">
                        <FieldSelect
                          label="Role"
                          value={user.role || "passenger"}
                          onChange={(value) =>
                            updateRow(user._id, { role: value })
                          }
                          options={ROLE_OPTIONS}
                        />

                        <FieldSelect
                          label="Default region"
                          value={user.defaultRegionCode ?? "EG-CAIRO"}
                          onChange={(value) =>
                            updateRow(user._id, {
                              defaultRegionCode: value as RegionCode,
                              allowedRegionCodes: Array.from(
                                new Set([
                                  ...(user.allowedRegionCodes ?? []),
                                  value as RegionCode,
                                ]),
                              ),
                            })
                          }
                          options={[...REGION_CODES]}
                          optionLabels={Object.fromEntries(
                            REGION_CODES.map((code) => [
                              code,
                              REGIONS[code].label,
                            ]),
                          )}
                        />

                        <div className="grid gap-2">
                          <span className="text-xs font-semibold text-[var(--color-muted)]">
                            Allowed regions
                          </span>
                          {REGION_CODES.map((code) => {
                            const checked = (
                              user.allowedRegionCodes ?? []
                            ).includes(code);
                            return (
                              <label
                                key={code}
                                className="flex items-center gap-2 text-sm text-[var(--color-primary)]"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) => {
                                    const next = event.target.checked
                                      ? Array.from(
                                          new Set([
                                            ...(user.allowedRegionCodes ?? []),
                                            code,
                                          ]),
                                        )
                                      : (user.allowedRegionCodes ?? []).filter(
                                          (item) => item !== code,
                                        );
                                    updateRow(user._id, {
                                      allowedRegionCodes: next,
                                      ...(code === user.defaultRegionCode &&
                                      !event.target.checked
                                        ? { defaultRegionCode: next[0] }
                                        : {}),
                                    });
                                  }}
                                  className="h-4 w-4 accent-[var(--color-secondary)]"
                                />
                                {REGIONS[code].label}
                              </label>
                            );
                          })}
                        </div>

                        {user.driver && (
                          <FieldSelect
                            label="Verification status"
                            value={
                              user.driver.verificationStatus || "incomplete"
                            }
                            onChange={(value) =>
                              updateRow(user._id, {
                                driver: {
                                  ...(user.driver ?? {}),
                                  verificationStatus:
                                    value as VerificationStatus,
                                },
                              })
                            }
                            options={Object.keys(VERIFICATION_META)}
                            optionLabels={Object.fromEntries(
                              Object.entries(VERIFICATION_META).map(
                                ([k, v]) => [k, v.label],
                              ),
                            )}
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => saveChanges(user)}
                          disabled={savingIds[user._id]}
                          className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] shadow-sm transition disabled:cursor-wait disabled:opacity-60"
                        >
                          {savingIds[user._id] ? "Saving…" : "Save changes"}
                        </button>

                        <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-3">
                          <button
                            type="button"
                            onClick={() =>
                              requestAdminAction(user, "reset-password")
                            }
                            disabled={savingIds[user._id]}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-tint)] disabled:cursor-wait disabled:opacity-60"
                          >
                            <KeyRound className="h-4 w-4" />
                            Reset password
                          </button>
                          <button
                            type="button"
                            onClick={() => requestAdminAction(user, "delete")}
                            disabled={savingIds[user._id]}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-[var(--color-danger)] transition hover:bg-[var(--color-danger-tint)] disabled:cursor-wait disabled:opacity-60"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete user
                          </button>
                        </div>

                        {feedbackMessage && (
                          <div
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                              feedbackMessage.type === "success"
                                ? "bg-[var(--color-success-tint)] text-[var(--color-success)]"
                                : "bg-[var(--color-danger-tint)] text-[var(--color-danger)]"
                            }`}
                          >
                            {feedbackMessage.type === "success" ? (
                              <CircleCheck className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                            )}
                            {feedbackMessage.message}
                          </div>
                        )}
                      </InfoCard>
                    </div>

                    {user.driver && (
                      <>
                        <InfoCard title="Driver details">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                            <MiniStat
                              icon={Car}
                              label="Car"
                              value={`${user.driver.carBrand || "—"} ${user.driver.carModel || ""}`.trim()}
                            />
                            <MiniStat
                              icon={Gauge}
                              label="Capacity"
                              value={user.driver.carCapacity ?? "—"}
                            />
                            <MiniStat
                              icon={Palette}
                              label="Color"
                              value={user.driver.vehicleColor || "—"}
                            />
                            <MiniStat
                              icon={CalendarDays}
                              label="License exp."
                              value={user.driver.licenseExpiry || "—"}
                            />
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-3">
                            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                              Plate
                            </span>
                            <span className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-1 font-mono text-sm font-bold tracking-widest text-[var(--color-primary)]">
                              {buildPlate(user.driver) || "—"}
                            </span>
                            <span className="ml-2 text-xs text-[var(--color-muted)]">
                              {user.driver.carType || "—"} ·{" "}
                              {user.driver.modelYear || "—"}
                            </span>
                          </div>
                        </InfoCard>

                        <InfoCard title="Referral additions">
                          {user.referralAdditions?.length ? (
                            <div className="grid gap-2">
                              {user.referralAdditions.map((addition, index) => (
                                <div
                                  key={`${user._id}-referral-${index}`}
                                  className="rounded-lg border border-[#c9eee8] bg-[#f1fbf9] px-3 py-2"
                                >
                                  <div className="text-sm font-bold text-[var(--color-primary)]">
                                    {addition.name}
                                  </div>
                                  <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                                    User #{addition.userNumber ?? "N/A"} ·{" "}
                                    {addition.phone}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="m-0 text-sm text-[var(--color-muted)]">
                              No referral additions yet.
                            </p>
                          )}
                        </InfoCard>

                        <InfoCard title="Uploaded documents">
                          {user.driver.documents &&
                          Object.values(user.driver.documents).some(Boolean) ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                              {Object.entries(user.driver.documents ?? {}).map(
                                ([key, value]) => {
                                  if (!value) return null;
                                  const docLabel =
                                    key in DOC_LABELS ? DOC_LABELS[key] : key;
                                  const fileUrl = value;
                                  const isImage =
                                    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(
                                      value,
                                    );
                                  return (
                                    <a
                                      key={key}
                                      href={fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="group overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] transition hover:border-[var(--color-secondary)] hover:shadow-md"
                                    >
                                      <div className="relative aspect-4/3 w-full overflow-hidden bg-[var(--color-background)]">
                                        {isImage ? (
                                          <img
                                            src={fileUrl}
                                            alt={docLabel}
                                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                          />
                                        ) : (
                                          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[var(--color-muted)]">
                                            <FileText className="h-6 w-6" />
                                            <span className="text-[11px] font-medium">
                                              File
                                            </span>
                                          </div>
                                        )}
                                        <div className="absolute right-2 top-2 rounded-full bg-[var(--color-panel)] p-1 opacity-0 shadow-sm transition group-hover:opacity-100">
                                          <ExternalLink className="h-3 w-3 text-[var(--color-muted)]" />
                                        </div>
                                      </div>
                                      <div className="px-2.5 py-2 text-[11px] font-semibold text-[var(--color-muted)]">
                                        {docLabel}
                                      </div>
                                    </a>
                                  );
                                },
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-[var(--color-muted)]">
                              No documents uploaded yet.
                            </p>
                          )}
                        </InfoCard>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminCard>
  );
}

/* ------------------------------- helpers ------------------------------- */

function buildPlate(driver?: DriverProfile) {
  const parts = [
    driver?.plateChar1,
    driver?.plateChar2,
    driver?.plateChar3,
    driver?.plateDigits,
  ].filter(Boolean);
  return parts.join(" ");
}

function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return initials.join("") || "?";
}

/* ------------------------------ subcomponents ---------------------------- */

function StatPill({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  tone: ToneKey;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full px-3.5 py-2 ring-1 ring-inset ${TONE_CLASSES[tone]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs font-semibold">
        {label}: <span className="font-bold">{value}</span>
      </span>
    </div>
  );
}

function RoleBadge({ role }: { role?: string }) {
  return (
    <AdminStatusBadge
      status={role || "passenger"}
      tone={role === "driver" ? "success" : role === "admin" ? "info" : "muted"}
    />
  );
}

function VerificationMethodBadge({
  label,
  verified,
}: {
  label: string;
  verified: boolean;
}) {
  const Icon = verified ? CircleCheck : CircleX;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
        verified
          ? "bg-[var(--color-success-tint)] text-[var(--color-success)]"
          : "bg-[var(--color-background)] text-[var(--color-muted)]"
      }`}
      title={`${label}: ${verified ? "Verified" : "Not verified"}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function VerificationMethodRow({
  label,
  verified,
}: {
  label: string;
  verified: boolean;
}) {
  const Icon = verified ? CircleCheck : CircleX;
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--color-primary)]">{label}</span>
      <span
        className={`inline-flex items-center gap-1 text-xs font-semibold ${
          verified
            ? "text-[var(--color-success)]"
            : "text-[var(--color-danger)]"
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {verified ? "Verified" : "Not verified"}
      </span>
    </div>
  );
}

function Avatar({ name }: { name?: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-[var(--color-on-primary)]">
      {getInitials(name)}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
        {title}
      </div>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
      <span className="text-[var(--color-muted)]">{label}:</span>
      <span className="truncate font-medium text-[var(--color-primary)]">
        {value || "—"}
      </span>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="truncate text-sm font-semibold text-[var(--color-primary)]">
        {value || "—"}
      </div>
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  optionLabels,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  optionLabels?: Record<string, string>;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold text-[var(--color-muted)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-[var(--color-primary)] outline-none transition focus:border-[var(--color-secondary)] focus:ring-2 focus:ring-[var(--color-secondary-tint)]"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {optionLabels ? optionLabels[opt] : opt}
          </option>
        ))}
      </select>
    </label>
  );
}
