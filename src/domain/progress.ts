import type { StoredLesson } from "@/domain/lesson";
import type { ListeningAttempt, ShadowingEvent } from "@/domain/listening";
import { reviewPatternLabel, type ReviewEvent, type ReviewItem } from "@/domain/review";
import type { PersonalErrorPattern, WritingSession } from "@/domain/writing";
import { vocabularyReviewCurrentState, type VocabularyReviewEvent, type VocabularyReviewItem } from "@/domain/vocabulary-review";
import type { IeltsReadingPractice, IeltsWritingSession } from "@/domain/ielts";

export type ProgressRange = "7d" | "30d" | "all";
export type ProgressTimeZone = string;

export interface ProgressSourceData {
  readonly lessons: readonly StoredLesson[];
  readonly writingSessions: readonly WritingSession[];
  readonly errorPatterns: readonly PersonalErrorPattern[];
  readonly reviewItems: readonly ReviewItem[];
  readonly reviewEvents: readonly ReviewEvent[];
  readonly vocabularyReviewItems: readonly VocabularyReviewItem[];
  readonly vocabularyReviewEvents: readonly VocabularyReviewEvent[];
  readonly vocabularyPhraseIds: readonly string[];
  readonly listeningAttempts: readonly ListeningAttempt[];
  readonly shadowingEvents: readonly ShadowingEvent[];
  readonly ieltsReadingPractices?: readonly IeltsReadingPractice[];
  readonly ieltsWritingSessions?: readonly IeltsWritingSession[];
}

export interface ProgressOptions {
  readonly range: ProgressRange;
  readonly now: string;
  readonly timeZone: ProgressTimeZone;
}

export interface ProgressDay {
  readonly date: string;
  readonly lessons: number;
  readonly writing: number;
  readonly review: number;
  readonly listening: number;
}

export interface ActivitySummary {
  readonly activeDays: number;
  readonly lessonsCreated: number;
  readonly writingAnalyses: number;
  readonly revisionReviews: number;
  readonly reviewAttempts: number;
  readonly dictationsCompleted: number;
  readonly shadowingRepetitions: number;
}

export interface WritingProgressSummary {
  readonly analyses: number;
  readonly revisions: number;
  readonly highConfidenceFindings: number;
  readonly averageHighConfidenceFindings: number | null;
  readonly resolvedInRevisions: number;
  readonly remainingInRevisions: number;
  readonly resolutionRate: number | null;
}

export interface ErrorMemoryProgressSummary {
  readonly current: Readonly<Record<PersonalErrorPattern["status"], number>>;
  readonly topPatterns: readonly { readonly label: string; readonly patternKey: string; readonly occurrenceCount: number; readonly status: PersonalErrorPattern["status"]; readonly priority: number }[];
}

export interface ReviewProgressSummary {
  readonly current: { readonly dueNow: number; readonly overdue: number; readonly masteredItems: number };
  readonly events: { readonly attempts: number; readonly scheduled: number; readonly practiceNow: number; readonly correct: number; readonly incorrect: number; readonly uncertain: number; readonly successRate: number | null };
}

export interface VocabularyProgressSummary {
  readonly current: { readonly enrolled: number; readonly dueNow: number; readonly overdue: number; readonly mastered: number; readonly returned: number };
  readonly events: { readonly attempts: number; readonly scheduled: number; readonly practiceNow: number; readonly correct: number; readonly incorrect: number; readonly successRate: number | null };
}

export type ListeningTrend = { readonly kind: "unavailable" } | { readonly kind: "similar"; readonly points: number } | { readonly kind: "higher" | "lower"; readonly points: number };

export interface ListeningProgressSummary {
  readonly dictations: number;
  readonly averageAccuracy: number | null;
  readonly status: Readonly<Record<ListeningAttempt["status"], number>>;
  readonly shadowingRepetitions: number;
  readonly trend: ListeningTrend;
}

