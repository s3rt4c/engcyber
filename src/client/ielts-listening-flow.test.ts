import { describe, expect, it } from "vitest";

import { canPersistIeltsListeningSession, createOrResumeIeltsListeningSession, markCurrentIeltsListeningPlaybackStarted, markIeltsListeningPlaybackStarted, submitIeltsListeningSession, updateIeltsListeningAnswer } from "@/client/ielts-listening-flow";
import { ieltsListeningPracticeBank } from "@/domain/ielts-listening-bank";

const practice = ieltsListeningPracticeBank[0]!;
const now = "2026-08-28T10:00:00.000Z";

describe("M12 IELTS Listening flow", () => {
  it("resumes one unfinished session and creates a new session only after a completed attempt", () => {
    const first = createOrResumeIeltsListeningSession({ sessions: [], definition: practice, now, createId: () => "first" });
    const resumed = createOrResumeIeltsListeningSession({ sessions: [first.session], definition: practice, now, createId: () => "second" });
    expect(resumed).toMatchObject({ resumed: true, session: { id: "first" } });
    const answers = Object.fromEntries(practice.questions.map((question) => [question.id, question.type === "multiple_choice" ? question.correctOptionId : question.acceptedAnswers[0]! ]));
    const completed = submitIeltsListeningSession({ session: { ...first.session, answers }, definition: practice, now });
    expect(completed.session.completedAt).toBe(now);
    const repeated = createOrResumeIeltsListeningSession({ sessions: [completed.session], definition: practice, now, createId: () => "second" });
    expect(repeated).toMatchObject({ resumed: false, session: { id: "second" } });
  });

  it("persists unfinished answers, records only successful playback, and freezes a completed attempt", () => {
    const session = createOrResumeIeltsListeningSession({ sessions: [], definition: practice, now, createId: () => "one" }).session;
    const answered = updateIeltsListeningAnswer(session, practice.questions[0]!.id, "a", now);
    expect(answered.answers).toEqual({ [practice.questions[0]!.id]: "a" });
    expect(markIeltsListeningPlaybackStarted(answered, false, now)).toEqual(answered);
    const played = markIeltsListeningPlaybackStarted(answered, true, now);
    expect(played).toMatchObject({ playbackStartedAt: now, playbackCount: 1 });
    const completed = { ...played, correctCount: 1, totalCount: 6 as const, completedAt: now };
    expect(updateIeltsListeningAnswer(completed, practice.questions[1]!.id, "b", now)).toEqual(completed);
  });

  it("does not let a delayed playback callback overwrite a completed session", () => {
    const unfinished = createOrResumeIeltsListeningSession({ sessions: [], definition: practice, now, createId: () => "one" }).session;
    const answers = Object.fromEntries(practice.questions.map((question) => [question.id, question.type === "multiple_choice" ? question.correctOptionId : question.acceptedAnswers[0]! ]));
    const completed = submitIeltsListeningSession({ session: { ...unfinished, answers }, definition: practice, now }).session;
    const delayedPlayback = markIeltsListeningPlaybackStarted(unfinished, true, now);
    expect(canPersistIeltsListeningSession(completed, delayedPlayback)).toBe(false);
  });

  it("records a delayed playback start from the latest unfinished answer state", () => {
    const opened = createOrResumeIeltsListeningSession({ sessions: [], definition: practice, now, createId: () => "one" }).session;
    const answeredAfterPlay = updateIeltsListeningAnswer(opened, practice.questions[0]!.id, "b", now);
    expect(markCurrentIeltsListeningPlaybackStarted(answeredAfterPlay, opened.id, now)).toMatchObject({ answers: { [practice.questions[0]!.id]: "b" }, playbackCount: 1 });
  });
});
