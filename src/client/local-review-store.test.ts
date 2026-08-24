import { describe, expect, it } from "vitest";

import { LocalReviewStore } from "@/client/local-review-store";
import type { ReviewEvent, ReviewItem } from "@/domain/review";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function item(id = "review-1"): ReviewItem {
  return { id, sourceType: "error_pattern", patternKey: "grammar.article", category: "grammar", subcategory: "article", status: "scheduled", stage: 0, dueAt: "2026-08-25T00:00:00.000Z", createdAt: "2026-08-24T00:00:00.000Z", lastReviewedAt: null, successfulReviews: 0, failedReviews: 0, lapseCount: 0, representativeOccurrenceId: "occurrence-1", updatedAt: "2026-08-24T00:00:00.000Z" };
}

function event(id = "event-1"): ReviewEvent {
  return { id, reviewItemId: "review-1", patternKey: "grammar.article", exerciseType: "correction", reviewKind: "scheduled", reviewedAt: "2026-08-25T00:00:00.000Z", verdict: "correct", stageBefore: 0, stageAfter: 1, dueAtBefore: "2026-08-25T00:00:00.000Z", dueAtAfter: "2026-08-28T00:00:00.000Z", providerUsed: false, providerId: null, providerModel: null, reviewSessionId: "session-1" };
}

describe("M4 local review persistence", () => {
  it("persists a review schedule and metadata-only events across a new store instance", async () => {
    const storage = new MemoryStorage();
    await expect(new LocalReviewStore(storage).save([item()], [event()])).resolves.toBe(true);
    await expect(new LocalReviewStore(storage).snapshot()).resolves.toEqual({ items: [item()], events: [event()] });
    expect(storage.getItem("engcyber.review-items.v1")).not.toContain("answer");
  });

  it("recovers safely from corrupt stored review data", async () => {
    const storage = new MemoryStorage();
    storage.setItem("engcyber.review-items.v1", "not-json");
    await expect(new LocalReviewStore(storage).snapshot()).resolves.toEqual({ items: [], events: [] });
    expect(storage.getItem("engcyber.review-items.v1")).toBeNull();
  });

  it("rejects duplicate pattern review items instead of leaving ambiguous scheduling state", async () => {
    const store = new LocalReviewStore(new MemoryStorage());
    await expect(store.save([item("review-1"), item("review-2")], [])).resolves.toBe(false);
  });

  it("keeps current items and only the 500 newest events", async () => {
    const store = new LocalReviewStore(new MemoryStorage());
    const events = Array.from({ length: 501 }, (_, index) => event(`event-${index}`).id === "event-500" ? { ...event(`event-${index}`), reviewedAt: "2026-08-27T00:00:00.000Z" } : { ...event(`event-${index}`), reviewedAt: "2026-08-25T00:00:00.000Z" });
    await expect(store.save([item()], events)).resolves.toBe(true);
    const snapshot = await store.snapshot();
    expect(snapshot.items).toEqual([item()]);
    expect(snapshot.events).toHaveLength(500);
    expect(snapshot.events.some((entry) => entry.id === "event-500")).toBe(true);
  });

  it("fails gracefully when browser storage is unavailable", async () => {
    await expect(new LocalReviewStore(null).save([item()], [])).resolves.toBe(false);
  });
});
