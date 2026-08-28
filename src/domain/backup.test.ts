import { describe, expect, it } from "vitest";
import { backupPreview, validateBackupManifest } from "@/domain/backup";

const empty = {
  format: "engcyber-backup",
  version: 1,
  createdAt: "2026-08-28T00:00:00.000Z",
  appDataVersion: "m13-local-backup-v1",
  stores: {
    lessons: { lessons: [] }, phrases: { phrases: [] }, writing: { sessions: [] },
    errorMemory: { occurrences: [], patterns: [] }, errorReview: { items: [], events: [] },
    vocabularyReview: { items: [], events: [] }, listening: { sessions: [], attempts: [], shadowingEvents: [], playbackRate: 1 },
    ielts: { reading: [], writing: [], listening: [] },
  },
};

describe("M13 backup manifest", () => {
  it("accepts one complete canonical empty v1 backup and exposes its preview", () => {
    const result = validateBackupManifest(empty);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(backupPreview(result.data)).toMatchObject({ formatVersion: 1, lessons: 0, phrases: 0, ieltsListening: 0 });
  });

  it("rejects an incomplete backup before any restore can be attempted", () => {
    const incomplete = { ...empty, stores: { ...empty.stores } } as Record<string, unknown>;
    delete (incomplete.stores as Record<string, unknown>).phrases;
    expect(validateBackupManifest(incomplete).success).toBe(false);
  });
});