export interface LearningBalance {
  readonly lessons: number;
  readonly writing: number;
  readonly review: number;
  readonly listening: number;
}
export interface IeltsProgressSummary {
  readonly reading: { readonly completed: number; readonly correct: number; readonly total: number };
  readonly writing: { readonly initialAnalyses: number; readonly revisionReviews: number; readonly timedPractices: number };
}

export type FocusRecommendationKind = "overdue_review" | "overdue_vocabulary" | "due_review" | "due_vocabulary" | "returned_pattern" | "high_priority_pattern" | "neglected_listening" | "neglected_writing" | "neglected_review" | "neglected_lessons" | "revision_follow_through" | "listening_consistency" | "zero_activity";
export type FocusAction = "review" | "vocabulary" | "listening" | "discover" | "library";

export interface FocusRecommendation {
  readonly kind: FocusRecommendationKind;
  readonly action: FocusAction;
  readonly message: string;
}

export interface ProgressSnapshot {
  readonly range: ProgressRange;
  readonly timeZone: ProgressTimeZone;
  readonly timelineLabel: string;
  readonly activity: ActivitySummary;
  readonly writing: WritingProgressSummary;
  readonly errorMemory: ErrorMemoryProgressSummary;
  readonly review: ReviewProgressSummary;
  readonly vocabulary: VocabularyProgressSummary;
  readonly listening: ListeningProgressSummary;
  readonly balance: LearningBalance;
  readonly ielts: IeltsProgressSummary;
  readonly focus: readonly FocusRecommendation[];
  readonly timeline: readonly ProgressDay[];
}

export const progressHighPriorityMinimumOccurrences = 2;
export const progressHighPriorityMinimumPriority = 40;
export const progressListeningTrendMinimumAttempts = 3;
export const progressListeningTrendMinimumDifference = 5;
const maximumFocusRecommendations = 3;
const recentAllTimeTimelineDays = 30;

type DatedEvent = { readonly timestamp: string; readonly activity: "lessons" | "writing" | "review" | "listening" };

function validInstant(value: string): Date | null {
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

function localDay(value: string, timeZone: ProgressTimeZone): string | null {
  const instant = validInstant(value);
  if (!instant) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
    const part = (kind: string) => parts.find((candidate) => candidate.type === kind)?.value;
    const year = part("year");
    const month = part("month");
    const day = part("day");
    return year && month && day ? `${year}-${month}-${day}` : null;
  } catch {
    return null;
  }
}

function addDays(day: string, offset: number): string {
  const parsed = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/u.exec(day);
  if (!parsed) return day;
  const value = new Date(Date.UTC(Number(parsed[1]), Number(parsed[2]) - 1, Number(parsed[3]) + offset));
  return value.toISOString().slice(0, 10);
}

function dayWindow(range: ProgressRange, nowDay: string): { readonly start: string | null; readonly end: string } {
  if (range === "all") return { start: null, end: nowDay };
  return { start: addDays(nowDay, range === "7d" ? -6 : -29), end: nowDay };
}

type DayWindow = { readonly start: string | null; readonly end: string };

function isSelected(value: string, window: DayWindow, nowMs: number, timeZone: ProgressTimeZone): boolean {
  const instant = validInstant(value);
  if (!instant || instant.getTime() > nowMs) return false;
  const day = localDay(value, timeZone);
  if (!day) return false;
  return !window.start || (day >= window.start && day <= window.end);
}

function selected<T>(values: readonly T[], timestamp: (value: T) => string, window: DayWindow, nowMs: number, timeZone: ProgressTimeZone): T[] {
  return values.filter((value) => isSelected(timestamp(value), window, nowMs, timeZone));
}

function previousWindow(range: ProgressRange, current: DayWindow): DayWindow | null {
  if (range === "all" || !current.start) return null;
  const days = range === "7d" ? 7 : 30;
  return { start: addDays(current.start, -days), end: addDays(current.start, -1) };
}

function initialIssues(session: WritingSession) {
  const dismissed = new Set(session.dismissedErrorIds ?? []);
  return session.initialFeedback?.priorityErrors.filter((issue) => !dismissed.has(issue.id)) ?? [];
}

