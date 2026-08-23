import { describe, expect, it } from "vitest";

import { LocalPhraseStore } from "@/client/local-phrase-store";

describe("LocalPhraseStore", () => {
  it("deduplicates the same phrase in the same source and context", async () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    const store = new LocalPhraseStore(storage);
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
});
