/**
 * Fine-grained admin permission strings. Attached to `User.permissions[]`. If a
 * user has `role === "admin"` and no `permissions` array (or empty), they are
 * treated as full-access admin for backward compatibility.
 */
export const PERMISSIONS = {
  TRANSACTIONS_VIEW: "transactions.view",
  TRANSACTIONS_DETAILS: "transactions.details",
  TRANSACTIONS_EXPORT: "transactions.export",
  TRANSACTIONS_REPORTS: "transactions.reports",
  TRANSACTIONS_REFUND: "transactions.refund",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_TRANSACTION_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.TRANSACTIONS_VIEW,
  PERMISSIONS.TRANSACTIONS_DETAILS,
  PERMISSIONS.TRANSACTIONS_EXPORT,
  PERMISSIONS.TRANSACTIONS_REPORTS,
  PERMISSIONS.TRANSACTIONS_REFUND,
];

/** True when the user is admin and either has no perms array (legacy full-access) or has this perm. */
export function hasPermission(
  role: string | undefined,
  perms: string[] | undefined | null,
  required: PermissionKey,
): boolean {
  if (role !== "admin") return false;
  if (!Array.isArray(perms) || perms.length === 0) return true;
  return perms.includes(required);
}
