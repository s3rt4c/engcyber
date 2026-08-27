import { describe, expect, it } from "vitest";
import { LocalIeltsPracticeStore } from "@/client/local-ielts-practice-store";

class MemoryStorage { private values = new Map<string, string>(); getItem(key: string) { return this.values.get(key) ?? null; } setItem(key: string, value: string) { this.values.set(key, value); } }
const now = "2026-08-26T00:00:00.000Z";
const reading = (id = "reading-1") => ({ id, generationFingerprint: `generation-${id}`, sourceId: "source-1", sourceFingerprint: "sha256:source", sourceTitle: "Source", sourceUrl: null, questions: [...[0, 1, 2].map((index) => ({ id: `mc-${index}`, type: "multiple_choice" as const, question: "Which statement is supported by the source?", options: ["a", "b", "c", "d"].map((option) => ({ id: option, text: option })), correctOptionId: "a", relevantSourceContext: "The source says this.", explanation: "The source supports it." })), ...[3, 4, 5].map((index) => ({ id: `tfng-${index}`, type: "true_false_not_given" as const, question: "The source makes this statement.", answer: "not_given" as const, relevantSourceContext: "The source says this.", explanation: "The required information is absent." }))], answers: {}, completedAt: null, elapsedSeconds: null, createdAt: now, updatedAt: now });

describe("M11 local IELTS practice store", () => {
  it("persists an unfinished reading practice without provider work and restores its answers", async () => {
    const storage = new MemoryStorage();
    const store = new LocalIeltsPracticeStore(storage);
    await expect(store.saveReading({ ...reading(), answers: { "mc-0": "a" } })).resolves.toBe(true);
    await expect(new LocalIeltsPracticeStore(storage).getReading("reading-1")).resolves.toMatchObject({ answers: { "mc-0": "a" }, completedAt: null });
  });
});