function revisionIssues(session: WritingSession): { readonly resolved: number; readonly remaining: number } {
  if (!session.revisionFeedback) return { resolved: 0, remaining: 0 };
  const validInitial = new Set(initialIssues(session).map((issue) => issue.id));
  const resolved = new Set(session.revisionFeedback.resolvedErrorIds.filter((id) => validInitial.has(id)));
  const remaining = new Set(session.revisionFeedback.remainingErrors.map((issue) => issue.initialErrorId).filter((id) => validInitial.has(id) && !resolved.has(id)));
  return { resolved: resolved.size, remaining: remaining.size };
}

function meanAccuracy(attempts: readonly ListeningAttempt[]): number | null {
  if (!attempts.length) return null;
  return Math.round(attempts.reduce((total, attempt) => total + attempt.accuracy, 0) / attempts.length);
}

function listeningTrend(current: readonly ListeningAttempt[], previous: readonly ListeningAttempt[]): ListeningTrend {
  if (current.length < progressListeningTrendMinimumAttempts || previous.length < progressListeningTrendMinimumAttempts) return { kind: "unavailable" };
  const currentAverage = meanAccuracy(current);
  const previousAverage = meanAccuracy(previous);
  if (currentAverage === null || previousAverage === null) return { kind: "unavailable" };
  const difference = currentAverage - previousAverage;
  if (Math.abs(difference) < progressListeningTrendMinimumDifference) return { kind: "similar", points: Math.abs(difference) };
  return { kind: difference > 0 ? "higher" : "lower", points: Math.abs(difference) };
}

function timeline(days: readonly string[], events: readonly DatedEvent[], timeZone: ProgressTimeZone): ProgressDay[] {
  const byDay = new Map(days.map((date) => [date, { date, lessons: 0, writing: 0, review: 0, listening: 0 }]));
  for (const event of events) {
    const day = localDay(event.timestamp, timeZone);
    const current = day ? byDay.get(day) : undefined;
    if (current) current[event.activity] += 1;
  }
  return days.map((date) => byDay.get(date)!);
}

function timelineDays(range: ProgressRange, nowDay: string): { readonly label: string; readonly days: string[] } {
  const count = range === "7d" ? 7 : range === "30d" ? 30 : recentAllTimeTimelineDays;
  const start = addDays(nowDay, -(count - 1));
  return { label: range === "all" ? "Recent 30-day activity" : "Daily activity", days: Array.from({ length: count }, (_, index) => addDays(start, index)) };
}

