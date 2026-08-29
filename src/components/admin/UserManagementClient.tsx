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
  Phone,
  Mail,
  CalendarDays,
  FileText,
  ExternalLink,
  Gauge,
  Palette,
  type LucideIcon,
} from "lucide-react";

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
  role?: string;
  createdAt?: string;
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
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
  navy: "bg-slate-900/5 text-slate-900 ring-slate-900/10",
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
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const summary = useMemo(() => {
    const driverCount = rows.filter((r) => r.role === "driver").length;
    const adminCount = rows.filter((r) => r.role === "admin").length;
    const pendingCount = rows.filter(
      (r) => r.driver?.verificationStatus === "pending",
    ).length;
    return { total: rows.length, driverCount, adminCount, pendingCount };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesRole =
        roleFilter === "all" || (row.role || "passenger") === roleFilter;
      if (!matchesRole) return false;
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
  }, [rows, query, roleFilter]);

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
    setSavingIds((current) => ({ ...current, [userId]: true }));
    setFeedback((current) => ({
      ...current,
      [userId]: { type: "success", message: "Saving…" },
    }));

    try {
      const payload: { role: string; verificationStatus?: VerificationStatus } =
        {
          role: user.role ?? "passenger",
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

  return (
    <section className="mx-auto w-full max-w-5xl rounded-3xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-5 border-b border-slate-100 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatPill
              icon={Users}
              tone="navy"
              label="Total"
              value={summary.total}
            />
            <StatPill
              icon={Car}
              tone="teal"
              label="Drivers"
              value={summary.driverCount}
            />
            <StatPill
              icon={ShieldCheck}
              tone="slate"
              label="Admins"
              value={summary.adminCount}
            />
            {summary.pendingCount > 0 && (
              <StatPill
                icon={Clock}
                tone="amber"
                label="Pending review"
                value={summary.pendingCount}
              />
            )}
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by #number, name, phone, or email"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {["all", ...ROLE_OPTIONS].map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setRoleFilter(role)}
                className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold capitalize transition ${
                  roleFilter === role
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {filteredRows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <Users className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">{emptyMessage}</p>
        </div>
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
                    ? "border-slate-200 shadow-md"
                    : "border-slate-100 hover:border-slate-200 hover:shadow-sm"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(user._id)}
                  className="flex w-full items-center justify-between gap-4 bg-white px-4 py-3.5 text-left sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={user.name} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">
                        {user.name || "Unnamed user"}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        #{user.userNumber ?? "—"} · {user.phone || "—"} ·{" "}
                        {user.email || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <RoleBadge role={user.role} />
                    {verification && (
                      <span
                        className={`hidden items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset sm:inline-flex ${TONE_CLASSES[verification.tone]}`}
                      >
                        <verification.Icon className="h-3.5 w-3.5" />
                        {verification.label}
                      </span>
                    )}
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>

                {expanded && (
                  <div className="grid gap-4 border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <InfoCard title="Basic info">
                        <InfoRow
                          icon={Phone}
                          label="Phone"
                          value={user.phone}
                        />
                        <InfoRow icon={Mail} label="Email" value={user.email} />
                        <InfoRow
                          icon={CalendarDays}
                          label="Joined"
                          value={
                            user.createdAt
                              ? new Date(user.createdAt).toLocaleDateString()
                              : "—"
                          }
                        />
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
                          className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
                        >
                          {savingIds[user._id] ? "Saving…" : "Save changes"}
                        </button>

                        {feedbackMessage && (
                          <div
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                              feedbackMessage.type === "success"
                                ? "bg-teal-50 text-teal-700"
                                : "bg-amber-50 text-amber-700"
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
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Plate
                            </span>
                            <span className="rounded-lg border border-slate-300 bg-white px-3 py-1 font-mono text-sm font-bold tracking-widest text-slate-900">
                              {buildPlate(user.driver) || "—"}
                            </span>
                            <span className="ml-2 text-xs text-slate-500">
                              {user.driver.carType || "—"} ·{" "}
                              {user.driver.modelYear || "—"}
                            </span>
                          </div>
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
                                  const isImage =
                                    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(
                                      value,
                                    );
                                  return (
                                    <a
                                      key={key}
                                      href={value}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-teal-300 hover:shadow-md"
                                    >
                                      <div className="relative aspect-4/3 w-full overflow-hidden bg-slate-100">
                                        {isImage ? (
                                          <img
                                            src={value}
                                            alt={docLabel}
                                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                          />
                                        ) : (
                                          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
                                            <FileText className="h-6 w-6" />
                                            <span className="text-[11px] font-medium">
                                              File
                                            </span>
                                          </div>
                                        )}
                                        <div className="absolute right-2 top-2 rounded-full bg-white/90 p-1 opacity-0 shadow-sm transition group-hover:opacity-100">
                                          <ExternalLink className="h-3 w-3 text-slate-600" />
                                        </div>
                                      </div>
                                      <div className="px-2.5 py-2 text-[11px] font-semibold text-slate-600">
                                        {docLabel}
                                      </div>
                                    </a>
                                  );
                                },
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500">
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
    </section>
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
  const tone = role === "admin" ? "navy" : role === "driver" ? "teal" : "slate";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${TONE_CLASSES[tone]}`}
    >
      {role || "passenger"}
    </span>
  );
}

function Avatar({ name }: { name?: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-slate-800 to-slate-600 text-sm font-bold text-white">
      {getInitials(name)}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
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
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="text-slate-400">{label}:</span>
      <span className="truncate font-medium text-slate-800">
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
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="truncate text-sm font-semibold text-slate-800">
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
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
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
