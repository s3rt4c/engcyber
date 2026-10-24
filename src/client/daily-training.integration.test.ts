import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDailyHub, loadLocalLearningData } from "@/client/local-learning-loaders";
import { createReadOnlyHomeReaders } from "@/client/home-learning-readers";
import { learnerStorageKeys } from "@/client/backup-storage";
import { applyReviewVerdict } from "@/domain/review";
import { TrainingStorage, trainingFixture, trainingReading } from "@/test/daily-training-fixtures";

const now = "2026-10-24T12:00:00.000Z";
const options = { now, timeZone: "UTC" };
const hub = async (storage: TrainingStorage, overrides = {}) => buildDailyHub(await loadLocalLearningData(createReadOnlyHomeReaders(storage)), { ...options, ...overrides });
afterEach(() => vi.unstubAllGlobals());

describe("M18 Home derivation over accepted local stores", () => {
  it("loads a real mixed state once, selects Review/Vocabulary/Writing, and neither writes nor fetches", async () => {
    const f = await trainingFixture(now); const before = f.storage.contents();
    const fetch = vi.fn(() => { throw new Error("Home must not fetch"); }); vi.stubGlobal("fetch", fetch);
    const reads = vi.spyOn(f.storage, "getItem");
    const result = await hub(f.storage);
    expect(result.trainingQueue.map((item) => item.href)).toEqual(["/review", "/vocabulary", "/library/lessons/training-lesson"]);
    expect(result.continueItems).toHaveLength(2); expect(result.ieltsContinuations).toHaveLength(1);
    expect(reads).toHaveBeenCalledTimes(10); expect(fetch).not.toHaveBeenCalled();
    expect(f.storage.writes).toBe(0); expect(f.storage.contents()).toEqual(before);
    expect(Object.keys(before).sort()).toEqual([...learnerStorageKeys].sort());
  });
  it("recomputes after explicit existing store operations without queue persistence", async () => {
    const f = await trainingFixture(now);
    const applied = applyReviewVerdict(f.review[0], "correct", "scheduled", now, "review-result", "training-review-session");
    await f.stores.review.save([applied.item], [applied.event]);
    expect((await hub(f.storage)).trainingQueue.map((item) => item.kind)).toEqual(["vocabulary", "writing", "ielts"]);
    await f.stores.phrase.delete("training-phrase");
    expect((await hub(f.storage)).trainingQueue.map((item) => item.kind)).toEqual(["writing", "ielts", "listening"]);
    await f.stores.writing.save({ ...f.writing, initialFeedback: null });
    await f.stores.ielts.saveReading({ ...f.reading, completedAt: now });
    await f.stores.listening.save({ sessions: [{ ...f.listening, completedAt: now }], attempts: [], shadowingEvents: [], playbackRate: 1 });
    expect((await hub(f.storage)).trainingQueue).toEqual([]);
    expect(Object.keys(f.storage.contents()).sort()).toEqual([...learnerStorageKeys].sort());
  });
  it("excludes ownerless Review and deleted Vocabulary phrases", async () => {
    const f = await trainingFixture(now);
    f.storage.values.delete("engcyber.error-memory.v1"); await f.stores.phrase.delete("training-phrase");
    expect((await hub(f.storage)).trainingQueue.map((item) => item.kind)).toEqual(["writing", "ielts", "listening"]);
  });
  it("excludes Review when its last eligible occurrence is dismissed even if a stale pattern remains", async () => {
    const f = await trainingFixture(now); const key = "engcyber.error-memory.v1";
    const value = JSON.parse(f.storage.getItem(key)!); value.occurrences[0].dismissed = true; f.storage.values.set(key, JSON.stringify(value));
    expect((await hub(f.storage)).trainingQueue.some((item) => item.kind === "review")).toBe(false);
  });
  it("excludes legacy writing without context, deleted lessons and completed continuations", async () => {
    const f = await trainingFixture(now); const { context, ...legacy } = f.lesson; expect(context).toBeDefined(); await f.stores.lesson.save(legacy);
    await f.stores.ielts.saveReading({ ...f.reading, completedAt: now });
    await f.stores.listening.save({ sessions: [{ ...f.listening, completedAt: now }], attempts: [], shadowingEvents: [], playbackRate: 1 });
    expect((await hub(f.storage)).trainingQueue.map((item) => item.kind)).toEqual(["review", "vocabulary"]);
    f.storage.values.delete("engcyber.lessons.v1");
    expect((await hub(f.storage)).trainingQueue.map((item) => item.kind)).toEqual(["review", "vocabulary"]);
  });
  it("uses the accepted learner-local overdue boundary", async () => {
    const f = await trainingFixture(now); const boundary = "2026-10-24T00:30:00.000Z";
    await f.stores.review.save([{ ...f.review[0], dueAt: "2026-10-23T23:30:00.000Z" }], []);
    const utc = await hub(f.storage, { now: boundary, timeZone: "UTC" });
    const istanbul = await hub(f.storage, { now: boundary, timeZone: "Europe/Istanbul" });
    expect(utc.trainingQueue[0].reason).toBe("1 error-pattern review is overdue.");
    expect(istanbul.trainingQueue[0].reason).toBe("1 error-pattern review is due now.");
  });
  it("does not recommend future-invalid records and keeps an older valid IELTS target", async () => {
    const f = await trainingFixture(now); const future = "2026-10-25T12:00:00.000Z";
    await f.stores.writing.save({ ...f.writing, updatedAt: future });
    await f.stores.ielts.saveReading(trainingReading(future, "future-reading"));
    await f.stores.listening.save({ sessions: [{ ...f.listening, updatedAt: future }], attempts: [], shadowingEvents: [], playbackRate: 1 });
    expect((await hub(f.storage)).trainingQueue.map((item) => item.href)).toEqual(["/review", "/vocabulary", "/ielts/reading/training-reading"]);
  });
  it("preserves corrupt/unsupported storage bytes and derives an empty queue", async () => {
    const storage = new TrainingStorage(); for (const key of learnerStorageKeys) storage.values.set(key, "{");
    storage.values.set("unrelated", "untouched"); const before = storage.contents();
    expect((await hub(storage)).trainingQueue).toEqual([]);
    expect(storage.writes).toBe(0); expect(storage.contents()).toEqual(before);
  });
  it("safely handles unavailable storage", async () => {
    const result = buildDailyHub(await loadLocalLearningData(createReadOnlyHomeReaders(null)), options);
    expect(result.trainingQueue).toEqual([]);
  });
  it("does not recommend older writing feedback shadowed by the destination's future draft", async () => {
    const f = await trainingFixture(now);
    await f.stores.writing.save({ ...f.writing, id: "new-draft", initialFeedback: null, updatedAt: "2026-10-25T12:00:00.000Z" });
    expect((await f.stores.writing.getByLesson(f.lesson.id))?.id).toBe("new-draft");
    expect((await hub(f.storage)).trainingQueue.some((item) => item.kind === "writing")).toBe(false);
  });
  it("resolves equal-timestamp writing sessions identically to the canonical destination regardless of envelope order", async () => {
    const f = await trainingFixture(now);
    const draft = { ...f.writing, id: "a-draft", initialFeedback: null };
    const feedback = { ...f.writing, id: "z-feedback" };
    for (const sessions of [[draft, feedback], [feedback, draft]]) {
      f.storage.values.set("engcyber.writing-sessions.v1", JSON.stringify({ version: "m3-writing-sessions-v1", sessions }));
      expect((await f.stores.writing.getByLesson(f.lesson.id))?.id).toBe("z-feedback");
      expect((await hub(f.storage)).trainingQueue.some((item) => item.kind === "writing")).toBe(true);
    }
  });
  it("does not recommend older Listening work shadowed by a future session at the same canonical URL", async () => {
    const f = await trainingFixture(now);
    await f.stores.phrase.delete("training-phrase");
    await f.stores.writing.save({ ...f.writing, initialFeedback: null });
    f.storage.values.delete("engcyber.error-memory.v1");
    await f.stores.listening.save({ sessions: [f.listening, { ...f.listening, id: "future-session", updatedAt: "2026-10-25T12:00:00.000Z" }], attempts: [], shadowingEvents: [], playbackRate: 1 });
    expect((await hub(f.storage)).trainingQueue.map((item) => item.kind)).toEqual(["ielts"]);
  });
});
