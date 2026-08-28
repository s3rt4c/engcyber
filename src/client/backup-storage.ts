export const learnerStorageKeys = ["engcyber.lessons.v1", "engcyber.saved-phrases.v1", "engcyber.writing-sessions.v1", "engcyber.error-memory.v1", "engcyber.review-items.v1", "engcyber.vocabulary-review.v1", "engcyber.listening.v1", "engcyber.ielts-practice.v1"] as const;
export type LearnerStorageKey = typeof learnerStorageKeys[number];
export type BackupStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type RawSnapshot = Readonly<Record<LearnerStorageKey, string | null>>;
export type SerializedRestore = Readonly<Record<LearnerStorageKey, string>>;

export function snapshotBackupStorage(storage: BackupStorage): RawSnapshot {
  return Object.fromEntries(learnerStorageKeys.map((key) => [key, storage.getItem(key)])) as RawSnapshot;
}

function quota(error: unknown) { return error instanceof DOMException && error.name === "QuotaExceededError"; }

export function restoreBackupStorage(storage: BackupStorage, replacement: SerializedRestore): { readonly ok: boolean; readonly rolledBack?: boolean; readonly critical?: boolean; readonly kind?: "quota" | "write" } {
  const before = snapshotBackupStorage(storage);
  const touched: LearnerStorageKey[] = [];
  try {
    for (const key of learnerStorageKeys) {
      touched.push(key);
      storage.setItem(key, replacement[key]);
      if (storage.getItem(key) !== replacement[key]) throw new Error("Storage read-back did not match the restored value.");
    }
    return { ok: true };
  } catch (error) {
    let rolledBack = true;
    for (const key of [...touched].reverse()) {
      try {
        if (before[key] === null) storage.removeItem(key);
        else storage.setItem(key, before[key]);
        if (storage.getItem(key) !== before[key]) rolledBack = false;
      } catch { rolledBack = false; }
    }
    return rolledBack ? { ok: false, rolledBack: true, kind: quota(error) ? "quota" : "write" } : { ok: false, rolledBack: false, critical: true, kind: quota(error) ? "quota" : "write" };
  }
}
