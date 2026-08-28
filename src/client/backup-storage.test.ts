import { describe, expect, it } from "vitest";
import { learnerStorageKeys, restoreBackupStorage, type SerializedRestore } from "@/client/backup-storage";

class MemoryStorage {
  values = new Map<string, string>();
  failOn: string | null = null; failed = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (key === this.failOn && !this.failed) { this.failed = true; throw new DOMException("quota", "QuotaExceededError"); } this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("backup restore transaction", () => {
  it("rolls back the key whose write failed because it was touched before writing", () => {
    const storage = new MemoryStorage();
    for (const key of learnerStorageKeys) storage.setItem(key, `old:${key}`);
    storage.values.set("unrelated", "keep");
    storage.failOn = learnerStorageKeys[2];
    const replacement = Object.fromEntries(learnerStorageKeys.map((key) => [key, `new:${key}`])) as SerializedRestore;
    const result = restoreBackupStorage(storage, replacement);
    expect(result).toMatchObject({ ok: false, rolledBack: true, kind: "quota" });
    for (const key of learnerStorageKeys) expect(storage.getItem(key)).toBe(`old:${key}`);
    expect(storage.getItem("unrelated")).toBe("keep");
  });
});
