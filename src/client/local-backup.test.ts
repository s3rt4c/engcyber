import { describe, expect, it } from "vitest";
import { learnerStorageKeys, restoreBackupStorage, type BackupStorage } from "@/client/backup-storage";
import { createBackupFromStorage, parseBackupText, serializeRestore } from "@/client/local-backup";

class EmptyStorage implements BackupStorage {
  constructor(private readonly values = new Map<string, string>()) {}
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("local backup decoding", () => {
  it("reports malformed legacy phrase storage without mutating any browser key", () => {
    const values = new Map<string, string>([[learnerStorageKeys[1], "{"]]);
    const storage = new EmptyStorage(values);
    expect(() => createBackupFromStorage(storage)).toThrow("Phrases data is malformed");
    expect(storage.getItem(learnerStorageKeys[1])).toBe("{");
  });

  it("reports malformed backup JSON as a clear import rejection", () => {
    expect(() => parseBackupText("{")).toThrow("not valid JSON");
  });

  it("round-trips an empty current store through the canonical restore envelopes", () => {
    const exported = createBackupFromStorage(new EmptyStorage(), "2026-08-28T00:00:00.000Z");
    const restored = new EmptyStorage();
    expect(restoreBackupStorage(restored, serializeRestore(exported))).toMatchObject({ ok: true });
    expect(createBackupFromStorage(restored, "2026-08-28T00:00:00.000Z")).toEqual(exported);
  });
});
