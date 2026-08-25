import { describe, expect, it } from "vitest";

import { LocalPhraseStore } from "@/client/local-phrase-store";

describe("LocalPhraseStore", () => {
  it("deduplicates the same phrase in the same source and context", async () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    const store = new LocalPhraseStore(storage, () => "phrase-one");
    const phrase = { phrase: "establish persistence", context: "They establish persistence.", sourceTitle: "Report", sourceUrl: "https://example.com", contentId: "item-1", savedAt: "2026-08-23T00:00:00.000Z" };
    expect(await store.save(phrase)).toBe("saved");
    expect(await store.save(phrase)).toBe("duplicate");
  });

  it("fails gracefully when browser storage is unavailable", async () => {
    const store = new LocalPhraseStore(null);
    await expect(store.save({ phrase: "phrase", context: "context", sourceTitle: "Source", sourceUrl: null, contentId: null, savedAt: "2026-08-23T00:00:00.000Z" })).resolves.toBe("unavailable");
  });

  it("does not throw when saved data is corrupted", async () => {
    const values = new Map<string, string>();
    const storage = { getItem: () => "not-json", setItem: (key: string, value: string) => values.set(key, value), removeItem: () => undefined };
    const store = new LocalPhraseStore(storage);
    await expect(store.save({ phrase: "phrase", context: "context", sourceTitle: "Source", sourceUrl: null, contentId: null, savedAt: "2026-08-23T00:00:00.000Z" })).resolves.toBe("saved");
    expect([...values.values()][0]).toContain("phrase");
  });

  it("migrates every legacy record to a distinct durable ID and preserves anomalous duplicates", async () => {
    const values = new Map<string, string>();
    values.set("engcyber.saved-phrases.v1", JSON.stringify([
      { phrase: "take action", context: "Teams must take action now.", sourceTitle: "Report", sourceUrl: "https://example.com/report", contentId: "content-1", savedAt: "2026-08-23T00:00:00.000Z" },
      { phrase: "take action", context: "Teams must take action now.", sourceTitle: "Report", sourceUrl: "https://example.com/report", contentId: "content-1", savedAt: "2026-08-24T00:00:00.000Z" },
    ]));
    let counter = 0;
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    const store = new LocalPhraseStore(storage, () => `legacy-${++counter}`);

    const phrases = await store.list();

    expect(phrases.map((phrase) => phrase.id)).toEqual(["legacy-2", "legacy-1"]);
    expect(new Set(phrases.map((phrase) => phrase.id)).size).toBe(2);
    expect(JSON.parse(values.get("engcyber.saved-phrases.v1") ?? "{}")).toMatchObject({ version: "m9-phrases-v2" });
  });

  it("deletes exactly one migrated duplicate and persists the remaining record", async () => {
    const values = new Map<string, string>();
    values.set("engcyber.saved-phrases.v1", JSON.stringify([
      { phrase: "take action", context: "Teams must take action now.", sourceTitle: "Report", sourceUrl: "https://example.com/report", contentId: "content-1", savedAt: "2026-08-23T00:00:00.000Z" },
      { phrase: "take action", context: "Teams must take action now.", sourceTitle: "Report", sourceUrl: "https://example.com/report", contentId: "content-1", savedAt: "2026-08-24T00:00:00.000Z" },
    ]));
    let counter = 0;
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    const store = new LocalPhraseStore(storage, () => `legacy-${++counter}`);
    const [newest, oldest] = await store.list();

    await expect(store.delete(newest.id)).resolves.toBe("deleted");
    await expect(new LocalPhraseStore(storage, () => "unused").list()).resolves.toEqual([oldest]);
  });

  it("orders phrase shelf records by savedAt and keeps the accepted duplicate signature separate from IDs", async () => {
    const values = new Map<string, string>();
    let counter = 0;
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    const store = new LocalPhraseStore(storage, () => `new-${++counter}`);
    await store.save({ phrase: "take action", context: "Teams must take action now.", sourceTitle: "Report", sourceUrl: "https://example.com/report", contentId: "content-1", savedAt: "2026-08-23T00:00:00.000Z" });
    await store.save({ phrase: "share evidence", context: "Teams share evidence quickly.", sourceTitle: "Report", sourceUrl: "https://example.com/report", contentId: "content-1", savedAt: "2026-08-24T00:00:00.000Z" });

    expect((await store.list()).map((phrase) => [phrase.id, phrase.phrase])).toEqual([["new-2", "share evidence"], ["new-1", "take action"]]);
    await expect(store.save({ phrase: " TAKE ACTION ", context: "Teams must take action now. ", sourceTitle: "Different title", sourceUrl: "https://example.com/report", contentId: "content-other", savedAt: "2026-08-25T00:00:00.000Z" })).resolves.toBe("duplicate");
  });

  it("does not destroy a legacy raw array when durable-ID migration cannot be persisted", async () => {
    const raw = JSON.stringify([{ phrase: "take action", context: "Teams must take action now.", sourceTitle: "Report", sourceUrl: "https://example.com/report", contentId: "content-1", savedAt: "2026-08-23T00:00:00.000Z" }]);
    const storage = { getItem: (key: string) => { void key; return raw; }, setItem: (key: string, value: string) => { void key; void value; throw new Error("quota"); }, removeItem: (key: string) => { void key; } };
    const store = new LocalPhraseStore(storage, () => "legacy-id");

    await expect(store.list()).resolves.toMatchObject([{ id: "legacy-id", phrase: "take action" }]);
    expect(storage.getItem("engcyber.saved-phrases.v1")).toBe(raw);
  });
});