function buildFocus(input: { readonly review: ReviewProgressSummary; readonly vocabulary: VocabularyProgressSummary; readonly errorPatterns: readonly PersonalErrorPattern[]; readonly balance: LearningBalance; readonly writing: WritingProgressSummary; readonly listening: ListeningProgressSummary }): FocusRecommendation[] {
  const focus: FocusRecommendation[] = [];
  const add = (entry: FocusRecommendation) => { if (focus.length < maximumFocusRecommendations) focus.push(entry); };
  if (input.review.current.overdue) add({ kind: "overdue_review", action: "review", message: `You have ${input.review.current.overdue} overdue error-pattern review${input.review.current.overdue === 1 ? "" : "s"}.` });
  if (input.vocabulary.current.overdue) add({ kind: "overdue_vocabulary", action: "vocabulary", message: `You have ${input.vocabulary.current.overdue} overdue vocabulary review${input.vocabulary.current.overdue === 1 ? "" : "s"}.` });

  const returned = input.errorPatterns.filter((pattern) => pattern.status === "returned");
  if (returned.length) add({ kind: "returned_pattern", action: "review", message: `${returned.length} returned error pattern${returned.length === 1 ? " needs" : "s need"} attention.` });
  const currentErrorDue = input.review.current.dueNow - input.review.current.overdue;
  const currentVocabularyDue = input.vocabulary.current.dueNow - input.vocabulary.current.overdue;
  if (currentErrorDue) add({ kind: "due_review", action: "review", message: `You have ${currentErrorDue} error-pattern review${currentErrorDue === 1 ? "" : "s"} due now.` });
  if (currentVocabularyDue) add({ kind: "due_vocabulary", action: "vocabulary", message: `You have ${currentVocabularyDue} vocabulary review${currentVocabularyDue === 1 ? "" : "s"} due now.` });
  const highPriority = input.errorPatterns.find((pattern) => pattern.status !== "returned" && pattern.status !== "mastered" && pattern.occurrenceCount >= progressHighPriorityMinimumOccurrences && pattern.priority >= progressHighPriorityMinimumPriority);
  if (highPriority) add({ kind: "high_priority_pattern", action: "review", message: `${reviewPatternLabel(highPriority.patternKey)} is a high-priority recurring pattern.` });

  const otherActivity = Object.values(input.balance).reduce((total, value) => total + value, 0);
  if (otherActivity) {
    if (!input.balance.listening) add({ kind: "neglected_listening", action: "listening", message: "You have not practiced listening in this period." });
    else if (!input.balance.writing) add({ kind: "neglected_writing", action: "library", message: "You have not completed a writing activity in this period." });
    else if (!input.balance.review) add({ kind: "neglected_review", action: "review", message: "You have not completed an error-pattern review in this period." });
    else if (!input.balance.lessons) add({ kind: "neglected_lessons", action: "discover", message: "You have not created a lesson in this period." });
  }
  if (input.writing.analyses >= 2 && input.writing.revisions / input.writing.analyses < 0.5) add({ kind: "revision_follow_through", action: "library", message: "Try revising more of your analyzed writing instead of only reviewing feedback." });
  if (input.listening.dictations > 0 && input.listening.dictations < progressListeningTrendMinimumAttempts) add({ kind: "listening_consistency", action: "listening", message: "Complete a few more dictations before comparing your recent accuracy." });
  if (!otherActivity && !focus.length) add({ kind: "zero_activity", action: "discover", message: "Start with one lesson or a short review session." });
  return focus;
}

