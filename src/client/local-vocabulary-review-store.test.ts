import { describe, expect, it } from "vitest";

import { LocalVocabularyReviewStore } from "@/client/local-vocabulary-review-store";
import { enrollVocabularyPhrase, type VocabularyReviewEvent } from "@/domain/vocabulary-review";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

const now = "2026-08-26T09:00:00.000Z";
const item = enrollVocabularyPhrase("phrase-1", now);
const event: VocabularyReviewEvent = {
  id: "event-1", phraseId: "phrase-1", reviewedAt: now, reviewKind: "scheduled", outcome: "correct", stageBefore: 0, stageAfter: 1, statusBefore: "learning", statusAfter: "learning", scheduleChanged: true,
};

describe("LocalVocabularyReviewStore", () => {
  it("stores one review item per phrase and retains only the newest thousand metadata events", async () => {
    const store = new LocalVocabularyReviewStore(new MemoryStorage());
    const events = Array.from({ length: 1001 }, (_, index) => ({ ...event, id: `event-${String(index).padStart(4, "0")}` }));
    expect(await store.save([item], events)).toBe(true);
    const snapshot = await store.snapshot();
    expect(snapshot.items).toEqual([item]);
    expect(snapshot.events).toHaveLength(1000);
    expect(snapshot.events[0]?.id).toBe("event-0001");
  });

  it("refuses duplicate phrase references and more than two hundred review items", async () => {
    const store = new LocalVocabularyReviewStore(new MemoryStorage());
    expect(await store.save([item, item], [])).toBe(false);
    expect(await store.save(Array.from({ length: 201 }, (_, index) => enrollVocabularyPhrase(`phrase-${index}`, now)), [])).toBe(false);
  });

  it("returns a non-destructive empty fallback for corrupt browser data", async () => {
    const storage = new MemoryStorage();
    storage.setItem("engcyber.vocabulary-review.v1", "{not json");
    const store = new LocalVocabularyReviewStore(storage);

    expect(await store.snapshot()).toEqual({ items: [], events: [] });
    expect(storage.getItem("engcyber.vocabulary-review.v1")).toBe("{not json");
  });

  it("removes a phrase's review item and events only through an explicit cleanup action", async () => {
    const store = new LocalVocabularyReviewStore(new MemoryStorage());
    await store.save([item], [event]);

    expect(await store.removePhrase("phrase-1")).toBe("removed");
    expect(await store.snapshot()).toEqual({ items: [], events: [] });
  });

  it("does not overwrite corrupt review data during phrase cleanup", async () => {
    const storage = new MemoryStorage();
    storage.setItem("engcyber.vocabulary-review.v1", "{not json");
    const store = new LocalVocabularyReviewStore(storage);

    expect(await store.removePhrase("phrase-1")).toBe("unavailable");
    expect(storage.getItem("engcyber.vocabulary-review.v1")).toBe("{not json");
  });

  it("does not overwrite corrupt review data through a normal save", async () => {
    const storage = new MemoryStorage();
    storage.setItem("engcyber.vocabulary-review.v1", "{not json");
    const store = new LocalVocabularyReviewStore(storage);

    expect(await store.save([item], [])).toBe(false);
    expect(storage.getItem("engcyber.vocabulary-review.v1")).toBe("{not json");
  });
});
