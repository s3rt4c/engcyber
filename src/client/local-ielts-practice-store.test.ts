import { describe, expect, it } from "vitest";
import { LocalIeltsPracticeStore } from "@/client/local-ielts-practice-store";
import { ieltsListeningPracticeBank } from "@/domain/ielts-listening-bank";

class MemoryStorage { values = new Map<string, string>(); getItem(key: string) { return this.values.get(key) ?? null; } setItem(key: string, value: string) { this.values.set(key, value); } }
const now = "2026-08-26T00:00:00.000Z";
const reading = (id = "reading-1") => ({ id, generationFingerprint: `generation-${id}`, sourceId: "source-1", sourceFingerprint: "sha256:source", sourceTitle: "Source", sourceUrl: null, questions: [...[0, 1, 2].map((index) => ({ id: `mc-${index}`, type: "multiple_choice" as const, question: "Which statement is supported by the source?", options: ["a", "b", "c", "d"].map((option) => ({ id: option, text: option })), correctOptionId: "a", relevantSourceContext: "The source says this.", explanation: "The source supports it." })), ...[3, 4, 5].map((index) => ({ id: `tfng-${index}`, type: "true_false_not_given" as const, question: "The source makes this statement.", answer: "not_given" as const, relevantSourceContext: "The source says this.", explanation: "The required information is absent." }))], answers: {}, completedAt: null, elapsedSeconds: null, createdAt: now, updatedAt: now });
const listening = (id = "listening-1", updatedAt = now) => ({ id, practiceDefinitionId: ieltsListeningPracticeBank[0]!.id, answers: {}, playbackStartedAt: null, playbackCount: 0, correctCount: null, totalCount: null, createdAt: now, updatedAt, completedAt: null });

describe("M11 local IELTS practice store", () => {
  it("persists an unfinished reading practice without provider work and restores its answers", async () => {
    const storage = new MemoryStorage();
    const store = new LocalIeltsPracticeStore(storage);
    await expect(store.saveReading({ ...reading(), answers: { "mc-0": "a" } })).resolves.toBe(true);
    await expect(new LocalIeltsPracticeStore(storage).getReading("reading-1")).resolves.toMatchObject({ answers: { "mc-0": "a" }, completedAt: null });
  });

  it("reads valid M11 data without rewriting it, then retains Listening separately after an explicit v2 save", async () => {
    const storage = new MemoryStorage();
    const v1 = JSON.stringify({ version: "m11-ielts-practice-v1", reading: [reading()], writing: [] });
    storage.setItem("engcyber.ielts-practice.v1", v1);
    const store = new LocalIeltsPracticeStore(storage);
    await expect(store.listListening()).resolves.toEqual([]);
    expect(storage.values.get("engcyber.ielts-practice.v1")).toBe(v1);
    await expect(store.saveListening(listening())).resolves.toBe(true);
    await expect(store.getReading("reading-1")).resolves.toMatchObject({ id: "reading-1" });
    await expect(store.getListening("listening-1")).resolves.toMatchObject({ practiceDefinitionId: ieltsListeningPracticeBank[0]!.id });
  });

  it("retains at most thirty Listening sessions without evicting Reading", async () => {
    const storage = new MemoryStorage();
    const store = new LocalIeltsPracticeStore(storage);
    await store.saveReading(reading());
    for (let index = 0; index < 31; index += 1) await store.saveListening(listening(`listening-${index}`, `2026-08-26T00:${String(index).padStart(2, "0")}:00.000Z`));
    await expect(store.listListening()).resolves.toHaveLength(30);
    await expect(store.getListening("listening-0")).resolves.toBeNull();
    await expect(store.getReading("reading-1")).resolves.toMatchObject({ id: "reading-1" });
  });
});