export function buildProgressSnapshot(source: ProgressSourceData, options: ProgressOptions): ProgressSnapshot {
  const nowInstant = validInstant(options.now);
  if (!nowInstant) throw new Error("Progress aggregation requires a valid now timestamp.");
  const nowMs = nowInstant.getTime();
  const nowDay = localDay(options.now, options.timeZone);
  if (!nowDay) throw new Error("Progress aggregation requires a valid IANA timezone.");
  const currentWindow = dayWindow(options.range, nowDay);

  const lessons = selected(source.lessons, (lesson) => lesson.createdAt, currentWindow, nowMs, options.timeZone);
  const analyses = selected(source.writingSessions.filter((session) => session.initialFeedback !== null), (session) => session.createdAt, currentWindow, nowMs, options.timeZone);
  const revisions = selected(source.writingSessions.filter((session) => session.revisionFeedback !== null && Boolean(session.revisionReviewedAt)), (session) => session.revisionReviewedAt!, currentWindow, nowMs, options.timeZone);
  const reviewEvents = selected(source.reviewEvents, (event) => event.reviewedAt, currentWindow, nowMs, options.timeZone);
  const vocabularyEvents = selected(source.vocabularyReviewEvents, (event) => event.reviewedAt, currentWindow, nowMs, options.timeZone);
  const attempts = selected(source.listeningAttempts, (attempt) => attempt.attemptedAt, currentWindow, nowMs, options.timeZone);
  const shadowingEvents = selected(source.shadowingEvents, (event) => event.repeatedAt, currentWindow, nowMs, options.timeZone);
  const ieltsReading = selected((source.ieltsReadingPractices ?? []).filter((practice) => practice.completedAt !== null), (practice) => practice.completedAt!, currentWindow, nowMs, options.timeZone);
  const ieltsInitial = selected((source.ieltsWritingSessions ?? []).filter((session) => session.initialAnalyzedAt !== null), (session) => session.initialAnalyzedAt!, currentWindow, nowMs, options.timeZone);
  const ieltsRevision = selected((source.ieltsWritingSessions ?? []).filter((session) => session.revisionReviewedAt !== null), (session) => session.revisionReviewedAt!, currentWindow, nowMs, options.timeZone);

  const highConfidenceFindings = analyses.reduce((total, session) => total + initialIssues(session).filter((issue) => issue.confidence >= 0.85).length, 0);
  const revisionTotals = revisions.reduce((total, session) => {
    const issues = revisionIssues(session);
    return { resolved: total.resolved + issues.resolved, remaining: total.remaining + issues.remaining };
  }, { resolved: 0, remaining: 0 });
  const evaluated = revisionTotals.resolved + revisionTotals.remaining;

  const current = { needs_practice: 0, improving: 0, mastered: 0, returned: 0 } as Record<PersonalErrorPattern["status"], number>;
  for (const pattern of source.errorPatterns) current[pattern.status] += 1;
  const topPatterns = [...source.errorPatterns].sort((left, right) => right.priority - left.priority || right.occurrenceCount - left.occurrenceCount || right.lastSeenAt.localeCompare(left.lastSeenAt) || left.patternKey.localeCompare(right.patternKey)).slice(0, 5).map((pattern) => ({ label: reviewPatternLabel(pattern.patternKey), patternKey: pattern.patternKey, occurrenceCount: pattern.occurrenceCount, status: pattern.status, priority: pattern.priority }));

  const dueNow = source.reviewItems.filter((item) => {
    const dueAt = validInstant(item.dueAt);
    return item.status === "scheduled" && dueAt !== null && dueAt.getTime() <= nowMs;
  }).length;
  const overdue = source.reviewItems.filter((item) => item.status === "scheduled" && (() => { const day = localDay(item.dueAt, options.timeZone); return day !== null && day < nowDay; })()).length;
  const correct = reviewEvents.filter((event) => event.verdict === "correct").length;
  const incorrect = reviewEvents.filter((event) => event.verdict === "incorrect").length;
  const uncertain = reviewEvents.filter((event) => event.verdict === "uncertain").length;
  const scheduled = reviewEvents.filter((event) => event.reviewKind === "scheduled").length;
  const practiceNow = reviewEvents.length - scheduled;

  const priorWindow = previousWindow(options.range, currentWindow);
  const previousAttempts = priorWindow ? selected(source.listeningAttempts, (attempt) => attempt.attemptedAt, priorWindow, nowMs, options.timeZone) : [];
  const listening: ListeningProgressSummary = {
    dictations: attempts.length,
    averageAccuracy: meanAccuracy(attempts),
    status: { correct: attempts.filter((attempt) => attempt.status === "correct").length, nearly_there: attempts.filter((attempt) => attempt.status === "nearly_there").length, try_again: attempts.filter((attempt) => attempt.status === "try_again").length },
    shadowingRepetitions: shadowingEvents.length,
    trend: priorWindow ? listeningTrend(attempts, previousAttempts) : { kind: "unavailable" },
  };
  const activeDays = new Set([
    ...lessons.map((lesson) => localDay(lesson.createdAt, options.timeZone)),
    ...analyses.map((session) => localDay(session.createdAt, options.timeZone)),
    ...revisions.map((session) => localDay(session.revisionReviewedAt!, options.timeZone)),
    ...reviewEvents.map((event) => localDay(event.reviewedAt, options.timeZone)),
    ...attempts.map((attempt) => localDay(attempt.attemptedAt, options.timeZone)),
    ...shadowingEvents.map((event) => localDay(event.repeatedAt, options.timeZone)),
    ...ieltsReading.map((practice) => localDay(practice.completedAt!, options.timeZone)),
    ...ieltsInitial.map((session) => localDay(session.initialAnalyzedAt!, options.timeZone)),
    ...ieltsRevision.map((session) => localDay(session.revisionReviewedAt!, options.timeZone)),
  ].filter((day): day is string => day !== null)).size;
  const activity: ActivitySummary = { activeDays, lessonsCreated: lessons.length, writingAnalyses: analyses.length, revisionReviews: revisions.length, reviewAttempts: reviewEvents.length, dictationsCompleted: attempts.length, shadowingRepetitions: shadowingEvents.length };
  const balance: LearningBalance = { lessons: lessons.length, writing: analyses.length + revisions.length, review: reviewEvents.length, listening: attempts.length + shadowingEvents.length };
  const ielts: IeltsProgressSummary = { reading: { completed: ieltsReading.length, correct: ieltsReading.reduce((total, practice) => total + practice.questions.filter((question) => practice.answers[question.id] === (question.type === "multiple_choice" ? question.correctOptionId : question.answer)).length, 0), total: ieltsReading.reduce((total, practice) => total + practice.questions.length, 0) }, writing: { initialAnalyses: ieltsInitial.length, revisionReviews: ieltsRevision.length, timedPractices: [...ieltsReading, ...ieltsInitial, ...ieltsRevision].filter((entry) => entry.elapsedSeconds !== null).length } };
  const writing: WritingProgressSummary = { analyses: analyses.length, revisions: revisions.length, highConfidenceFindings, averageHighConfidenceFindings: analyses.length ? highConfidenceFindings / analyses.length : null, resolvedInRevisions: revisionTotals.resolved, remainingInRevisions: revisionTotals.remaining, resolutionRate: evaluated ? revisionTotals.resolved / evaluated : null };
  const review: ReviewProgressSummary = { current: { dueNow, overdue, masteredItems: source.reviewItems.filter((item) => item.status === "mastered").length }, events: { attempts: reviewEvents.length, scheduled, practiceNow, correct, incorrect, uncertain, successRate: correct + incorrect ? correct / (correct + incorrect) : null } };
  const vocabularyCurrent = vocabularyReviewCurrentState(source.vocabularyReviewItems, source.vocabularyPhraseIds.map((id) => ({ id })), options.now, options.timeZone);
  const vocabularyCorrect = vocabularyEvents.filter((event) => event.outcome === "correct").length;
  const vocabularyIncorrect = vocabularyEvents.filter((event) => event.outcome === "incorrect").length;
  const vocabularyScheduled = vocabularyEvents.filter((event) => event.reviewKind === "scheduled").length;
  const vocabulary: VocabularyProgressSummary = { current: vocabularyCurrent, events: { attempts: vocabularyEvents.length, scheduled: vocabularyScheduled, practiceNow: vocabularyEvents.length - vocabularyScheduled, correct: vocabularyCorrect, incorrect: vocabularyIncorrect, successRate: vocabularyCorrect + vocabularyIncorrect ? vocabularyCorrect / (vocabularyCorrect + vocabularyIncorrect) : null } };

  const events: DatedEvent[] = [
    ...lessons.map((lesson) => ({ timestamp: lesson.createdAt, activity: "lessons" as const })),
    ...analyses.map((session) => ({ timestamp: session.createdAt, activity: "writing" as const })),
    ...revisions.map((session) => ({ timestamp: session.revisionReviewedAt!, activity: "writing" as const })),
    ...reviewEvents.map((event) => ({ timestamp: event.reviewedAt, activity: "review" as const })),
    ...attempts.map((attempt) => ({ timestamp: attempt.attemptedAt, activity: "listening" as const })),
    ...shadowingEvents.map((event) => ({ timestamp: event.repeatedAt, activity: "listening" as const })),
  ];
  const timelineConfig = timelineDays(options.range, nowDay);
  const allTimeTimelineEvents = events;

  return { range: options.range, timeZone: options.timeZone, timelineLabel: timelineConfig.label, activity, writing, errorMemory: { current, topPatterns }, review, vocabulary, listening, balance, ielts, focus: buildFocus({ review, vocabulary, errorPatterns: source.errorPatterns, balance, writing, listening }), timeline: timeline(timelineConfig.days, allTimeTimelineEvents, options.timeZone) };
}
