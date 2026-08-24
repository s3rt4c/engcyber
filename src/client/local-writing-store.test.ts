import { describe, expect, it } from "vitest";

import { LocalErrorMemoryStore } from "@/client/local-error-memory-store";
import { LocalWritingSessionStore } from "@/client/local-writing-session-store";
import type { ErrorOccurrence, WritingSession } from "@/domain/writing";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function session(id: string, updatedAt = "2026-08-24T00:00:00.000Z"): WritingSession {
  return { id, lessonId: `lesson-${id}`, contentId: "content-1", contentFingerprint: "sha256:content", task: "Write 80 to 150 words about the security incident and its effects.", minWords: 80, maxWords: 150, firstDraft: "The organization must patch the system after the incident.", initialFeedback: null, revisedDraft: null, revisionFeedback: null, createdAt: updatedAt, updatedAt };
}

function occurrence(id: string, writingSessionId = "session-1", dismissed = false): ErrorOccurrence {
  return { id, writingSessionId, attemptNumber: 1, category: "grammar", subcategory: "article", patternKey: "grammar.article", originalText: "a organization", correctedText: "an organization", explanation: "Use an before a vowel sound.", severity: "major", confidence: 0.9, createdAt: `2026-08-${String(Number(id.replace("occurrence-", "")) || 1).padStart(2, "0")}T00:00:00.000Z`, dismissed, correctedAt: null };
}

describe("M3 local writing persistence", () => {
  it("persists a validated writing session across a new store instance", async () => {
    const storage = new MemoryStorage();
    await new LocalWritingSessionStore(storage).save(session("one"));
    await expect(new LocalWritingSessionStore(storage).getByLesson("lesson-one")).resolves.toMatchObject({ id: "one", firstDraft: "The organization must patch the system after the incident." });
  });

  it("recovers safely from corrupt writing-session data", async () => {
    const storage = new MemoryStorage();
    storage.setItem("engcyber.writing-sessions.v1", "not-json");
    await expect(new LocalWritingSessionStore(storage).getByLesson("lesson-one")).resolves.toBeNull();
    expect(storage.getItem("engcyber.writing-sessions.v1")).toBeNull();
  });

  it("retains only the 50 newest writing sessions", async () => {
    const store = new LocalWritingSessionStore(new MemoryStorage());
    for (let index = 0; index < 51; index += 1) await store.save(session(String(index), `2026-08-24T00:${String(index).padStart(2, "0")}:00.000Z`));
    expect(await store.list()).toHaveLength(50);
    await expect(store.getByLesson("lesson-0")).resolves.toBeNull();
  });

  it("derives persisted patterns and removes a dismissed occurrence without an AI operation", async () => {
    const store = new LocalErrorMemoryStore(new MemoryStorage(), () => "2026-08-24T00:00:00.000Z");
    await store.record(occurrence("occurrence-1"));
    expect((await store.snapshot()).patterns).toMatchObject([{ patternKey: "grammar.article", occurrenceCount: 1 }]);
    await store.dismiss("occurrence-1");
    expect((await store.snapshot()).patterns).toEqual([]);
    expect((await store.snapshot()).occurrences).toMatchObject([{ id: "occurrence-1", dismissed: true }]);
  });

  it("records M4 review status without adding scheduling data to Error Memory", async () => {
    const store = new LocalErrorMemoryStore(new MemoryStorage(), () => "2026-08-24T00:00:00.000Z");
    await store.record(occurrence("occurrence-1"));
    await expect(store.setReviewStatus("grammar.article", "mastered")).resolves.toBe(true);
    await expect(store.snapshot()).resolves.toMatchObject({ patterns: [{ patternKey: "grammar.article", status: "mastered", reviewStatus: "mastered" }] });
    await expect(store.setReviewStatus("grammar.article", "needs_practice")).resolves.toBe(true);
    await expect(store.snapshot()).resolves.toMatchObject({ patterns: [{ patternKey: "grammar.article", status: "needs_practice", reviewStatus: "needs_practice" }] });
  });

  it("retains no more than 200 error occurrences and no more than 100 patterns", async () => {
    const store = new LocalErrorMemoryStore(new MemoryStorage(), () => "2026-08-24T00:00:00.000Z");
    for (let index = 1; index <= 201; index += 1) await store.record({ ...occurrence(`occurrence-${index}`, `session-${index}`), createdAt: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z` });
    const snapshot = await store.snapshot();
    expect(snapshot.occurrences).toHaveLength(200);
    expect(snapshot.patterns).toHaveLength(1);
  });

  it("fails gracefully when browser storage is unavailable", async () => {
    await expect(new LocalWritingSessionStore(null).save(session("one"))).resolves.toBe(false);
    await expect(new LocalErrorMemoryStore(null).record(occurrence("occurrence-1"))).resolves.toBe(false);
  });
});
