export type DuplicateShareRecovery<T> =
  | { kind: "active"; share: T }
  | { kind: "conflict" };

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

export async function recoverDuplicateShare<T>(
  error: unknown,
  findActive: () => Promise<T | null>,
): Promise<DuplicateShareRecovery<T>> {
  if (!isDuplicateKeyError(error)) throw error;
  const share = await findActive();
  return share ? { kind: "active", share } : { kind: "conflict" };
}
