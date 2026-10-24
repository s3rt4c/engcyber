import { describe, expect, it } from "vitest";
import { selectDailyTraining, type DailyTrainingInput } from "@/domain/daily-training";
import { selectIeltsContinuations } from "@/domain/ielts-continuity";
import { trainingReading } from "@/test/daily-training-fixtures";

const now = "2026-10-24T12:00:00.000Z";
const empty = (): DailyTrainingInput => ({ review: { dueNow: 0, overdue: 0 }, vocabulary: { dueNow: 0, overdue: 0 }, writing: [], ielts: [], listening: null });
const writing = (id: string, createdAt = "2026-10-23T10:00:00.000Z") => ({ id, title: "Revise writing" as const, href: `/library/lessons/${id}`, createdAt });
const ielts = (id: string, updatedAt = now) => selectIeltsContinuations({ reading: [trainingReading(updatedAt, id)], writing: [], listening: [] });
const run = (input: DailyTrainingInput) => selectDailyTraining(input, { now });
const kinds = (input: DailyTrainingInput) => run(input).map((item) => item.kind);

describe("M18 daily training priority", () => {
  it("leaves an empty queue empty instead of inventing discovery work", () => expect(run(empty())).toEqual([]));
  it("puts overdue Review before overdue Vocabulary", () => {
    expect(kinds({ ...empty(), review: { dueNow: 3, overdue: 2 }, vocabulary: { dueNow: 2, overdue: 1 } })).toEqual(["review", "vocabulary"]);
  });
  it("emits one Review task when overdue and due-now items coexist", () => {
    const queue = run({ ...empty(), review: { dueNow: 5, overdue: 2 } });
    expect(queue).toHaveLength(1); expect(queue[0]).toMatchObject({ href: "/review", reason: "2 error-pattern reviews are overdue." });
  });
  it("places overdue Vocabulary ahead of due-now Review", () => {
    expect(kinds({ ...empty(), review: { dueNow: 1, overdue: 0 }, vocabulary: { dueNow: 1, overdue: 1 } })).toEqual(["vocabulary", "review"]);
  });
  it("puts due-now Review before due-now Vocabulary and continuations", () => {
    expect(kinds({ ...empty(), review: { dueNow: 1, overdue: 0 }, vocabulary: { dueNow: 2, overdue: 0 }, writing: [writing("a")], ielts: ielts("reading"), listening: { href: "/listening?lesson=saved" } })).toEqual(["review", "vocabulary", "writing"]);
  });
  it("puts both overdue workflows ahead of continuations", () => {
    expect(kinds({ ...empty(), review: { dueNow: 1, overdue: 1 }, vocabulary: { dueNow: 1, overdue: 1 }, writing: [writing("a")] })).toEqual(["review", "vocabulary", "writing"]);
  });
  it("orders Writing, accepted IELTS, then M5 Listening", () => {
    expect(kinds({ ...empty(), writing: [writing("a")], ielts: ielts("reading"), listening: { href: "/listening?lesson=saved" } })).toEqual(["writing", "ielts", "listening"]);
  });
  it("includes a lone M5 continuation without inventing higher-tier work", () => {
    expect(run({ ...empty(), listening: { href: "/listening?lesson=saved" } })).toMatchObject([{ kind: "listening", href: "/listening?lesson=saved" }]);
  });
  it("retains the accepted newest-first IELTS order and excludes future candidates", () => {
    const candidates = [...ielts("old", "2026-10-22T10:00:00.000Z"), ...ielts("new"), ...ielts("future", "2026-10-25T10:00:00.000Z")];
    const ordered = candidates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    expect(run({ ...empty(), ielts: ordered }).map((item) => item.href)).toEqual(["/ielts/reading/new", "/ielts/reading/old"]);
  });
  it("caps the result at three and resolves writing ties like Library by timestamp then descending ID", () => {
    const input = { ...empty(), writing: [writing("a"), writing("c"), writing("b"), writing("old", "2026-10-22T10:00:00.000Z")] };
    expect(run(input).map((item) => item.href)).toEqual(["/library/lessons/c", "/library/lessons/b", "/library/lessons/a"]);
    expect(run({ ...input, writing: [...input.writing].reverse() })).toEqual(run(input));
  });
  it("suppresses duplicate hrefs before applying the limit", () => {
    expect(run({ ...empty(), writing: [writing("a"), { ...writing("other"), href: "/library/lessons/a" }], ielts: [...ielts("one"), ...ielts("one")], listening: { href: "/listening?lesson=saved" } }).map((item) => item.href)).toEqual(["/library/lessons/a", "/ielts/reading/one", "/listening?lesson=saved"]);
  });
  it("excludes invalid/future writing timestamps without hiding valid work", () => {
    expect(run({ ...empty(), writing: [writing("future", "2026-10-25T10:00:00.000Z"), writing("invalid", "bad"), writing("valid")] }).map((item) => item.href)).toEqual(["/library/lessons/valid"]);
  });
  it("describes due-now rather than future work due later today", () => {
    expect(run({ ...empty(), vocabulary: { dueNow: 4, overdue: 0 } })[0].reason).toBe("4 vocabulary items are due now.");
  });
  it("uses truthful feedback-review wording", () => {
    expect(run({ ...empty(), writing: [{ ...writing("a"), title: "Review revision feedback" }] })[0].reason).toBe("Revisit your saved revision feedback.");
  });
  it("returns identical output without mutating frozen inputs", () => {
    const input = { ...empty(), writing: [writing("a")], ielts: ielts("reading") };
    const before = JSON.stringify(input); Object.freeze(input.writing); Object.freeze(input.ielts); Object.freeze(input);
    expect(run(input)).toEqual(run(input)); expect(JSON.stringify(input)).toBe(before);
    expect(new Set(run(input).map((item) => item.id)).size).toBe(run(input).length);
  });
});
